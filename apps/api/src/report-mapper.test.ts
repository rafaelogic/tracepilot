import { describe, expect, it } from "vitest";
import { toReport, toSummary } from "./report-mapper";

describe("toSummary progress", () => {
  it("maps persisted audit progress into the public contract", () => {
    const summary = toSummary({
      id: "run-1",
      mode: "url",
      status: "running",
      input: "https://example.com",
      startUrl: "https://example.com",
      finalUrl: null,
      goal: null,
      device: "desktop",
      label: null,
      error: null,
      performance: null,
      accessibility: null,
      bestPractices: null,
      seo: null,
      agenticBrowsing: {
        score: 50,
        title: "Agentic Browsing",
        description: "Experimental checks",
        checks: []
      },
      settings: {
        lighthousePassCount: 3,
        targetScores: {
          performance: 95,
          accessibility: 90,
          bestPractices: 90,
          seo: 92
        }
      },
      lighthousePasses: {
        passCount: 5,
        aggregation: "median-performance-pass",
        selectedPassIndex: 2,
        lighthouseVersion: "12.8.2",
        passes: []
      },
      progressStage: "running-lighthouse",
      progressPercent: 74,
      progressMessage: "Scoring performance and quality categories.",
      createdAt: new Date("2026-06-24T00:00:00Z"),
      startedAt: new Date("2026-06-24T00:00:01Z"),
      completedAt: null
    });

    expect(summary.progress).toEqual({
      stage: "running-lighthouse",
      percent: 74,
      message: "Scoring performance and quality categories."
    });
    expect(summary.lighthousePasses).toEqual({
      passCount: 5,
      aggregation: "median-performance-pass",
      selectedPassIndex: 2,
      lighthouseVersion: "12.8.2",
      passes: []
    });
    expect(summary.settings).toEqual({
      lighthousePassCount: 3,
      targetScores: {
        performance: 95,
        accessibility: 90,
        bestPractices: 90,
        seo: 92
      }
    });
    expect(summary.agenticBrowsing?.score).toBe(50);
  });

  it("drops malformed persisted agentic browsing data", () => {
    const summary = toSummary({
      id: "run-2",
      mode: "url",
      status: "completed",
      input: "https://example.com",
      startUrl: "https://example.com",
      finalUrl: "https://example.com",
      goal: null,
      device: "mobile",
      label: null,
      error: null,
      performance: 90,
      accessibility: 90,
      bestPractices: 90,
      seo: 90,
      agenticBrowsing: { score: "invalid", checks: "invalid" },
      progressStage: "completed",
      progressPercent: 100,
      progressMessage: "Complete",
      createdAt: new Date("2026-06-24T00:00:00Z"),
      startedAt: null,
      completedAt: new Date("2026-06-24T00:01:00Z")
    });

    expect(summary.agenticBrowsing).toBeUndefined();
  });
});

describe("toReport sections", () => {
  it("maps persisted section screenshots into the public report", () => {
    const report = toReport({
      id: "run-3",
      mode: "url",
      status: "completed",
      input: "https://example.com",
      startUrl: "https://example.com",
      finalUrl: "https://example.com",
      goal: null,
      device: "desktop",
      label: null,
      error: null,
      performance: 90,
      accessibility: 90,
      bestPractices: 90,
      seo: 90,
      progressStage: "completed",
      progressPercent: 100,
      progressMessage: "Complete",
      createdAt: new Date("2026-06-24T00:00:00Z"),
      startedAt: null,
      completedAt: new Date("2026-06-24T00:01:00Z"),
      sections: [{
        id: "section-1",
        label: "Hero",
        selector: "main > section",
        elementHtml: "<section>Hero</section>",
        screenshot: {
          dataUrl: "data:image/png;base64,abc",
          clip: { x: 0, y: 100, width: 1200, height: 700 },
          target: { x: 0, y: 40, width: 1200, height: 320 },
          highlight: true
        },
        top: 100,
        height: 320,
        firstDetectedMs: 10,
        firstVisibleMs: 20,
        contentStableMs: 30,
        renderCompleteMs: 40,
        layoutShiftScore: 0,
        blockingResourceCount: 0
      }]
    });

    expect(report.sections[0].screenshot).toEqual({
      dataUrl: "data:image/png;base64,abc",
      clip: { x: 0, y: 100, width: 1200, height: 700 },
      target: { x: 0, y: 40, width: 1200, height: 320 },
      highlight: true
    });
  });
});
