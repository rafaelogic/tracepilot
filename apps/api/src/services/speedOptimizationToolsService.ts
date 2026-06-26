import { chromium, type Browser, type BrowserContext, type Page, type Response } from "playwright";
import type {
  AuditCategoryFinding,
  AuditFindingItem,
  BundleCompositionResponse,
  CoverageAuditResponse,
  CriticalCssResponse,
  ImageOptimizationResponse,
  JavaScriptExecutionProfileResponse,
  PrefetchOpportunityResponse,
  RepeatViewFilmstripResponse,
  RumSnippetResponse,
  ThirdPartyMitigationResponse
} from "../../../../packages/shared/types.js";
import { resolveAuditNetwork } from "../audit/network-target.js";

type ResourceEntry = { name: string; initiatorType: string; transferSize: number; duration: number };
type ScriptRecord = { url: string; bytes: number; firstParty: boolean; host: string };

export async function profileJavaScriptExecution(url: string): Promise<JavaScriptExecutionProfileResponse> {
  return withPage(url, {
    beforeGoto: async (page) => {
      await page.addInitScript(() => {
        (window as any).__tracepilotLongTasks = [];
        try {
          const observer = new PerformanceObserver((list) => {
            (window as any).__tracepilotLongTasks.push(...list.getEntries().map((entry: any) => ({
              startTime: entry.startTime,
              duration: entry.duration,
              attribution: Array.isArray(entry.attribution) ? entry.attribution.map((item: any) => item.name || item.containerSrc || item.containerId).filter(Boolean) : []
            })));
          });
          observer.observe({ type: "longtask", buffered: true } as PerformanceObserverInit);
        } catch {
          // Long Task API is not available in every browser context.
        }
      });
    },
    run: async ({ page, response }) => {
      await page.waitForTimeout(1200);
      const longTasks = await page.evaluate(() => ((window as any).__tracepilotLongTasks ?? []) as JavaScriptExecutionProfileResponse["longTasks"]);
      const resources = await resourceEntries(page);
      const scriptResources = resources
        .filter((entry) => entry.initiatorType === "script")
        .map((entry) => ({ url: entry.name, transferSize: entry.transferSize, duration: entry.duration }))
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 25);
      const totalLongTaskTime = Math.round(longTasks.reduce((total, task) => total + task.duration, 0));
      const maxLongTaskTime = Math.round(Math.max(...longTasks.map((task) => task.duration), 0));
      const findings = jsExecutionFindings(totalLongTaskTime, maxLongTaskTime, longTasks, scriptResources);
      return { url, finalUrl: page.url(), status: response?.status() ?? null, totalLongTaskTime, maxLongTaskTime, longTasks, scriptResources, findings, passed: noBlockers(findings) };
    }
  });
}

export async function auditUnusedCoverage(url: string): Promise<CoverageAuditResponse> {
  return withCoverage(url, async ({ page, client }) => {
    const resources = await resourceEntries(page);
    const jsCoverage = await client.send("Profiler.takePreciseCoverage") as any;
    const cssCoverage = await client.send("CSS.stopRuleUsageTracking") as any;
    const js = await summarizeJsCoverage(page.context(), jsCoverage.result ?? []);
    const css = await summarizeCssCoverage(client, cssCoverage.ruleUsage ?? []);
    const jsWithTransfers = mergeTransferSizes(js, resources.filter((entry) => entry.initiatorType === "script"));
    const cssWithTransfers = mergeTransferSizes(css, resources.filter((entry) => entry.initiatorType === "link" || entry.name.endsWith(".css")));
    const findings = coverageFindings(jsWithTransfers, cssWithTransfers);
    return { url, finalUrl: page.url(), js: jsWithTransfers, css: cssWithTransfers, findings, passed: noBlockers(findings) };
  });
}

