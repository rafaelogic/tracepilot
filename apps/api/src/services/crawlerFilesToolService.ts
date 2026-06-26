import { chromium, type Browser, type BrowserContext } from "playwright";
import type { CrawlerFileAuditFile, CrawlerFilesAuditResponse } from "../../../../packages/shared/types.js";
import { buildTextFileFindings, type TextFileResponse } from "../audit/text-file-auditor.js";
import { resolveAuditNetwork } from "../audit/network-target.js";

export async function checkCrawlerFiles(url: string): Promise<CrawlerFilesAuditResponse> {
  const origin = new URL(url).origin;
  const robotsUrl = new URL("/robots.txt", origin).toString();
  const llmsUrl = new URL("/llms.txt", origin).toString();
  const auditNetwork = await resolveAuditNetwork(url);
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: auditNetwork.chromiumArgs
    });
    const context = await browser.newContext({
      ignoreHTTPSErrors: auditNetwork.ignoreHTTPSErrors
    });
    const [robots, llms] = await Promise.all([
      fetchTextFileWithBrowser(context, robotsUrl),
      fetchTextFileWithBrowser(context, llmsUrl)
    ]);
    const findings = buildTextFileFindings(url, { robots, llms });

    return {
      url,
      origin,
      files: [
        fileSummary("robots", robots),
        fileSummary("llms", llms)
      ],
      findings,
      passed: findings.filter((finding) => finding.impact === "failed").length === 0
    };
  } finally {
    await browser?.close();
  }
}

async function fetchTextFileWithBrowser(context: BrowserContext, url: string): Promise<TextFileResponse> {
  const page = await context.newPage();
  try {
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 10_000
    });
    const body = response ? await response.text() : "";

    return {
      url,
      status: response?.status() ?? null,
      contentType: response?.headers()["content-type"] ?? null,
      body: body.length > 512 * 1024 ? body.slice(0, 512 * 1024) : body
    };
  } catch (error) {
    return {
      url,
      status: null,
      contentType: null,
      body: "",
      error: error instanceof Error ? error.message : "Unable to fetch text file"
    };
  } finally {
    await page.close();
  }
}

function fileSummary(kind: CrawlerFileAuditFile["kind"], response: TextFileResponse): CrawlerFileAuditFile {
  return {
    kind,
    url: response.url,
    status: response.status,
    contentType: response.contentType,
    ok: response.status != null && response.status >= 200 && response.status < 300,
    snippet: firstLines(response.body),
    error: response.error
  };
}

function firstLines(body: string) {
  const snippet = body.split(/\r?\n/).slice(0, 12).join("\n").trim();
  return snippet || null;
}
