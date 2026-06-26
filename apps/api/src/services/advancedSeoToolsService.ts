import { chromium, type Browser, type BrowserContext, type Page, type Request, type Response } from "playwright";
import type {
  AuditCategoryFinding,
  AuditFindingItem,
  ContentFreshnessIndexabilityResponse,
  InternalLinkGraphEntry,
  InternalLinkGraphResponse,
  MetadataSocialPreviewResponse,
  StructuredDataAuditResponse,
  StructuredDataItem,
  ThirdPartyScriptInventoryResponse,
  ThirdPartyScriptParty
} from "../../../../packages/shared/types.js";
import { resolveAuditNetwork } from "../audit/network-target.js";

const maxSnippet = 900;

export async function checkStructuredData(url: string): Promise<StructuredDataAuditResponse> {
  return withPage(url, async ({ page, response }) => {
    const items = await page.evaluate<StructuredDataItem[]>(() => {
      return Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map((script) => {
        const raw = script.textContent?.trim() ?? "";
        const errors: string[] = [];
        let parsed: any = null;
        try {
          parsed = JSON.parse(raw);
        } catch (error) {
          errors.push(error instanceof Error ? error.message : "Invalid JSON");
        }
        const entity = Array.isArray(parsed) ? parsed[0] : parsed?.["@graph"]?.[0] ?? parsed;
        if (parsed && !entity?.["@type"]) errors.push("Missing @type");
        if (parsed && entity?.url && typeof entity.url !== "string") errors.push("url must be a string");
        return {
          type: typeof entity?.["@type"] === "string" ? entity["@type"] : null,
          id: typeof entity?.["@id"] === "string" ? entity["@id"] : null,
          valid: errors.length === 0,
          errors,
          snippet: raw.slice(0, maxSnippet)
        };
      });
    });
    const findings = structuredDataFindings(items);
    return {
      url,
      finalUrl: page.url(),
      status: response?.status() ?? null,
      items,
      findings,
      passed: noBlockers(findings)
    };
  });
}

export async function checkMetadataSocial(url: string): Promise<MetadataSocialPreviewResponse> {
  return withPage(url, async ({ page, response }) => {
    const snapshot = await page.evaluate(() => {
      const meta = (selector: string) => document.querySelector<HTMLMetaElement>(selector)?.content.trim() || null;
      return {
        title: document.title.trim() || null,
        description: meta('meta[name="description"]'),
        canonical: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href || null,
        openGraph: {
          title: meta('meta[property="og:title"]'),
          description: meta('meta[property="og:description"]'),
          image: meta('meta[property="og:image"]'),
          url: meta('meta[property="og:url"]'),
          type: meta('meta[property="og:type"]')
        },
        twitter: {
          card: meta('meta[name="twitter:card"]'),
          title: meta('meta[name="twitter:title"]'),
          description: meta('meta[name="twitter:description"]'),
          image: meta('meta[name="twitter:image"]')
        },
        icons: Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel*="icon"]')).map((link) => ({
          rel: link.rel,
          href: link.href,
          sizes: link.sizes?.value || null
        }))
      };
    });
    const findings = metadataFindings(snapshot);
    return {
      url,
      finalUrl: page.url(),
      status: response?.status() ?? null,
      ...snapshot,
      findings,
      passed: noBlockers(findings)
    };
  });
}

export async function checkThirdPartyInventory(url: string): Promise<ThirdPartyScriptInventoryResponse> {
  const firstPartyOrigin = new URL(url).origin;
  const records: Array<{ url: string; type: string }> = [];
  return withPage(url, async ({ page }) => {
    page.on("request", (request: Request) => {
      records.push({ url: request.url(), type: request.resourceType() });
    });
    await page.reload({ waitUntil: "networkidle", timeout: 30_000 }).catch(() => undefined);
    const parties = thirdPartyParties(firstPartyOrigin, records);
    const findings = thirdPartyFindings(parties);
    return {
      url,
      finalUrl: page.url(),
      firstPartyOrigin,
      parties,
      findings,
      passed: noBlockers(findings)
    };
  });
}

export async function checkContentFreshnessIndexability(url: string): Promise<ContentFreshnessIndexabilityResponse> {
  return withPage(url, async ({ page, context, response }) => {
    const snapshot = await page.evaluate(() => {
      const robotsMeta = document.querySelector<HTMLMetaElement>('meta[name="robots"],meta[name="googlebot"]')?.content.trim() || null;
      const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href || null;
      const dateSignals = [
        ...Array.from(document.querySelectorAll("time")).slice(0, 6).map((time) => ({ label: "time", value: time.getAttribute("datetime") || time.textContent?.trim() || "" })),
        ...Array.from(document.querySelectorAll<HTMLMetaElement>('meta[property*="modified"],meta[name*="modified"],meta[property*="published"],meta[name*="published"]')).slice(0, 6).map((meta) => ({ label: meta.getAttribute("property") || meta.name || "date", value: meta.content }))
      ].filter((item) => item.value);
      return { robotsMeta, canonical, dateSignals };
    });
    const sitemapUrl = new URL("/sitemap.xml", new URL(url).origin).toString();
    const sitemap = await context.request.get(sitemapUrl, { timeout: 10_000 }).catch(() => null);
    const findings = freshnessFindings(snapshot, sitemap?.status() ?? null);
    return {
      url,
      finalUrl: page.url(),
      status: response?.status() ?? null,
      robotsMeta: snapshot.robotsMeta,
      canonical: snapshot.canonical,
      sitemapUrl,
      sitemapStatus: sitemap?.status() ?? null,
      dateSignals: snapshot.dateSignals,
      findings,
      passed: noBlockers(findings)
    };
  });
}