export async function analyzeBundleComposition(url: string): Promise<BundleCompositionResponse> {
  return withPage(url, {
    run: async ({ page }) => {
      const origin = new URL(page.url()).origin;
      const scripts = (await resourceEntries(page))
        .filter((entry) => entry.initiatorType === "script" || entry.name.match(/\.(m?js)(\?|$)/))
        .map((entry): ScriptRecord => {
          const parsed = safeUrl(entry.name);
          return {
            url: entry.name,
            bytes: entry.transferSize,
            firstParty: parsed?.origin === origin,
            host: parsed?.host ?? "unknown"
          };
        })
        .sort((a, b) => b.bytes - a.bytes);
      const totalScriptBytes = sum(scripts.map((script) => script.bytes));
      const firstPartyBytes = sum(scripts.filter((script) => script.firstParty).map((script) => script.bytes));
      const thirdPartyBytes = totalScriptBytes - firstPartyBytes;
      const findings = bundleFindings(scripts, totalScriptBytes, thirdPartyBytes);
      return { url, finalUrl: page.url(), totalScriptBytes, firstPartyBytes, thirdPartyBytes, scripts, findings, passed: noBlockers(findings) };
    }
  });
}

export async function auditImageOptimization(url: string): Promise<ImageOptimizationResponse> {
  return withPage(url, {
    run: async ({ page }) => {
      const resources = await resourceEntries(page);
      const images = await page.evaluate(() => Array.from(document.images).map((image) => {
        const rect = image.getBoundingClientRect();
        const src = image.currentSrc || image.src;
        const extension = src.split("?")[0]?.split(".").pop()?.toLowerCase() || "unknown";
        const displayWidth = Math.max(1, Math.round(rect.width));
        const displayHeight = Math.max(1, Math.round(rect.height));
        const widthRatio = image.naturalWidth > 0 ? image.naturalWidth / displayWidth : 1;
        const heightRatio = image.naturalHeight > 0 ? image.naturalHeight / displayHeight : 1;
        return {
          src,
          format: extension,
          transferSize: 0,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          displayWidth,
          displayHeight,
          oversizedRatio: Math.round(Math.max(widthRatio, heightRatio) * 10) / 10
        };
      }));
      const withSizes = images.map((image) => ({
        ...image,
        transferSize: resources.find((entry) => entry.name === image.src)?.transferSize ?? 0
      })).sort((a, b) => b.transferSize - a.transferSize);
      const totalImageBytes = sum(withSizes.map((image) => image.transferSize));
      const potentialSavings = sum(withSizes.map((image) => image.oversizedRatio >= 2 ? Math.round(image.transferSize * 0.45) : 0));
      const findings = imageFindings(withSizes, potentialSavings);
      return { url, finalUrl: page.url(), images: withSizes, totalImageBytes, potentialSavings, findings, passed: noBlockers(findings) };
    }
  });
}

export async function analyzeCriticalCss(url: string): Promise<CriticalCssResponse> {
  return withCoverage(url, async ({ page, client }) => {
    const cssCoverage = await client.send("CSS.stopRuleUsageTracking") as any;
    const stylesheets = await summarizeCssCoverage(client, cssCoverage.ruleUsage ?? []);
    const blockingStylesheets = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"]'))
      .filter((link) => !link.media || link.media === "all" || link.media === "screen")
      .map((link) => ({ url: link.href, media: link.media || null })));
    const totalCssBytes = sum(stylesheets.files.map((file) => file.totalBytes));
    const unusedCssBytes = sum(stylesheets.files.map((file) => file.unusedBytes));
    const findings = criticalCssFindings(blockingStylesheets, totalCssBytes, unusedCssBytes);
    return { url, finalUrl: page.url(), totalCssBytes, unusedCssBytes, blockingStylesheets, stylesheets: stylesheets.files, findings, passed: noBlockers(findings) };
  });
}

