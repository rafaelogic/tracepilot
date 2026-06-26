import { describe, expect, it } from "vitest";
import { structuredDataFindings } from "./advancedSeoToolsService";

describe("structuredDataFindings", () => {
  it("flags invalid JSON-LD entities", () => {
    const findings = structuredDataFindings([
      { type: null, id: null, valid: false, errors: ["Missing @type"], snippet: "{\"name\":\"Example\"}" }
    ]);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      id: "structured-data-invalid",
      impact: "failed"
    });
  });

  it("warns when structured data is absent", () => {
    expect(structuredDataFindings([])[0]).toMatchObject({
      id: "structured-data-missing",
      impact: "warning"
    });
  });
});
