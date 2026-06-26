import { z } from "zod";

export const targetScoresSchema = z
  .object({
    performance: z.coerce.number().int().min(0).max(100).default(90),
    accessibility: z.coerce.number().int().min(0).max(100).default(90),
    bestPractices: z.coerce.number().int().min(0).max(100).default(90),
    seo: z.coerce.number().int().min(0).max(100).default(90)
  })
  .default({
    performance: 90,
    accessibility: 90,
    bestPractices: 90,
    seo: 90
  });

export const auditSettingsSchema = z.object({
  compareToRunId: z.string().optional(),
  throttle: z.enum(["default", "fast", "slow"]).optional(),
  lighthousePassCount: z.coerce.number().int().min(1).max(9).default(5),
  targetScores: targetScoresSchema
});

export const createAuditSchema = z.object({
  input: z.string().min(1),
  mode: z.enum(["url", "journey"]),
  device: z.enum(["mobile", "desktop"]).default("mobile"),
  label: z.string().optional(),
  settings: auditSettingsSchema.default({})
});

export const createJourneySchema = z.object({
  startUrl: z.string().url(),
  goal: z.string().min(3),
  device: z.enum(["mobile", "desktop"]).default("mobile"),
  label: z.string().optional(),
  settings: createAuditSchema.shape.settings
});

export const lighthouseRecheckSchema = z.object({
  url: z.string().url(),
  device: z.enum(["mobile", "desktop"]).default("mobile"),
  targetScores: targetScoresSchema
});

export const crawlerFilesToolSchema = z.object({
  url: z.string().url()
});

export const pageStructureToolSchema = z.object({
  url: z.string().url()
});

export const structuredDataToolSchema = z.object({ url: z.string().url() });
export const internalLinkGraphToolSchema = z.object({ url: z.string().url() });
export const metadataSocialToolSchema = z.object({ url: z.string().url() });
export const thirdPartyToolSchema = z.object({ url: z.string().url() });
export const freshnessIndexabilityToolSchema = z.object({ url: z.string().url() });
