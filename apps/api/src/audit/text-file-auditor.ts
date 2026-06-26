import type { AuditCategoryFinding } from "../../../../packages/shared/types.js";

export interface TextFileResponse {
  url: string;
  status: number | null;
  contentType: string | null;
  body: string;
  error?: string;
}

export type TextFileFetcher = (url: string) => Promise<TextFileResponse>;

interface TextFileResponses {
  robots: TextFileResponse;
  llms: TextFileResponse;
}

const MAX_TEXT_FILE_BYTES = 512 * 1024;

export async function auditTextFiles(finalUrl: string, fetcher: TextFileFetcher = fetchTextFile): Promise<AuditCategoryFinding[]> {
  const origin = new URL(finalUrl).origin;
  const [robots, llms] = await Promise.all([
    fetcher(new URL("/robots.txt", origin).toString()),
    fetcher(new URL("/llms.txt", origin).toString())
  ]);

  return buildTextFileFindings(finalUrl, { robots, llms });
}

export function buildTextFileFindings(_finalUrl: string, responses: TextFileResponses): AuditCategoryFinding[] {
  return [
    ...robotsFindings(responses.robots),
    ...llmsFindings(responses.llms)
  ];
}

async function fetchTextFile(url: string): Promise<TextFileResponse> {
  try {
    const response = await fetch(url, {
      headers: {
        accept: "text/plain,text/markdown,text/*;q=0.9,*/*;q=0.1"
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000)
    });
    const contentType = response.headers.get("content-type");
    const body = await readBoundedText(response);

    return {
      url,
      status: response.status,
      contentType,
      body
    };
  } catch (error) {
    return {
      url,
      status: null,
      contentType: null,
      body: "",
      error: error instanceof Error ? error.message : "Unable to fetch text file"
    };
  }
}

async function readBoundedText(response: Response) {
  const text = await response.text();
  return text.length > MAX_TEXT_FILE_BYTES ? text.slice(0, MAX_TEXT_FILE_BYTES) : text;
}

function robotsFindings(response: TextFileResponse): AuditCategoryFinding[] {
  if (!isSuccessful(response.status)) {
    return [finding({
      id: "robots-txt-missing",
      title: "robots.txt is missing or unavailable",
      description: "Search and AI crawlers expect a standards-compliant robots.txt file at the site root.",
      impact: "failed",
      item: responseItem(response, "Add /robots.txt at the origin root with at least a User-agent group and explicit crawl policy.")
    })];
  }

  const findings: AuditCategoryFinding[] = [];
  const lines = robotsLines(response.body);
  const directives = lines.map(parseRobotsDirective).filter((directive): directive is { key: string; value: string } => directive !== null);
  const hasUserAgent = directives.some((directive) => directive.key === "user-agent");
  const hasCrawlRule = directives.some((directive) => directive.key === "allow" || directive.key === "disallow");
  const hasSitemap = directives.some((directive) => directive.key === "sitemap");
  const disallowsEverything = directives.some((directive) => directive.key === "disallow" && directive.value.trim() === "/");

  if (looksLikeHtml(response)) {
    findings.push(finding({
      id: "robots-txt-html-response",
      title: "robots.txt returns HTML instead of crawler directives",
      description: "robots.txt should be plain text, not an app shell, error page, or redirect landing page.",
      impact: "failed",
      item: responseItem(response, "Serve a text/plain robots.txt response from the site root.")
    }));
  }

  if (!hasUserAgent) {
    findings.push(finding({
      id: "robots-txt-missing-user-agent",
      title: "robots.txt is missing a User-agent directive",
      description: "Each robots.txt group needs a User-agent line so crawlers know which rules apply.",
      impact: "failed",
      item: responseItem(response, "Add a User-agent directive such as 'User-agent: *'.")
    }));
  }

  if (!hasCrawlRule) {
    findings.push(finding({
      id: "robots-txt-missing-crawl-rule",
      title: "robots.txt does not declare Allow or Disallow rules",
      description: "A crawl policy should make the intended access explicit for crawlers and AI agents.",
      impact: "failed",
      item: responseItem(response, "Add an Allow or Disallow directive under each User-agent group.")
    }));
  }

  if (disallowsEverything) {
    findings.push(finding({
      id: "robots-txt-blocks-all-crawlers",
      title: "robots.txt blocks the whole site",
      description: "Disallow: / prevents matching crawlers from indexing public pages and can hide the audited experience from search.",
      impact: "failed",
      item: responseItem(response, "Remove blanket Disallow rules for public production pages, or scope them to private paths.")
    }));
  }

  if (!hasSitemap) {
    findings.push(finding({
      id: "robots-txt-missing-sitemap",
      title: "robots.txt does not advertise a sitemap",
      description: "A Sitemap directive helps crawlers discover canonical URLs and content updates.",
      impact: "warning",
      item: responseItem(response, "Add a Sitemap directive with an absolute sitemap URL.")
    }));
  }

  return findings;
}

