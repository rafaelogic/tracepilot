import { describe, expect, it } from "vitest";
import type { ResourceTimingEntry, SectionTimelineEntry } from "../../../../packages/shared/types.js";
import { estimateBlockingResources, inferResourceType } from "./timing-utils.js";

const section: SectionTimelineEntry = {
  label: "Hero",
  selector: "main > section",
  top: 0,
  height: 640,
  firstDetectedMs: 10,
  firstVisibleMs: 120,
  contentStableMs: 900,
  renderCompleteMs: 1000,
  layoutShiftScore: 0,
  blockingResourceCount: 0
};

describe("timing utilities", () => {
  it("infers resource types from common URL extensions", () => {
    expect(inferResourceType("https://site.test/app.css")).toBe("css");
    expect(inferResourceType("https://site.test/app.mjs?v=1")).toBe("script");
    expect(inferResourceType("https://site.test/font.woff2")).toBe("font");
    expect(inferResourceType("https://site.test/hero.avif")).toBe("image");
    expect(inferResourceType("https://site.test/api/report")).toBe("resource");
  });

  it("counts resources overlapping the section completion window", () => {
    const resources: ResourceTimingEntry[] = [
      resource("early.css", 50, 100),
      resource("blocking.js", 700, 400),
      resource("image.webp", 920, 240),
      resource("late-api", 1300, 200)
    ];

    expect(estimateBlockingResources(section, resources)).toBe(2);
  });
});

function resource(url: string, startMs: number, durationMs: number): ResourceTimingEntry {
  return {
    url,
    type: inferResourceType(url),
    startMs,
    durationMs
  };
}