export async function checkInternalLinkGraph(url: string): Promise<InternalLinkGraphResponse> {
  const origin = new URL(url).origin;
  return withPage(url, async ({ page, context, response }) => {
    const links = await page.evaluate((pageOrigin) => {
      return Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
        .map((anchor) => ({
          href: anchor.href,
          text: (anchor.textContent ?? "").replace(/\s+/g, " ").trim()
        }))
        .filter((link) => link.href.startsWith(pageOrigin) && !link.href.includes("#"))
        .slice(0, 40);
    }, origin);
    const uniqueUrls = [...new Set([page.url(), ...links.map((link) => link.href)])].slice(0, 16);
    const crawled: InternalLinkGraphEntry[] = [{
      url: page.url(),
      status: response?.status() ?? null,
      title: await page.title(),
      linkCount: links.length
    }];
    const brokenLinks: InternalLinkGraphResponse["brokenLinks"] = [];

    for (const target of uniqueUrls.slice(1)) {
      try {
        const res = await context.request.get(target, { timeout: 10_000 });
        const status = res.status();
        crawled.push({ url: target, status, title: null, linkCount: 0 });
        if (status >= 400) {
          const source = links.find((link) => link.href === target);
          brokenLinks.push({ from: page.url(), to: target, status, text: source?.text ?? "" });
        }
      } catch (error) {
        const source = links.find((link) => link.href === target);
        crawled.push({ url: target, status: null, title: null, linkCount: 0, error: error instanceof Error ? error.message : "Request failed" });
        brokenLinks.push({ from: page.url(), to: target, status: null, text: source?.text ?? "" });
      }
    }

    const findings = linkGraphFindings(crawled, brokenLinks, links);
    return { url, origin, crawled, brokenLinks, findings, passed: noBlockers(findings) };
  });
}

async function withPage<T>(url: string, run: (input: { browser: Browser; context: BrowserContext; page: Page; response: Response | null }) => Promise<T>) {
  const auditNetwork = await resolveAuditNetwork(url);
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true, args: auditNetwork.chromiumArgs });
    const context = await browser.newContext({ ignoreHTTPSErrors: auditNetwork.ignoreHTTPSErrors });
    const page = await context.newPage();
    const response = await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 }).catch(() => null);
    return await run({ browser, context, page, response });
  } finally {
    await browser?.close();
  }
}

export function structuredDataFindings(items: StructuredDataItem[]) {
  const findings: AuditCategoryFinding[] = [];
  if (items.length === 0) findings.push(finding("structured-data-missing", "No JSON-LD structured data found", "Add JSON-LD for the primary entity when rich results or entity clarity matter.", "warning", item("JSON-LD", "Missing")));
  const invalid = items.filter((entry) => !entry.valid);
  if (invalid.length) findings.push(finding("structured-data-invalid", "Structured data contains invalid entities", "Fix invalid JSON-LD syntax and required entity fields.", "failed", ...invalid.map((entry) => item(entry.type ?? "Unknown entity", entry.errors.join(", "), entry.snippet))));
  return findings;
}

function metadataFindings(snapshot: { title: string | null; description: string | null; canonical: string | null; openGraph: Record<string, string | null>; twitter: Record<string, string | null>; icons: Array<unknown> }) {
  const findings: AuditCategoryFinding[] = [];
  if (!snapshot.openGraph.title || !snapshot.openGraph.description || !snapshot.openGraph.image) findings.push(finding("open-graph-incomplete", "Open Graph preview is incomplete", "Add og:title, og:description, and og:image for reliable sharing previews.", "warning", item("Open Graph", "Missing required preview tags")));
  if (!snapshot.twitter.card || !snapshot.twitter.image) findings.push(finding("twitter-card-incomplete", "Twitter/X card preview is incomplete", "Add twitter:card and twitter:image when social previews matter.", "warning", item("Twitter card", "Missing card or image")));
  if (snapshot.icons.length === 0) findings.push(finding("favicon-missing", "No favicon links found", "Add icon links so browser tabs and previews identify the site.", "warning", item("Icons", "Missing")));
  if (!snapshot.title) findings.push(finding("social-title-missing", "Document title is missing", "Add a title before configuring social previews.", "failed", item("Title", "Missing")));
  if (!snapshot.description) findings.push(finding("social-description-missing", "Meta description is missing", "Add a meta description that can align with social preview copy.", "warning", item("Description", "Missing")));
  if (!snapshot.canonical) findings.push(finding("social-canonical-missing", "Canonical URL is missing", "Add canonical URL to reduce duplicate preview/indexing ambiguity.", "warning", item("Canonical", "Missing")));
  return findings;
}

