import { describe, expect, it } from "vitest";
import {
  buildAgenticBrowsingResult,
  buildFailedLighthousePass,
  buildLighthouseRecheckResponse,
  buildSinglePassResult,
  selectMedianLighthouseResult,
  type LighthouseSinglePassResult
} from "./lighthouse";

const passingCategories = {
  performance: { score: 0.91 },
  accessibility: { score: 0.94 },
  "best-practices": { score: 0.92 },
  seo: { score: 0.96 }
};

describe("buildLighthouseRecheckResponse", () => {
  it("returns scores, target status, metrics, and capped diagnostics", () => {
    const response = buildLighthouseRecheckResponse(passingCategories, {
      "first-contentful-paint": { displayValue: "1.2 s" },
      "largest-contentful-paint": { displayValue: "1.8 s" },
      "total-blocking-time": { displayValue: "120 ms" },
      "cumulative-layout-shift": { displayValue: "0.02" },
      "speed-index": { displayValue: "2.1 s" },
      "render-blocking-resources": {
        id: "render-blocking-resources",
        title: "Eliminate render-blocking resources",
        score: 0,
        displayValue: "Potential savings of 580 ms",
        details: {
          type: "opportunity",
          items: Array.from({ length: 7 }, (_, index) => ({
            url: `https://example.com/style-${index}.css`,
            wastedMs: 580 - index
          }))
        }
      },
      "unused-javascript": {
        id: "unused-javascript",
        title: "Reduce unused JavaScript",
        score: 0,
        displayValue: "Potential savings of 120 KiB",
        details: {
          type: "diagnostic",
          items: [{ url: "https://example.com/app.js", wastedBytes: 120 * 1024 }]
        }
      }
    });

    expect(response.scores).toEqual({
      performance: 91,
      accessibility: 94,
      bestPractices: 92,
      seo: 96
    });
    expect(response.passedTarget).toBe(true);
    expect(response.target).toEqual({
      performance: 90,
      accessibility: 90,
      bestPractices: 90,
      seo: 90
    });
    expect(response.metrics).toEqual({
      firstContentfulPaint: "1.2 s",
      largestContentfulPaint: "1.8 s",
      totalBlockingTime: "120 ms",
      cumulativeLayoutShift: "0.02",
      speedIndex: "2.1 s"
    });
    expect(response.opportunities).toHaveLength(1);
    expect(response.opportunities[0].items).toHaveLength(5);
    expect(response.diagnostics).toEqual([
      {
        id: "unused-javascript",
        title: "Reduce unused JavaScript",
        displayValue: "Potential savings of 120 KiB",
        score: 0,
        items: [
          {
            label: "https://example.com/app.js",
            value: "120 KB potential savings",
            selector: null,
            snippet: null,
            url: "https://example.com/app.js"
          }
        ]
      }
    ]);
  });

  it("fails the target when any score is below 90 or unavailable", () => {
    expect(buildLighthouseRecheckResponse({
      ...passingCategories,
      performance: { score: 0.89 }
    }, {}).passedTarget).toBe(false);

    expect(buildLighthouseRecheckResponse({
      ...passingCategories,
      seo: { score: null }
    }, {}).passedTarget).toBe(false);
  });

  it("uses custom category targets when provided", () => {
    const response = buildLighthouseRecheckResponse(passingCategories, {}, {
      performance: 95,
      accessibility: 90,
      bestPractices: 90,
      seo: 90
    });

    expect(response.target.performance).toBe(95);
    expect(response.passedTarget).toBe(false);
  });
});

describe("selectMedianLighthouseResult", () => {
  it("uses the middle performance score from five successful passes", () => {
    const result = selectMedianLighthouseResult([
      pass(0, 71),
      pass(1, 95),
      pass(2, 82),
      pass(3, 60),
      pass(4, 88)
    ]);

    expect(result.performance).toBe(82);
    expect(result.lighthousePasses?.selectedPassIndex).toBe(2);
    expect(result.lighthousePasses?.passes.map((item) => item.scores.performance)).toEqual([71, 95, 82, 60, 88]);
  });

  it("breaks performance ties by total score and then lower pass index", () => {
    const result = selectMedianLighthouseResult([
      pass(0, 80, { accessibility: 95, bestPractices: 95, seo: 95 }),
      pass(1, 80, { accessibility: 70, bestPractices: 70, seo: 70 }),
      pass(2, 90),
      pass(3, 70),
      pass(4, 60)
    ]);

    expect(result.performance).toBe(80);
    expect(result.lighthousePasses?.selectedPassIndex).toBe(0);
  });

  it("keeps the agentic result from the selected median performance pass", () => {
    const low = pass(0, 70);
    const median = pass(1, 80);
    const high = pass(2, 90);
    median.agenticBrowsing = {
      score: 75,
      title: "Agentic Browsing",
      description: "Experimental checks",
      checks: []
    };

    const result = selectMedianLighthouseResult([low, high, median], [], 3);

    expect(result.agenticBrowsing?.score).toBe(75);
  });

  it("ignores failed and null-performance passes when successful passes exist", () => {
    const result = selectMedianLighthouseResult([
      pass(0, 70),
      pass(2, 90),
      pass(3, 80),
      pass(4, null)
    ], [
      buildFailedLighthousePass(1, new Error("navigation timeout"))
    ]);

    expect(result.performance).toBe(80);
    expect(result.lighthousePasses?.selectedPassIndex).toBe(3);
    expect(result.lighthousePasses?.passes[1].error).toBe("navigation timeout");
  });

  it("returns null scores when every pass fails or lacks performance", () => {
    const result = selectMedianLighthouseResult([
      pass(0, null),
      pass(1, null)
    ], [
      buildFailedLighthousePass(2, new Error("failed")),
      buildFailedLighthousePass(3, new Error("failed")),
      buildFailedLighthousePass(4, new Error("failed"))
    ]);

    expect(result.performance).toBeNull();
    expect(result.accessibility).toBeNull();
    expect(result.categoryBreakdown).toEqual({});
    expect(result.lighthousePasses?.selectedPassIndex).toBeNull();
  });
});