export async function generateRumSnippet(url: string): Promise<RumSnippetResponse> {
  const parsed = new URL(url);
  const endpointPath = "/api/rum/web-vitals";
  const snippet = `<script type="module">
import { onCLS, onINP, onLCP, onFCP, onTTFB } from "https://unpkg.com/web-vitals@5/dist/web-vitals.attribution.js?module";
const send = (metric) => navigator.sendBeacon("${endpointPath}", JSON.stringify({
  name: metric.name,
  value: metric.value,
  rating: metric.rating,
  id: metric.id,
  url: location.href,
  attribution: metric.attribution
}));
[onCLS, onINP, onLCP, onFCP, onTTFB].forEach((measure) => measure(send));
</script>`;
  const findings = [finding("rum-endpoint-required", "RUM collection endpoint is not installed yet", "Add a small endpoint that accepts the generated Web Vitals payload and stores or forwards it to analytics.", "manual", item("Endpoint", endpointPath))];
  return {
    url,
    finalUrl: parsed.toString(),
    endpointPath,
    snippet,
    metrics: ["CLS", "INP", "LCP", "FCP", "TTFB"],
    payloadShape: { name: "metric name", value: "number", rating: "good | needs-improvement | poor", id: "metric id", url: "page URL", attribution: "metric-specific attribution object" },
    findings,
    passed: true
  };
}

export async function adviseThirdPartyMitigation(url: string): Promise<ThirdPartyMitigationResponse> {
  const firstPartyOrigin = new URL(url).origin;
  const records: Array<{ url: string; type: string }> = [];
  return withPage(url, {
    beforeGoto: async (page) => {
      page.on("request", (request) => records.push({ url: request.url(), type: request.resourceType() }));
    },
    run: async ({ page }) => {
      const parties = thirdPartyGroups(firstPartyOrigin, records).map((party) => ({
        ...party,
        recommendations: recommendationsForParty(party)
      }));
      const findings = thirdPartyMitigationFindings(parties);
      return { url, finalUrl: page.url(), firstPartyOrigin, parties, findings, passed: noBlockers(findings) };
    }
  });
}

export async function findPrefetchOpportunities(url: string): Promise<PrefetchOpportunityResponse> {
  return withPage(url, {
    run: async ({ page }) => {
      const origin = new URL(page.url()).origin;
      const links = await page.evaluate((pageOrigin) => Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]")).map((anchor) => {
        const rect = anchor.getBoundingClientRect();
        const href = anchor.href;
        const text = (anchor.textContent ?? "").replace(/\s+/g, " ").trim();
        const visible = rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight * 1.5 && rect.bottom > -100;
        return { href, text, visible, sameOrigin: href.startsWith(pageOrigin) };
      }), origin);
      const avoidPatterns = /(logout|signout|delete|remove|cart|checkout|admin|account|download|\.pdf|#)/i;
      const candidates = links
        .filter((link) => link.sameOrigin && link.visible && !avoidPatterns.test(link.href))
        .slice(0, 12)
        .map((link) => ({ url: link.href, text: link.text, reason: "Visible same-origin navigation link", visible: link.visible }));
      const avoid = links
        .filter((link) => link.sameOrigin && avoidPatterns.test(link.href))
        .slice(0, 12)
        .map((link) => ({ url: link.href, text: link.text, reason: "Avoid prefetching stateful, private, file, or fragment links" }));
      const speculationRules = JSON.stringify({ prerender: [{ source: "list", urls: candidates.slice(0, 5).map((candidate) => candidate.url) }] }, null, 2);
      const findings = prefetchFindings(candidates, avoid);
      return { url, finalUrl: page.url(), candidates, avoid, speculationRules, findings, passed: noBlockers(findings) };
    }
  });
}

export async function compareRepeatViewFilmstrip(url: string): Promise<RepeatViewFilmstripResponse> {
  const auditNetwork = await resolveAuditNetwork(url);
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true, args: auditNetwork.chromiumArgs });
    const context = await browser.newContext({ ignoreHTTPSErrors: auditNetwork.ignoreHTTPSErrors, viewport: { width: 1365, height: 768 } });
    const page = await context.newPage();
    const firstView = await captureView(page, url);
    const repeatView = await captureView(page, url);
    const findings = repeatViewFindings(firstView, repeatView);
    return { url, finalUrl: page.url(), firstView, repeatView, findings, passed: noBlockers(findings) };
  } finally {
    await browser?.close();
  }
}

