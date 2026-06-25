import { describe, expect, it } from "vitest";
import { formatBytes, scoreVerdict } from "./reportMetrics";

describe("report metric presentation", () => {
  it("formats transferred bytes for quick scanning", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(2_621_440)).toBe("2.5 MB");
  });

  it("turns the performance score into a clear verdict", () => {
    expect(scoreVerdict(null)).toEqual({ label: "Pending", tone: "unknown" });
    expect(scoreVerdict(27)).toEqual({ label: "Critical", tone: "bad" });
    expect(scoreVerdict(72)).toEqual({ label: "Needs attention", tone: "mid" });
    expect(scoreVerdict(94)).toEqual({ label: "Healthy", tone: "good" });
  });
});