function llmsFindings(response: TextFileResponse): AuditCategoryFinding[] {
  if (!isSuccessful(response.status)) {
    return [finding({
      id: "llms-txt-missing",
      title: "llms.txt is missing or unavailable",
      description: "llms.txt gives AI assistants a concise, structured map of the site's important documentation and product pages.",
      impact: "failed",
      item: responseItem(response, "Add /llms.txt at the origin root using the llms.txt Markdown structure.")
    })];
  }

  const findings: AuditCategoryFinding[] = [];
  const text = response.body.trim();
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const hasH1 = lines.some((line) => /^#\s+\S/.test(line));
  const hasSummary = lines.some((line) => /^>\s+\S/.test(line));
  const hasMarkdownLinkList = lines.some((line) => /^-\s+\[[^\]]+\]\([^)]+\)/.test(line));

  if (looksLikeHtml(response)) {
    findings.push(finding({
      id: "llms-txt-html-response",
      title: "llms.txt returns HTML instead of Markdown",
      description: "llms.txt should be a concise Markdown file served from the site root.",
      impact: "failed",
      item: responseItem(response, "Serve a Markdown llms.txt file instead of an HTML app or error page.")
    }));
  }

  if (!hasH1) {
    findings.push(finding({
      id: "llms-txt-missing-h1",
      title: "llms.txt is missing a top-level title",
      description: "The llms.txt structure starts with an H1 naming the site, product, or documentation set.",
      impact: "failed",
      item: responseItem(response, "Start llms.txt with a single '# Site or product name' heading.")
    }));
  }

  if (!hasSummary) {
    findings.push(finding({
      id: "llms-txt-missing-summary",
      title: "llms.txt is missing a summary blockquote",
      description: "A short blockquote summary tells AI assistants what the site is and which context matters most.",
      impact: "failed",
      item: responseItem(response, "Add a short '> Summary...' paragraph after the H1.")
    }));
  }

  if (!hasMarkdownLinkList) {
    findings.push(finding({
      id: "llms-txt-missing-links",
      title: "llms.txt does not list important Markdown links",
      description: "AI assistants need a curated set of links to docs, policies, pricing, APIs, or product pages.",
      impact: "failed",
      item: responseItem(response, "Add Markdown list items such as '- [Docs](https://example.com/docs)'.")
    }));
  }

  return findings;
}

function robotsLines(body: string) {
  return body
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*/, "").trim())
    .filter(Boolean);
}

function parseRobotsDirective(line: string) {
  const match = line.match(/^([A-Za-z][\w-]*)\s*:\s*(.*)$/);
  if (!match) return null;
  return {
    key: match[1].toLowerCase(),
    value: match[2].trim()
  };
}

function isSuccessful(status: number | null) {
  return status != null && status >= 200 && status < 300;
}

function looksLikeHtml(response: TextFileResponse) {
  return response.contentType?.toLowerCase().includes("text/html")
    || /^\s*<!doctype html/i.test(response.body)
    || /^\s*<html[\s>]/i.test(response.body);
}

function responseItem(response: TextFileResponse, fix: string) {
  return {
    label: response.url,
    value: response.error ?? (response.status == null ? "Fetch failed" : `HTTP ${response.status}`),
    selector: null,
    snippet: firstLines(response.body),
    url: response.url,
    fix
  };
}

function firstLines(body: string) {
  const snippet = body.split(/\r?\n/).slice(0, 8).join("\n").trim();
  return snippet || null;
}

function finding({
  id,
  title,
  description,
  impact,
  item
}: {
  id: string;
  title: string;
  description: string;
  impact: AuditCategoryFinding["impact"];
  item: ReturnType<typeof responseItem>;
}): AuditCategoryFinding {
  return {
    id,
    title,
    description,
    score: impact === "warning" ? 50 : 0,
    displayValue: item.value,
    weight: impact === "warning" ? 1 : 3,
    impact,
    items: [{
      label: item.label,
      value: item.value,
      selector: item.selector,
      snippet: item.snippet,
      url: item.url
    }]
  };
}
