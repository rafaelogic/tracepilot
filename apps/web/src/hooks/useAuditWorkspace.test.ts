import { describe, expect, it } from "vitest";
import { resolveActiveRunIdAfterHistory } from "./useAuditWorkspace";

describe("resolveActiveRunIdAfterHistory", () => {
  it("keeps an explicitly selected report active", () => {
    expect(resolveActiveRunIdAfterHistory("run-current", null)).toBe("run-current");
  });

  it("uses the report id from a direct report route", () => {
    expect(resolveActiveRunIdAfterHistory(null, "run-from-route")).toBe("run-from-route");
  });

  it("does not auto-select a report on the home route", () => {
    expect(resolveActiveRunIdAfterHistory(null, null)).toBeNull();
  });
});