function thirdPartyParties(firstPartyOrigin: string, records: Array<{ url: string; type: string }>): ThirdPartyScriptParty[] {
  const groups = new Map<string, Array<{ url: string; type: string }>>();
  records.forEach((record) => {
    let origin = "";
    try {
      origin = new URL(record.url).origin;
    } catch {
      return;
    }
    if (origin === firstPartyOrigin) return;
    groups.set(origin, [...(groups.get(origin) ?? []), record]);
  });
  return [...groups.entries()].map(([origin, entries]) => ({
    origin,
    requestCount: entries.length,
    scriptCount: entries.filter((entry) => entry.type === "script").length,
    resourceTypes: [...new Set(entries.map((entry) => entry.type))].sort(),
    urls: [...new Set(entries.map((entry) => entry.url))].slice(0, 8)
  })).sort((a, b) => b.requestCount - a.requestCount);
}

function thirdPartyFindings(parties: ThirdPartyScriptParty[]) {
  const findings: AuditCategoryFinding[] = [];
  const scriptParties = parties.filter((party) => party.scriptCount > 0);
  if (scriptParties.length > 5) findings.push(finding("many-third-party-script-origins", "Many third-party script origins detected", "Audit ownership, purpose, and loading priority for each script provider.", "warning", ...scriptParties.map((party) => item(party.origin, `${party.scriptCount} script requests`))));
  const noisy = parties.filter((party) => party.requestCount >= 10);
  if (noisy.length) findings.push(finding("high-third-party-request-count", "Third-party origin has many requests", "Review whether this provider is necessary on initial page load.", "warning", ...noisy.map((party) => item(party.origin, `${party.requestCount} requests`))));
  return findings;
}

function freshnessFindings(snapshot: { robotsMeta: string | null; canonical: string | null; dateSignals: Array<{ label: string; value: string }> }, sitemapStatus: number | null) {
  const findings: AuditCategoryFinding[] = [];
  if (snapshot.robotsMeta && /noindex/i.test(snapshot.robotsMeta)) findings.push(finding("page-noindex", "Page is marked noindex", "Remove noindex if this page should appear in search results.", "failed", item("Robots meta", snapshot.robotsMeta)));
  if (!snapshot.canonical) findings.push(finding("indexability-canonical-missing", "Canonical URL is missing", "Add canonical URL for indexable pages and filtered URLs.", "warning", item("Canonical", "Missing")));
  if (sitemapStatus == null || sitemapStatus >= 400) findings.push(finding("sitemap-unavailable", "Sitemap is unavailable", "Expose /sitemap.xml or reference a sitemap in robots.txt.", "warning", item("Sitemap", sitemapStatus == null ? "Fetch failed" : `HTTP ${sitemapStatus}`)));
  if (snapshot.dateSignals.length === 0) findings.push(finding("freshness-signals-missing", "No freshness date signals found", "For editorial, listing, or catalog pages, expose published/updated dates where useful.", "warning", item("Dates", "Missing")));
  return findings;
}

function linkGraphFindings(crawled: InternalLinkGraphEntry[], brokenLinks: InternalLinkGraphResponse["brokenLinks"], links: Array<{ href: string; text: string }>) {
  const findings: AuditCategoryFinding[] = [];
  if (brokenLinks.length) findings.push(finding("broken-internal-links", "Broken internal links found", "Fix or remove links returning errors.", "failed", ...brokenLinks.map((link) => item(link.to, link.status == null ? "Fetch failed" : `HTTP ${link.status}`, link.text))));
  const vague = links.filter((link) => /^(click here|read more|more|learn more)$/i.test(link.text)).slice(0, 8);
  if (vague.length) findings.push(finding("vague-internal-anchor-text", "Internal links use vague anchor text", "Use descriptive anchors that explain the destination.", "warning", ...vague.map((link) => item(link.href, link.text))));
  if (crawled.length <= 1) findings.push(finding("few-internal-links", "Few crawlable internal links found", "Expose relevant internal links so users and crawlers can discover related pages.", "warning", item("Internal links", `${crawled.length} crawled page`)));
  return findings;
}

function noBlockers(findings: AuditCategoryFinding[]) {
  return findings.every((finding) => finding.impact !== "failed");
}

function item(label: string, value: string, snippet?: string | null): AuditFindingItem {
  return { label, value, snippet: snippet ?? null };
}

function finding(id: string, title: string, description: string, impact: AuditCategoryFinding["impact"], ...items: AuditFindingItem[]): AuditCategoryFinding {
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
