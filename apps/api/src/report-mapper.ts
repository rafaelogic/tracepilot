import type { AgenticBrowsingCheck, AgenticBrowsingResult, AuditCategoryBreakdown, AuditProgressStage, AuditReport, AuditRunSummary, AuditSettings, LighthousePassesMetadata } from "../../../packages/shared/types.js";

type AuditRunWithRelations = {
  id: string;
  mode: string;
  status: string;
  input: string;
  startUrl: string | null;
  finalUrl: string | null;
  goal: string | null;
  device: string;
  label: string | null;
  error: string | null;
  performance: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  seo: number | null;
  settings?: unknown;
  categoryBreakdown?: unknown;
  agenticBrowsing?: unknown;
  lighthousePasses?: unknown;
  progressStage: string;
  progressPercent: number;
  progressMessage: string;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  sections?: Array<any>;
  resources?: Array<any>;
  journeySteps?: Array<any>;
};

export function toSummary(run: AuditRunWithRelations): AuditRunSummary {
  return {
    id: run.id,
    mode: run.mode as AuditRunSummary["mode"],
    status: run.status as AuditRunSummary["status"],
    input: run.input,
    startUrl: run.startUrl,
    finalUrl: run.finalUrl,
    goal: run.goal,
    device: run.device,
    label: run.label,
    error: run.error,
    scores: {
      performance: run.performance,
      accessibility: run.accessibility,
      bestPractices: run.bestPractices,
      seo: run.seo
    },
    settings: normalizeSettings(run.settings),
    categoryBreakdown: normalizeCategoryBreakdown(run.categoryBreakdown),
    agenticBrowsing: normalizeAgenticBrowsing(run.agenticBrowsing),
    lighthousePasses: normalizeLighthousePasses(run.lighthousePasses),
    progress: {
      stage: run.progressStage as AuditProgressStage,
      percent: Math.max(0, Math.min(100, run.progressPercent)),
      message: run.progressMessage
    },
    createdAt: run.createdAt.toISOString(),
    startedAt: run.startedAt?.toISOString() ?? null,
    completedAt: run.completedAt?.toISOString() ?? null
  };
}

function normalizeAgenticBrowsing(value: unknown): AgenticBrowsingResult | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const candidate = value as Record<string, unknown>;
  if ((typeof candidate.score !== "number" && candidate.score !== null) || typeof candidate.title !== "string" || !Array.isArray(candidate.checks)) {
    return undefined;
  }

  const checks = candidate.checks.filter(isAgenticCheck);
  if (checks.length !== candidate.checks.length) return undefined;
  return {
    score: candidate.score,
    title: candidate.title,
    description: typeof candidate.description === "string" ? candidate.description : null,
    checks
  };
}

function isAgenticCheck(value: unknown): value is AgenticBrowsingCheck {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const check = value as Record<string, unknown>;
  return typeof check.id === "string"
    && typeof check.title === "string"
    && (typeof check.score === "number" || check.score === null)
    && ["passed", "failed", "warning", "manual", "notApplicable"].includes(String(check.status))
    && Array.isArray(check.items);
}

function normalizeCategoryBreakdown(value: unknown): AuditCategoryBreakdown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as AuditCategoryBreakdown;
}

function normalizeSettings(value: unknown): AuditSettings | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as AuditSettings;
}

function normalizeLighthousePasses(value: unknown): LighthousePassesMetadata | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as LighthousePassesMetadata;
}

export function toReport(run: AuditRunWithRelations): AuditReport {
  return {
    ...toSummary(run),
    sections: (run.sections ?? []).map((section) => ({
      id: section.id,
      label: section.label,
      selector: section.selector,
      elementHtml: section.elementHtml,
      top: section.top,
      height: section.height,
      firstDetectedMs: section.firstDetectedMs,
      firstVisibleMs: section.firstVisibleMs,
      contentStableMs: section.contentStableMs,
      renderCompleteMs: section.renderCompleteMs,
      layoutShiftScore: section.layoutShiftScore,
      blockingResourceCount: section.blockingResourceCount
    })),
    resources: (run.resources ?? []).map((resource) => ({
      id: resource.id,
      sectionTimingId: resource.sectionTimingId,
      url: resource.url,
      type: resource.type,
      initiator: resource.initiator,
      startMs: resource.startMs,
      durationMs: resource.durationMs,
      transferSize: resource.transferSize,
      status: resource.status
    })),
    journeySteps: (run.journeySteps ?? []).map((step) => ({
      index: step.index,
      action: step.action,
      status: step.status,
      startedAtMs: step.startedAtMs,
      endedAtMs: step.endedAtMs,
      detail: step.detail
    }))
  };
}
