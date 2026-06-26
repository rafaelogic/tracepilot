import { describe, expect, it } from "vitest";
import { crawlerFilesToolSchema, createAuditSchema, lighthouseRecheckSchema, pageStructureToolSchema } from "./validation";

describe("lighthouseRecheckSchema", () => {
  it("defaults the device to mobile", () => {
    expect(lighthouseRecheckSchema.parse({ url: "https://example.com" })).toEqual({
      url: "https://example.com",
      device: "mobile",
      targetScores: {
        performance: 90,
        accessibility: 90,
        bestPractices: 90,
        seo: 90
      }
    });
  });

  it("rejects invalid URLs", () => {
    expect(() => lighthouseRecheckSchema.parse({ url: "not-a-url" })).toThrow();
  });
});

describe("createAuditSchema settings", () => {
  it("defaults Lighthouse pass count and target scores", () => {
    expect(createAuditSchema.parse({
      input: "https://example.com",
      mode: "url"
    }).settings).toEqual({
      lighthousePassCount: 5,
      targetScores: {
        performance: 90,
        accessibility: 90,
        bestPractices: 90,
        seo: 90
      }
    });
  });

  it("accepts custom pass count and score targets", () => {
    expect(createAuditSchema.parse({
      input: "https://example.com",
      mode: "url",
      settings: {
        lighthousePassCount: 3,
        targetScores: {
          performance: 95,
          accessibility: 88,
          bestPractices: 90,
          seo: 92
        }
      }
    }).settings).toEqual({
      lighthousePassCount: 3,
      targetScores: {
        performance: 95,
        accessibility: 88,
        bestPractices: 90,
        seo: 92
      }
    });
  });

  it("rejects out-of-range pass counts and targets", () => {
    expect(() => createAuditSchema.parse({
      input: "https://example.com",
      mode: "url",
      settings: { lighthousePassCount: 10 }
    })).toThrow();

    expect(() => createAuditSchema.parse({
      input: "https://example.com",
      mode: "url",
      settings: {
        targetScores: {
          performance: 101,
          accessibility: 90,
          bestPractices: 90,
          seo: 90
        }
      }
    })).toThrow();
  });
});

describe("crawlerFilesToolSchema", () => {
  it("accepts absolute URLs for standalone crawler file checks", () => {
    expect(crawlerFilesToolSchema.parse({ url: "https://example.com/docs" })).toEqual({
      url: "https://example.com/docs"
    });
  });

  it("rejects invalid tool target URLs", () => {
    expect(() => crawlerFilesToolSchema.parse({ url: "example.com" })).toThrow();
  });
});

describe("pageStructureToolSchema", () => {
  it("accepts absolute URLs for standalone page structure checks", () => {
    expect(pageStructureToolSchema.parse({ url: "https://example.com/page" })).toEqual({
      url: "https://example.com/page"
    });
  });

  it("rejects invalid page structure target URLs", () => {
    expect(() => pageStructureToolSchema.parse({ url: "/relative" })).toThrow();
  });
});
