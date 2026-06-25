export const sectionObserverScript = String.raw`
(() => {
  const startedAt = performance.now();
  const records = new Map();

  function cssPath(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return "";
    const parts = [];
    let node = element;
    while (node && node.nodeType === Node.ELEMENT_NODE && parts.length < 5) {
      const tag = node.tagName.toLowerCase();
      const id = node.id ? "#" + CSS.escape(node.id) : "";
      const label = node.getAttribute("data-perf-section");
      if (label) {
        parts.unshift('[data-perf-section="' + CSS.escape(label) + '"]');
        break;
      }
      if (id) {
        parts.unshift(tag + id);
        break;
      }
      const parent = node.parentElement;
      if (!parent) {
        parts.unshift(tag);
        break;
      }
      const siblings = Array.from(parent.children).filter((child) => child.tagName === node.tagName);
      const index = siblings.indexOf(node) + 1;
      parts.unshift(siblings.length > 1 ? tag + ":nth-of-type(" + index + ")" : tag);
      node = parent;
    }
    return parts.join(" > ");
  }

  function labelFor(element, fallbackIndex) {
    const explicit = element.getAttribute("data-perf-section") || element.getAttribute("aria-label");
    if (explicit) return explicit.trim();
    const heading = element.querySelector("h1,h2,h3,[role=heading]");
    if (heading && heading.textContent && heading.textContent.trim()) {
      return heading.textContent.trim().slice(0, 80);
    }
    const role = element.getAttribute("role");
    if (role) return role.charAt(0).toUpperCase() + role.slice(1);
    return element.tagName.toLowerCase() + " " + fallbackIndex;
  }

  function rawHtmlFor(element) {
    const html = element.outerHTML || "";
    return html.length > 12000 ? html.slice(0, 12000) + "\n<!-- truncated by auditor -->" : html;
  }

  function candidates() {
    const semantic = Array.from(document.querySelectorAll("[data-perf-section], main, section, article, aside, header, footer, nav, [role=main], [role=region], [role=banner], [role=complementary]"));
    const largeBlocks = Array.from(document.body ? document.body.children : []).filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.height >= 180 && rect.width >= Math.min(window.innerWidth * 0.55, 760);
    });
    return Array.from(new Set([...semantic, ...largeBlocks])).filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
  }

  function snapshot() {
    candidates().forEach((element, index) => {
      const selector = cssPath(element);
      if (!selector || records.has(selector)) return;
      const rect = element.getBoundingClientRect();
      records.set(selector, {
        label: labelFor(element, index + 1),
        selector,
        elementHtml: rawHtmlFor(element),
        top: rect.top + window.scrollY,
        height: rect.height,
        firstDetectedMs: performance.now() - startedAt,
        firstVisibleMs: null,
        contentStableMs: null,
        renderCompleteMs: null,
        layoutShiftScore: 0,
        blockingResourceCount: 0
      });
    });
  }

  const intersectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const selector = cssPath(entry.target);
      const record = records.get(selector);
      if (record && record.firstVisibleMs == null) {
        record.firstVisibleMs = performance.now() - startedAt;
      }
    });
  }, { threshold: [0.01, 0.25] });

  function observeCandidates() {
    snapshot();
    candidates().forEach((element) => intersectionObserver.observe(element));
  }

  let lastMutationAt = performance.now();
  const mutationObserver = new MutationObserver(() => {
    lastMutationAt = performance.now();
    observeCandidates();
  });

  const layoutObserver = new PerformanceObserver((list) => {
    list.getEntries().forEach((entry) => {
      if (entry.hadRecentInput) return;
      const sources = entry.sources || [];
      sources.forEach((source) => {
        const node = source.node;
        if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
        const closest = node.closest("[data-perf-section], main, section, article, aside, header, footer, nav, [role=main], [role=region], [role=banner], [role=complementary]");
        if (!closest) return;
        const record = records.get(cssPath(closest));
        if (record) record.layoutShiftScore += entry.value || 0;
      });
    });
  });

  try {
    layoutObserver.observe({ type: "layout-shift", buffered: true });
  } catch (_) {}

  function markStableSections() {
    const now = performance.now();
    records.forEach((record) => {
      if (record.firstVisibleMs != null && record.contentStableMs == null && now - lastMutationAt > 700) {
        record.contentStableMs = now - startedAt;
        record.renderCompleteMs = Math.max(record.contentStableMs, record.firstVisibleMs);
      }
    });
  }

  let stableTimer = null;
  let started = false;

  function start() {
    if (started || !document.documentElement) return;
    started = true;
    observeCandidates();
    stableTimer = window.setInterval(markStableSections, 250);
    mutationObserver.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
  }

  window.__sectionTimeline = {
    getSections() {
      start();
      observeCandidates();
      markStableSections();
      if (stableTimer != null) window.clearInterval(stableTimer);
      return Array.from(records.values()).map((record) => ({
        ...record,
        renderCompleteMs: record.renderCompleteMs ?? record.contentStableMs ?? record.firstVisibleMs ?? record.firstDetectedMs
      }));
    }
  };

  if (document.documentElement) start();
  else window.addEventListener("DOMContentLoaded", start, { once: true });
})();
`;