describe("buildAgenticBrowsingResult", () => {
  it("maps every Lighthouse check status and keeps affected-item evidence", () => {
    const result = buildAgenticBrowsingResult({
      "agentic-browsing": {
        title: "Agentic Browsing",
        description: "Experimental agent-readiness checks.",
        score: 0.75,
        auditRefs: [
          { id: "agent-pass", weight: 1 },
          { id: "agent-fail", weight: 1 },
          { id: "agent-warning", weight: 1 },
          { id: "agent-manual", weight: 0 },
          { id: "agent-na", weight: 0 }
        ]
      }
    }, {
      "agent-pass": { id: "agent-pass", title: "Passed check", score: 1, scoreDisplayMode: "binary" },
      "agent-fail": {
        id: "agent-fail",
        title: "Failed check",
        description: "Add a machine-readable name.",
        score: 0,
        scoreDisplayMode: "binary",
        details: { items: [{ node: { nodeLabel: "Checkout", selector: "#checkout", snippet: "<button id=\"checkout\">" } }] }
      },
      "agent-warning": { id: "agent-warning", title: "Warning check", score: 1, scoreDisplayMode: "binary", warnings: ["Partial support"] },
      "agent-manual": { id: "agent-manual", title: "Manual check", score: null, scoreDisplayMode: "manual" },
      "agent-na": { id: "agent-na", title: "Not applicable", score: null, scoreDisplayMode: "notApplicable" }
    });

    expect(result).toMatchObject({ score: 75, title: "Agentic Browsing" });
    expect(result?.checks.map((check) => check.status)).toEqual(["passed", "failed", "warning", "manual", "notApplicable"]);
    expect(result?.checks[1].items[0]).toMatchObject({ label: "Checkout", selector: "#checkout" });
  });

  it("returns undefined when Lighthouse omits the category", () => {
    expect(buildAgenticBrowsingResult({}, {})).toBeUndefined();
  });
});

describe("buildSinglePassResult", () => {
  it("stores scores, metrics, environment, warnings, and Lighthouse metadata", () => {
    const result = buildSinglePassResult(2, {
      lighthouseVersion: "12.8.2",
      fetchTime: "2026-06-24T00:00:00.000Z",
      finalDisplayedUrl: "https://example.com/final",
      environment: {
        benchmarkIndex: 1234,
        hostUserAgent: "Host UA",
        networkUserAgent: "Network UA"
      },
      runWarnings: ["first warning"],
      categories: passingCategories,
      audits: {
        "first-contentful-paint": { displayValue: "1.2 s" },
        "largest-contentful-paint": { displayValue: "1.8 s" },
        "total-blocking-time": { displayValue: "120 ms" },
        "cumulative-layout-shift": { numericValue: 0.034 },
        "speed-index": { displayValue: "2.1 s" }
      }
    });

    expect(result.performance).toBe(91);
    expect(result.passSummary).toMatchObject({
      index: 2,
      lighthouseVersion: "12.8.2",
      fetchTime: "2026-06-24T00:00:00.000Z",
      finalUrl: "https://example.com/final",
      warnings: ["first warning"],
      environment: {
        benchmarkIndex: 1234,
        hostUserAgent: "Host UA",
        networkUserAgent: "Network UA"
      },
      metrics: {
        firstContentfulPaint: "1.2 s",
        largestContentfulPaint: "1.8 s",
        totalBlockingTime: "120 ms",
        cumulativeLayoutShift: "0.034",
        speedIndex: "2.1 s"
      }
    });
  });
});

function pass(index: number, performance: number | null, scores: Partial<Omit<LighthouseSinglePassResult, "categoryBreakdown" | "passSummary">> = {}): LighthouseSinglePassResult {
  const resultScores = {
    performance,
    accessibility: scores.accessibility ?? 90,
    bestPractices: scores.bestPractices ?? 90,
    seo: scores.seo ?? 90
  };
  return {
    ...resultScores,
    categoryBreakdown: {},
    passSummary: {
      index,
      scores: resultScores,
      metrics: {},
      warnings: [],
      lighthouseVersion: "12.8.2"
    }
  };
}
