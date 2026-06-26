import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AuditReport } from "../../../../../packages/shared/types";
import { ReportOverview } from "./ReportOverview";

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
    performance: null,
    accessibility: null,
    bestPractices: null,
    seo: null
  },
  progress: {
    stage: "completed",
    percent: 100,
    message: "Audit completed."
  },
  createdAt: "2026-06-26T00:00:00.000Z",
  startedAt: "2026-06-26T00:00:00.000Z",
  completedAt: "2026-06-26T00:01:00.000Z",
  sections: [],
  resources: [],
  journeySteps: []
};

describe("ReportOverview", () => {
  it("explains completed audits that could not produce Lighthouse scores", () => {
    const html = renderToStaticMarkup(<ReportOverview report={baseReport} />);

    expect(html).toContain("Unable to score");
    expect(html).toContain("The audited page did not load reliably enough for Lighthouse scoring.");
  });
});
