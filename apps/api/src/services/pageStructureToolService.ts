import { chromium, type Browser } from "playwright";
import type { AuditCategoryFinding, AuditFindingItem, PageStructureAuditResponse, PageStructureHeading } from "../../../../packages/shared/types.js";
import { resolveAuditNetwork } from "../audit/network-target.js";

interface PageStructureSnapshot {
  url: string;
  finalUrl: string;
  status: number | null;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  headings: PageStructureHeading[];
  h1Contexts: Array<{
    text: string;
    selector: string;
    parentText: string;
    nextText: string;
  }>;
}

export async function checkPageStructure(url: string): Promise<PageStructureAuditResponse> {
  const auditNetwork = await resolveAuditNetwork(url);
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: auditNetwork.chromiumArgs
    });
    const page = await browser.newPage({
      ignoreHTTPSErrors: auditNetwork.ignoreHTTPSErrors
    });
    const response = await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    const snapshot = await page.evaluate<PageStructureSnapshot, string>((inputUrl) => {
      function cssPath(element: Element) {
        const parts: string[] = [];
        let node: Element | null = element;
        while (node && parts.length < 5) {
          const current: Element = node;
          const tag = current.tagName.toLowerCase();
          const id = current.id ? `#${CSS.escape(current.id)}` : "";
          if (id) {
            parts.unshift(`${tag}${id}`);
            break;
          }
          const parent: Element | null = current.parentElement;
          if (!parent) {
            parts.unshift(tag);
            break;
          }
          const siblings = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
          const index = siblings.indexOf(current) + 1;
          parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${index})` : tag);
          node = parent;
        }
        return parts.join(" > ");
      }

      const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6")).map((heading) => ({
        level: Number(heading.tagName.slice(1)),
        text: (heading.textContent ?? "").replace(/\s+/g, " ").trim(),
        selector: cssPath(heading)
      }));
      const h1Contexts = Array.from(document.querySelectorAll("h1")).map((heading) => ({
        text: (heading.textContent ?? "").replace(/\s+/g, " ").trim(),
        selector: cssPath(heading),
        parentText: (heading.parentElement?.textContent ?? "").replace(/\s+/g, " ").trim(),
        nextText: (heading.nextElementSibling?.textContent ?? "").replace(/\s+/g, " ").trim()
      }));

      return {
        url: inputUrl,
        finalUrl: window.location.href,
        status: null,
        title: document.title.trim() || null,
        metaDescription: document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content.trim() || null,
        canonical: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href || null,
        headings,
        h1Contexts
      };
    }, url);

    snapshot.status = response?.status() ?? null;
    const findings = buildPageStructureFindings(snapshot);
    return {
      url,
      finalUrl: snapshot.finalUrl,
      status: snapshot.status,
      title: snapshot.title,
      metaDescription: snapshot.metaDescription,
      canonical: snapshot.canonical,
      headings: snapshot.headings,
      findings,
      passed: findings.filter((finding) => finding.impact === "failed").length === 0
    };
  } finally {
    await browser?.close();
  }
}

export function buildPageStructureFindings(snapshot: PageStructureSnapshot): AuditCategoryFinding[] {
  const findings: AuditCategoryFinding[] = [];
  const h1s = snapshot.headings.filter((heading) => heading.level === 1);

  if (!snapshot.title) {
    findings.push(finding("page-title-missing", "Page title is missing", "Add a concise, unique <title> that describes the page purpose.", "failed", evidence("Document title", "Missing")));
  } else if (snapshot.title.length < 15 || snapshot.title.length > 65) {
    findings.push(finding("page-title-length", "Page title length needs review", "Keep the title descriptive without being truncated in search results.", "warning", evidence("Document title", `${snapshot.title.length} characters`, snapshot.title)));
  }

  if (!snapshot.metaDescription) {
    findings.push(finding("meta-description-missing", "Meta description is missing", "Add a page-specific meta description so search snippets and AI summaries have stable context.", "warning", evidence("Meta description", "Missing")));
  } else if (snapshot.metaDescription.length < 50 || snapshot.metaDescription.length > 170) {
    findings.push(finding("meta-description-length", "Meta description length needs review", "Keep the description specific and long enough to summarize the page without being overlong.", "warning", evidence("Meta description", `${snapshot.metaDescription.length} characters`, snapshot.metaDescription)));
  }

  if (!snapshot.canonical) {
    findings.push(finding("canonical-missing", "Canonical URL is missing", "Add a canonical link when the page can be reached through filtered, localized, or duplicate URLs.", "warning", evidence("Canonical", "Missing")));
  }

  if (h1s.length === 0) {
    findings.push(finding("h1-missing", "Page is missing an H1", "Add one visible H1 that names the page topic or primary offer.", "failed", evidence("Headings", "No H1 found")));
  }

  if (h1s.length > 1) {
    findings.push(finding("multiple-h1", "Page has multiple H1 headings", "Use one primary H1 and demote secondary section titles to H2/H3 so crawlers can identify the main topic.", "failed", ...h1s.map((heading) => headingEvidence(heading))));
  }

  snapshot.headings.forEach((heading) => {
    if (!heading.text) {
      findings.push(finding("empty-heading", "Heading text is empty", "Remove empty heading tags or replace them with meaningful text.", "failed", headingEvidence(heading, "Empty")));
    }
  });

  for (let index = 1; index < snapshot.headings.length; index += 1) {
    const previous = snapshot.headings[index - 1];
    const current = snapshot.headings[index];
    if (current.level - previous.level > 1) {
      findings.push(finding("heading-level-skip", "Heading levels skip hierarchy", "Do not jump heading levels. Move from H1 to H2, H2 to H3, and so on.", "warning", headingEvidence(current, `Previous H${previous.level} -> current H${current.level}`)));
    }
  }

  snapshot.h1Contexts.forEach((context) => {
    const h1Words = wordCount(context.text);
    const parentWords = wordCount(context.parentText);
    const nextWords = wordCount(context.nextText);
    const likelySplit = context.text.length > 0
      && h1Words <= 3
      && (parentWords >= h1Words + 4 || nextWords >= 4);
    if (likelySplit) {
      findings.push(finding(
        "h1-content-split",
        "H1 content appears split across other tags",
        "Keep the complete page title inside one H1. Decorative spans inside the H1 are fine, but do not place important title words in sibling paragraphs or divs.",
        "warning",
        {
          label: context.selector,
          value: context.text,
          selector: context.selector,
          snippet: context.parentText || context.nextText || null
        }
      ));
    }
  });

  return findings;
}

function wordCount(value: string) {
  return value.split(/\s+/).filter(Boolean).length;
}

function headingEvidence(heading: PageStructureHeading, value = `H${heading.level}`): AuditFindingItem {
  return {
    label: heading.text || heading.selector,
    value,
    selector: heading.selector,
    snippet: heading.text
  };
}

function evidence(label: string, value: string, snippet?: string | null): AuditFindingItem {
  return {
    label,
    value,
    snippet: snippet ?? null
  };
}

function finding(
  id: string,
  title: string,
  description: string,
  impact: AuditCategoryFinding["impact"],
  ...items: AuditFindingItem[]
): AuditCategoryFinding {
  return {
    id,
    title,
    description,
    score: impact === "failed" ? 0 : 50,
    displayValue: `${items.length} item${items.length === 1 ? "" : "s"}`,
    weight: impact === "failed" ? 3 : 1,
    impact,
    items
  };
}