async function withPage<T>(url: string, options: { beforeGoto?: (page: Page, context: BrowserContext) => Promise<void>; run: (input: { browser: Browser; context: BrowserContext; page: Page; response: Response | null }) => Promise<T> }) {
  const auditNetwork = await resolveAuditNetwork(url);
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true, args: auditNetwork.chromiumArgs });
    const context = await browser.newContext({ ignoreHTTPSErrors: auditNetwork.ignoreHTTPSErrors, viewport: { width: 1365, height: 768 } });
    const page = await context.newPage();
    await options.beforeGoto?.(page, context);
    const response = await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 }).catch(() => null);
    return await options.run({ browser, context, page, response });
  } finally {
    await browser?.close();
  }
}

async function withCoverage<T>(url: string, run: (input: { page: Page; context: BrowserContext; client: any; response: Response | null }) => Promise<T>) {
  return withPage(url, {
    beforeGoto: async (page) => {
      const client = await page.context().newCDPSession(page);
      (page as any).__tracepilotClient = client;
      await client.send("Profiler.enable");
      await client.send("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
      await client.send("DOM.enable");
      await client.send("CSS.enable");
      await client.send("CSS.startRuleUsageTracking");
    },
    run: async ({ page, context, response }) => {
      const client = (page as any).__tracepilotClient;
      return run({ page, context, client, response });
    }
  });
}

async function resourceEntries(page: Page): Promise<ResourceEntry[]> {
  return page.evaluate(() => performance.getEntriesByType("resource").map((entry: any) => ({
    name: entry.name,
    initiatorType: entry.initiatorType ?? "",
    transferSize: Math.max(0, Math.round(entry.transferSize ?? entry.encodedBodySize ?? 0)),
    duration: Math.round(entry.duration ?? 0)
  })));
}

async function summarizeJsCoverage(context: BrowserContext, entries: any[]) {
  const files = [];
  for (const entry of entries.filter((item) => item.url)) {
    const usedBytes = usedBytesFromRanges(entry.functions.flatMap((fn: any) => fn.ranges.filter((range: any) => range.count > 0)));
    const totalBytes = await fetchByteLength(context, entry.url).catch(() => Math.max(usedBytes, maxRangeEnd(entry.functions.flatMap((fn: any) => fn.ranges))));
    files.push({ url: entry.url, totalBytes, unusedBytes: Math.max(0, totalBytes - usedBytes) });
  }
  return compactCoverage(files);
}

async function summarizeCssCoverage(client: any, ruleUsage: any[]) {
  const bySheet = new Map<string, { usedRanges: Array<{ startOffset: number; endOffset: number }>; allRanges: Array<{ startOffset: number; endOffset: number }> }>();
  for (const rule of ruleUsage) {
    const current = bySheet.get(rule.styleSheetId) ?? { usedRanges: [], allRanges: [] };
    const range = { startOffset: rule.startOffset, endOffset: rule.endOffset };
    current.allRanges.push(range);
    if (rule.used) current.usedRanges.push(range);
    bySheet.set(rule.styleSheetId, current);
  }
  const files = [];
  for (const [styleSheetId, sheet] of bySheet.entries()) {
    const text = await client.send("CSS.getStyleSheetText", { styleSheetId }).then((result: any) => result.text as string).catch(() => "");
    const header = await client.send("CSS.getStyleSheetText", { styleSheetId }).then(() => null).catch(() => null);
    const totalBytes = text.length || maxRangeEnd(sheet.allRanges);
    const usedBytes = usedBytesFromRanges(sheet.usedRanges);
    files.push({ url: String(header?.sourceURL ?? styleSheetId), totalBytes, unusedBytes: Math.max(0, totalBytes - usedBytes) });
  }
  return compactCoverage(files);
}

async function fetchByteLength(context: BrowserContext, url: string) {
  const response = await context.request.get(url, { timeout: 8_000 });
  const body = await response.body();
  return body.byteLength;
}

function compactCoverage(files: Array<{ url: string; totalBytes: number; unusedBytes: number }>) {
  const cleaned = files.filter((file) => file.totalBytes > 0).sort((a, b) => b.unusedBytes - a.unusedBytes).slice(0, 25);
  return {
    totalBytes: sum(cleaned.map((file) => file.totalBytes)),
    unusedBytes: sum(cleaned.map((file) => file.unusedBytes)),
    files: cleaned
  };
}

function mergeTransferSizes(coverage: { totalBytes: number; unusedBytes: number; files: Array<{ url: string; totalBytes: number; unusedBytes: number }> }, resources: ResourceEntry[]) {
  const files = coverage.files.map((file) => {
    const transfer = resources.find((resource) => resource.name === file.url)?.transferSize ?? 0;
    return { ...file, totalBytes: Math.max(file.totalBytes, transfer) };
  });
  return { totalBytes: sum(files.map((file) => file.totalBytes)), unusedBytes: sum(files.map((file) => file.unusedBytes)), files };
}

function usedBytesFromRanges(ranges: Array<{ startOffset: number; endOffset: number }>) {
  const sorted = ranges.sort((a, b) => a.startOffset - b.startOffset);
  let total = 0;
  let start = -1;
  let end = -1;
  for (const range of sorted) {
    if (start < 0) {
      start = range.startOffset;
      end = range.endOffset;
    } else if (range.startOffset <= end) {
      end = Math.max(end, range.endOffset);
    } else {
      total += end - start;
      start = range.startOffset;
      end = range.endOffset;
    }
  }
  return total + (start >= 0 ? end - start : 0);
}

function maxRangeEnd(ranges: Array<{ endOffset: number }>) {
  return Math.max(...ranges.map((range) => range.endOffset), 0);
}

function thirdPartyGroups(firstPartyOrigin: string, records: Array<{ url: string; type: string }>) {
  const groups = new Map<string, Array<{ url: string; type: string }>>();
  records.forEach((record) => {
    const parsed = safeUrl(record.url);
    if (!parsed || parsed.origin === firstPartyOrigin) return;
    groups.set(parsed.origin, [...(groups.get(parsed.origin) ?? []), record]);
  });
  return [...groups.entries()].map(([origin, entries]) => ({
    origin,
    requestCount: entries.length,
    scriptCount: entries.filter((entry) => entry.type === "script").length,
    resourceTypes: [...new Set(entries.map((entry) => entry.type))].sort()
  })).sort((a, b) => b.requestCount - a.requestCount);
}

function recommendationsForParty(party: { origin: string; requestCount: number; scriptCount: number; resourceTypes: string[] }) {
  const recommendations = [];
  if (party.scriptCount > 0) recommendations.push("Delay script loading until consent, interaction, or route need is confirmed.");
  if (party.scriptCount > 2) recommendations.push("Consolidate duplicate tags or move non-critical third-party scripts off the initial route.");
  if (party.requestCount > 8) recommendations.push("Review provider configuration and disable unused modules/events.");
  if (party.origin.includes("googletagmanager") || party.origin.includes("google-analytics")) recommendations.push("Audit GTM/analytics tags for duplicate pageviews and consent-mode timing.");
  recommendations.push("Document ownership, business purpose, and removal criteria for this third-party origin.");
  return recommendations;
}

async function captureView(page: Page, url: string) {
  const screenshots = [];
  const started = Date.now();
  const navigation = page.goto(url, { waitUntil: "load", timeout: 30_000 }).catch(() => null);
  for (const atMs of [500, 1000, 2000]) {
    const delay = started + atMs - Date.now();
    if (delay > 0) await page.waitForTimeout(delay);
    const buffer = await page.screenshot({ type: "jpeg", quality: 58, fullPage: false });
    screenshots.push({ atMs, dataUrl: `data:image/jpeg;base64,${buffer.toString("base64")}` });
  }
  await navigation;
  await page.waitForTimeout(300);
  const timing = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    return {
      loadEventEnd: Math.round(nav?.loadEventEnd ?? 0),
      domContentLoaded: Math.round(nav?.domContentLoadedEventEnd ?? 0),
      transferSize: resources.reduce((total, resource) => total + Math.max(0, Math.round(resource.transferSize ?? 0)), 0)
    };
  });
  return { ...timing, screenshots };
}

