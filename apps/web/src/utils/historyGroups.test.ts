import { describe, expect, it } from "vitest";
import type { AuditRunSummary } from "../../../../packages/shared/types";
import { groupRunsBySite, siteKeyForRun, urlKeyForRun } from "./historyGroups";

const run = (id: string, input: string, device: string, createdAt: string): AuditRunSummary => ({
  id,
  mode: "url",
  status: "completed",
  input,
  startUrl: input,
  finalUrl: input,
  device,
  scores: { performance: 80, accessibility: 90, bestPractices: 90, seo: 90 },
  progress: { stage: "completed", percent: 100, message: "Audit completed." },
  createdAt
});

describe("history grouping", () => {
  it("normalizes www, case, path, and default ports into one site key", () => {
    expect(siteKeyForRun(run("1", "https://WWW.Example.com:443/path", "desktop", "2026-06-24"))).toBe("example.com");
  });

  it("keeps separate URL rows under the same domain", () => {
    expect(urlKeyForRun(run("1", "https://WWW.Example.com:443/path?b=2&a=1#hash", "desktop", "2026-06-24"))).toBe("https://example.com/path?a=1&b=2");
  });

  it("keeps only the newest run for each device in each URL group", () => {
    const groups = groupRunsBySite([
      run("desktop-old", "https://example.com/old", "desktop", "2026-06-20T00:00:00Z"),
      run("mobile", "https://example.com", "mobile", "2026-06-21T00:00:00Z"),
      run("desktop-new", "https://www.example.com/old", "desktop", "2026-06-22T00:00:00Z")
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].urls).toHaveLength(2);
    expect(groups[0].urls.find((item) => item.key.endsWith("/old"))?.desktop?.id).toBe("desktop-new");
    expect(groups[0].urls.find((item) => item.key.endsWith("/"))?.mobile?.id).toBe("mobile");
  });
});
