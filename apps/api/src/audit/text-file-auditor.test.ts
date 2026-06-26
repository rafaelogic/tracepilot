import { describe, expect, it } from "vitest";
import { buildTextFileFindings } from "./text-file-auditor";

describe("buildTextFileFindings", () => {
  it("reports blockers when robots.txt is missing and llms.txt is not structured", () => {
    const findings = buildTextFileFindings("https://example.com/products", {
      robots: {
        url: "https://example.com/robots.txt",
        status: 404,
        contentType: "text/plain",
        body: "Not found"
      },
      llms: {
        url: "https://example.com/llms.txt",
        status: 200,
        contentType: "text/plain",
        body: "Documentation links\nhttps://example.com/docs"
      }
    });

    expect(findings.map((finding) => finding.id)).toEqual([
      "robots-txt-missing",
      "llms-txt-missing-h1",
      "llms-txt-missing-summary",
      "llms-txt-missing-links"
    ]);
    expect(findings.every((finding) => finding.impact === "failed")).toBe(true);
    expect(findings[0].items[0]).toMatchObject({
      label: "https://example.com/robots.txt",
      value: "HTTP 404"
    });
  });

  it("keeps valid files clean and warns for recommended discovery metadata", () => {
    const findings = buildTextFileFindings("https://example.com/", {
      robots: {
        url: "https://example.com/robots.txt",
        status: 200,
        contentType: "text/plain; charset=utf-8",
        body: "User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml"
      },
      llms: {
        url: "https://example.com/llms.txt",
        status: 200,
        contentType: "text/markdown",
        body: "# Example\n\n> Official product docs for Example.\n\n## Docs\n\n- [API](https://example.com/docs/api)\n- [Pricing](https://example.com/pricing)"
      }
    });

    expect(findings).toEqual([]);
  });

  it("flags robots.txt syntax that can block crawling unexpectedly", () => {
    const findings = buildTextFileFindings("https://example.com/", {
      robots: {
        url: "https://example.com/robots.txt",
        status: 200,
        contentType: "text/html",
        body: "<!doctype html>\nUser-agent: *\nDisallow: /\n"
      },
      llms: {
        url: "https://example.com/llms.txt",
        status: 404,
        contentType: "text/plain",
        body: ""
      }
    });

    expect(findings.map((finding) => finding.id)).toEqual([
      "robots-txt-html-response",
      "robots-txt-blocks-all-crawlers",
      "robots-txt-missing-sitemap",
      "llms-txt-missing"
    ]);
    expect(findings.find((finding) => finding.id === "robots-txt-missing-sitemap")?.impact).toBe("warning");
  });
});

describe("auditTextFiles", () => {
  it("uses the provided fetcher for root robots and llms files", async () => {
    const requested: string[] = [];
    const { auditTextFiles } = await import("./text-file-auditor");
    const findings = await auditTextFiles("https://example.com/products", async (url) => {
      requested.push(url);
      return {
        url,
        status: 200,
        contentType: url.endsWith("/robots.txt") ? "text/plain" : "text/markdown",
        body: url.endsWith("/robots.txt")
          ? "User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml"
          : "# Example\n\n> Summary\n\n- [Docs](https://example.com/docs)"
      };
    });

    expect(requested).toEqual([
      "https://example.com/robots.txt",
      "https://example.com/llms.txt"
    ]);
    expect(findings).toEqual([]);
  });
});