function jsExecutionFindings(totalLongTaskTime: number, maxLongTaskTime: number, longTasks: JavaScriptExecutionProfileResponse["longTasks"], scripts: JavaScriptExecutionProfileResponse["scriptResources"]) {
  const findings: AuditCategoryFinding[] = [];
  if (maxLongTaskTime > 250) findings.push(finding("long-main-thread-task", "Very long JavaScript task detected", "Split expensive work, defer non-critical scripts, or move heavy processing off the main thread.", "failed", item("Longest task", `${maxLongTaskTime}ms`)));
  if (totalLongTaskTime > 600) findings.push(finding("high-total-long-task-time", "High total long-task time", "Reduce hydration, third-party execution, and synchronous work during startup.", "warning", item("Total long-task time", `${totalLongTaskTime}ms`)));
  if (scripts.length > 12) findings.push(finding("many-script-resources", "Many script resources loaded", "Review route-level code splitting and third-party script ownership.", "warning", item("Scripts", `${scripts.length} script resources`)));
  if (longTasks.length === 0 && scripts.length === 0) findings.push(finding("execution-data-sparse", "Limited execution timing data collected", "Re-run on a page with JavaScript activity or interact with key flows in a future journey-aware profiler.", "manual", item("Long tasks", "None observed")));
  return findings;
}

