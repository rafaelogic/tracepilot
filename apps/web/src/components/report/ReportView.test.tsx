import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AuditReport } from "../../../../../packages/shared/types";
import { ReportView } from "./ReportView";

const baseReport: AuditReport = {
  id: "run-1",
  mode: "url",
  status: "completed",
  input: "https://example.com",
  startUrl: "https://example.com",
  finalUrl: "https://example.com",
  goal: null,
  device: "desktop",
  label: null,
  error: null,
  scores: {
    performance: 92,
    accessibility: 88,
    bestPractices: 90,
    seo: 95
  },
  progress: {
    stage: "completed",
    percent: 100,
    message: "Audit completed."
  },
  createdAt: "2026-06-25T00:00:00.000Z",
  startedAt: "2026-06-25T00:00:00.000Z",
  completedAt: "2026-06-25T00:01:00.000Z",
  sections: [],
  resources: [],
  journeySteps: []
};

describe("ReportView", () => {
  it("always renders the Agentic tab and marks missing agentic data", () => {
    const html = renderToStaticMarkup(
      <ReportView
        report={baseReport}
        route={{ kind: "report", runId: "run-1", tab: "overview" }}
        onNavigate={() => undefined}
        onSelectTab={() => undefined}
      />
    );

    expect(html).toContain("Agentic Browsing");
    expect(html).toContain("No data");
  });

  it("shows the actionable Agentic count when Lighthouse returned agentic checks", () => {
    const html = renderToStaticMarkup(
      <ReportView
        report={{
          ...baseReport,
          agenticBrowsing: {
            score: 67,
            title: "Agentic Browsing",
            checks: [
              { id: "passed", title: "Passed", score: 100, status: "passed", items: [] },
              { id: "failed", title: "Failed", score: 0, status: "failed", items: [] },
              { id: "manual", title: "Manual", score: null, status: "manual", items: [] }
            ]
          }
        }}
        route={{ kind: "report", runId: "run-1", tab: "overview" }}
        onNavigate={() => undefined}
        onSelectTab={() => undefined}
      />
    );

    expect(html).toContain("Agentic Browsing");
    expect(html).toContain("<span>2</span>");
  });
});
