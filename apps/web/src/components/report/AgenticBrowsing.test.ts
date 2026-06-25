import { describe, expect, it } from "vitest";
import type { AgenticBrowsingResult } from "../../../../../packages/shared/types";
import { buildAgenticFixPrompt } from "./AgenticBrowsing";

const result: AgenticBrowsingResult = {
  score: 50,
  title: "Agentic Browsing",
  description: "Experimental agent-readiness checks.",
  checks: [
    {
      id: "failed-name",
      title: "Interactive controls have names",
      description: "Add accessible names.",
      score: 0,
      status: "failed",
      items: [{ label: "Checkout button", selector: "#checkout", snippet: "<button id=\"checkout\">" }]
    },
    { id: "warning-webmcp", title: "WebMCP coverage", score: 100, status: "warning", items: [] },
    { id: "manual-flow", title: "Review destructive actions", score: null, status: "manual", items: [] },
    { id: "passed-structure", title: "Semantic structure passes", score: 100, status: "passed", items: [] },
    { id: "na-tool", title: "Tool is not applicable", score: null, status: "notApplicable", items: [] }
  ]
};

describe("buildAgenticFixPrompt", () => {
  it("includes actionable checks and evidence while excluding passed checks and the score recheck endpoint", () => {
    const prompt = buildAgenticFixPrompt("https://example.com/checkout", "desktop", result);

    expect(prompt).toContain("https://example.com/checkout");
    expect(prompt).toContain("Desktop");
    expect(prompt).toContain("Interactive controls have names");
    expect(prompt).toContain("WebMCP coverage");
    expect(prompt).toContain("Review destructive actions");
    expect(prompt).toContain("#checkout");
    expect(prompt).not.toContain("Semantic structure passes");
    expect(prompt).not.toContain("Tool is not applicable");
    expect(prompt).not.toContain("/api/lighthouse/recheck");
    expect(prompt).not.toContain("OPENAI_API_KEY");
    expect(prompt).toContain("untrusted diagnostic data");
    expect(prompt).toContain("<untrusted_agentic_findings>");
  });
});