function coverageFindings(js: CoverageAuditResponse["js"], css: CoverageAuditResponse["css"]) {
  const findings: AuditCategoryFinding[] = [];
  if (js.totalBytes > 0 && js.unusedBytes / js.totalBytes > 0.55) findings.push(finding("high-unused-js", "High unused JavaScript coverage", "Split route bundles, defer non-critical modules, and remove unused dependencies.", "warning", ...js.files.slice(0, 5).map((file) => item(file.url, `${formatBytes(file.unusedBytes)} unused`))));
  if (css.totalBytes > 0 && css.unusedBytes / css.totalBytes > 0.6) findings.push(finding("high-unused-css", "High unused CSS coverage", "Extract route CSS, remove unused selectors, and avoid shipping global style sheets to every page.", "warning", ...css.files.slice(0, 5).map((file) => item(file.url, `${formatBytes(file.unusedBytes)} unused`))));
  return findings;
}

function bundleFindings(scripts: ScriptRecord[], totalBytes: number, thirdPartyBytes: number) {
  const findings: AuditCategoryFinding[] = [];
  const largest = scripts[0];
  if (largest && largest.bytes > 250_000) findings.push(finding("large-runtime-script", "Large runtime script asset loaded", "Inspect the bundle source map or build stats for this asset and split route-specific code.", "warning", item(largest.url, formatBytes(largest.bytes))));
  if (totalBytes > 0 && thirdPartyBytes / totalBytes > 0.45) findings.push(finding("third-party-script-share-high", "Third-party scripts dominate runtime bundle bytes", "Audit tag ownership and delay third-party loading until needed.", "warning", item("Third-party bytes", formatBytes(thirdPartyBytes))));
  return findings;
}

function imageFindings(images: ImageOptimizationResponse["images"], potentialSavings: number) {
  const findings: AuditCategoryFinding[] = [];
  const oversized = images.filter((image) => image.oversizedRatio >= 2 && image.transferSize > 20_000);
  if (oversized.length) findings.push(finding("oversized-rendered-images", "Images are much larger than their rendered size", "Generate responsive image variants and set accurate sizes/srcset attributes.", "warning", ...oversized.slice(0, 8).map((image) => item(image.src, `${image.oversizedRatio}x rendered size`, `${image.naturalWidth}x${image.naturalHeight} -> ${image.displayWidth}x${image.displayHeight}`))));
  const legacy = images.filter((image) => ["jpg", "jpeg", "png"].includes(image.format) && image.transferSize > 80_000);
  if (legacy.length) findings.push(finding("legacy-large-image-format", "Large legacy-format images detected", "Consider AVIF/WebP variants while preserving PNG only where alpha or lossless quality is required.", "manual", ...legacy.slice(0, 8).map((image) => item(image.src, `${image.format.toUpperCase()} ${formatBytes(image.transferSize)}`))));
  if (potentialSavings > 250_000) findings.push(finding("image-savings-high", "Potential image savings are high", "Prioritize image variant generation for the largest oversized assets.", "warning", item("Potential savings", formatBytes(potentialSavings))));
  return findings;
}

