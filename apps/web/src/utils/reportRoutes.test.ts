import { describe, expect, it } from "vitest";
import { parseReportRoute, reportPath, reportTabs } from "./reportRoutes";

describe("agentic report route", () => {
  it("parses and builds the agentic report tab path", () => {
    expect(reportTabs).toContain("agentic");
    expect(reportPath("run/1", "agentic")).toBe("/reports/run%2F1/agentic");
    expect(parseReportRoute("/reports/run%2F1/agentic")).toEqual({ kind: "report", runId: "run/1", tab: "agentic" });
  });
});
