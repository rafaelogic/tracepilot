import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildPageStructureSummary, buildToolFixPrompt, ToolsPage } from "./ToolsPage";

describe("ToolsPage", () => {
  it("renders the crawler files tool as the first standalone tool", () => {
    const html = renderToStaticMarkup(<ToolsPage />);

    expect(html).toContain("Tools");
    expect(html).toContain("Crawler Files");
    expect(html).toContain("Tools navigation");
    expect(html).toContain("robots.txt + llms.txt");
    expect(html).toContain("Page Structure");
    expect(html).toContain("Headings + metadata");
    expect(html).toContain("Structured Data");
    expect(html).toContain("Internal Links");
    expect(html).toContain("Social Preview");
    expect(html).toContain("Third Parties");
    expect(html).toContain("Indexability");
    expect(html).toContain("JS Execution");
    expect(html).toContain("Unused Coverage");
    expect(html).toContain("Bundle Map");
    expect(html).toContain("Images");
    expect(html).toContain("Critical CSS");
    expect(html).toContain("RUM Snippet");
    expect(html).toContain("3P Mitigation");
    expect(html).toContain("Prefetch");
    expect(html).toContain("Repeat View");
    expect(html).toContain("robots.txt");
    expect(html).toContain("llms.txt");
    expect(html).toContain("Check files");
  });

  it("hides the resolve prompt until an analysis result exists", () => {
    const html = renderToStaticMarkup(<ToolsPage initialTool="page-structure" />);

    expect(html.indexOf("Target URL")).toBeGreaterThan(-1);
    expect(html).not.toContain("Resolve issues prompt");
  });

  it("renders the page structure tool from its route", () => {
    const html = renderToStaticMarkup(<ToolsPage initialTool="page-structure" />);

    expect(html).toContain("Page Structure");
    expect(html).toContain("Analyze page");
    expect(html).toContain("split H1 content");
  });

  it("renders the structured data tool from its route", () => {
    const html = renderToStaticMarkup(<ToolsPage initialTool="structured-data" />);

    expect(html).toContain("Structured Data");
    expect(html).toContain("Validate schema");
  });

  it("renders the JavaScript execution profiler from its route", () => {
    const html = renderToStaticMarkup(<ToolsPage initialTool="js-execution-profile" />);

    expect(html).toContain("JavaScript Execution Profiler");
    expect(html).toContain("Profile JS");
  });

  it("builds a resolve prompt with the tool findings and evidence", () => {
    const prompt = buildToolFixPrompt({
      toolTitle: "Page Structure",
      targetUrl: "https://example.com/products",
      findings: [
        {
          id: "multiple-h1",
          title: "Multiple H1 tags detected",
          description: "The page has two rendered H1 elements.",
          score: null,
          displayValue: "2 H1 tags",
          weight: 1,
          impact: "failed",
          items: [
            {
              label: "Hero heading",
              selector: "h1:nth-of-type(1)",
              snippet: "<h1>Products</h1>"
            }
          ]
        }
      ]
    });

    expect(prompt).toContain("Resolve the Page Structure issues reported by Tracepilot.");
    expect(prompt).toContain("https://example.com/products");
    expect(prompt).toContain("Multiple H1 tags detected");
    expect(prompt).toContain("The page has two rendered H1 elements.");
    expect(prompt).toContain("h1:nth-of-type(1)");
    expect(prompt).toContain("<h1>Products</h1>");
    expect(prompt).toContain("<untrusted_tool_findings>");
    expect(prompt).toContain("Run this Tracepilot tool again");
  });

  it("summarizes page structure data for visualization", () => {
    const summary = buildPageStructureSummary({
      url: "https://example.com",
      finalUrl: "https://example.com",
      status: 200,
      title: "Example",
      metaDescription: null,
      canonical: "https://example.com",
      passed: false,
      headings: [
        { level: 1, text: "Products", selector: "h1" },
        { level: 3, text: "Featured", selector: "h3" },
        { level: 3, text: "", selector: "section h3" }
      ],
      findings: [
        { id: "heading-skip", title: "Heading level skipped", description: null, score: null, displayValue: null, weight: 1, impact: "warning", items: [] }
      ]
    });

    expect(summary.totalHeadings).toBe(3);
    expect(summary.h1Count).toBe(1);
    expect(summary.deepestLevel).toBe(3);
    expect(summary.metadataComplete).toBe(3);
    expect(summary.emptyHeadings).toBe(1);
    expect(summary.levelCounts.find((item) => item.level === 3)?.count).toBe(2);
  });
});