function criticalCssFindings(blocking: CriticalCssResponse["blockingStylesheets"], totalCssBytes: number, unusedCssBytes: number) {
  const findings: AuditCategoryFinding[] = [];
  if (blocking.length > 3) findings.push(finding("many-render-blocking-stylesheets", "Many render-blocking stylesheets detected", "Inline critical CSS and defer or split non-critical stylesheets.", "warning", ...blocking.slice(0, 8).map((sheet) => item(sheet.url, sheet.media ?? "all"))));
  if (totalCssBytes > 0 && unusedCssBytes / totalCssBytes > 0.65) findings.push(finding("critical-css-unused-share-high", "Most CSS was unused during initial render", "Extract route-level CSS and remove global selectors not needed above the fold.", "warning", item("Unused CSS", `${formatBytes(unusedCssBytes)} of ${formatBytes(totalCssBytes)}`)));
  return findings;
}

function thirdPartyMitigationFindings(parties: ThirdPartyMitigationResponse["parties"]) {
  const findings: AuditCategoryFinding[] = [];
  const heavy = parties.filter((party) => party.scriptCount > 2 || party.requestCount > 8);
  if (heavy.length) findings.push(finding("third-party-mitigation-needed", "Third-party origins need loading strategy review", "Apply route-level loading, consent gates, worker offloading, or removal criteria.", "warning", ...heavy.map((party) => item(party.origin, `${party.requestCount} requests, ${party.scriptCount} scripts`))));
  return findings;
}

function prefetchFindings(candidates: PrefetchOpportunityResponse["candidates"], avoid: PrefetchOpportunityResponse["avoid"]) {
  const findings: AuditCategoryFinding[] = [];
  if (candidates.length === 0) findings.push(finding("no-prefetch-candidates", "No safe prefetch candidates found", "Review visible navigation and avoid hiding primary same-origin links behind scripts.", "manual", item("Candidates", "None")));
  if (avoid.length > 0) findings.push(finding("prefetch-avoid-list", "Some links should not be prefetched", "Avoid prefetching stateful, private, fragment, or file-download URLs.", "manual", ...avoid.slice(0, 5).map((link) => item(link.url, link.reason))));
  return findings;
}

function repeatViewFindings(first: RepeatViewFilmstripResponse["firstView"], repeat: RepeatViewFilmstripResponse["repeatView"]) {
  const findings: AuditCategoryFinding[] = [];
  if (first.transferSize > 0 && repeat.transferSize / first.transferSize > 0.7) findings.push(finding("repeat-view-cache-weak", "Repeat view still transfers most resources", "Review cache headers for static assets and third-party resources.", "warning", item("Transfer delta", `${formatBytes(first.transferSize)} first vs ${formatBytes(repeat.transferSize)} repeat`)));
  if (repeat.loadEventEnd > first.loadEventEnd * 0.9 && first.loadEventEnd > 0) findings.push(finding("repeat-view-not-faster", "Repeat view is not meaningfully faster", "Check cacheability, server rendering cost, and client boot work that repeats on every navigation.", "warning", item("Load event", `${first.loadEventEnd}ms first vs ${repeat.loadEventEnd}ms repeat`)));
  return findings;
}

function finding(id: string, title: string, description: string, impact: AuditCategoryFinding["impact"], ...items: AuditFindingItem[]): AuditCategoryFinding {
  return { id, title, description, impact, items, score: null, displayValue: null, weight: 1 };
}

function item(label: string, value?: string | null, snippet?: string | null): AuditFindingItem {
  return { label, value, snippet };
}

function noBlockers(findings: AuditCategoryFinding[]) {
  return !findings.some((finding) => finding.impact === "failed");
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function safeUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function formatBytes(bytes: number) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${bytes} B`;
}
