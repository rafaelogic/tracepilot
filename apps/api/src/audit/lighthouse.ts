import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";
import type {
  AuditCategoryBreakdown,
  AgenticBrowsingCheck,
  AgenticBrowsingCheckStatus,
  AgenticBrowsingResult,
  AuditCategoryFinding,
  AuditFindingItem,
  LighthousePassesMetadata,
  LighthousePassSummary,
  LighthousePassMetrics,
  LighthouseRecheckAudit,
  LighthouseRecheckResponse,
  AuditScores,
  AuditScoreCategory
} from "../../../../packages/shared/types.js";

export interface LighthouseAuditResult extends AuditScores {
  categoryBreakdown: AuditCategoryBreakdown;
  agenticBrowsing?: AgenticBrowsingResult;
  lighthousePasses?: LighthousePassesMetadata;
}

export interface LighthouseSinglePassResult extends LighthouseAuditResult {
  passSummary: LighthousePassSummary;
}

export const LIGHTHOUSE_PASS_COUNT = 5;

const categoryMap: Record<string, AuditScoreCategory> = {
  performance: "performance",
  accessibility: "accessibility",
  "best-practices": "bestPractices",
  seo: "seo"
};

const defaultTargetScores: Record<AuditScoreCategory, number> = {
  performance: 90,
  accessibility: 90,
  bestPractices: 90,
  seo: 90
};

const metricAuditIds = {
  firstContentfulPaint: "first-contentful-paint",
  largestContentfulPaint: "largest-contentful-paint",
  totalBlockingTime: "total-blocking-time",
  cumulativeLayoutShift: "cumulative-layout-shift",
  speedIndex: "speed-index"
} as const;

export async function runLighthouse(url: string, port: number, device: "mobile" | "desktop"): Promise<LighthouseAuditResult> {
  const pass = await runLighthousePass(url, port, device, 0);
  return {
    performance: pass.performance,
    accessibility: pass.accessibility,
    bestPractices: pass.bestPractices,
    seo: pass.seo,
    agenticBrowsing: pass.agenticBrowsing,
    categoryBreakdown: pass.categoryBreakdown
  };
}

export async function runLighthousePass(url: string, port: number, device: "mobile" | "desktop", index: number): Promise<LighthouseSinglePassResult> {
  const result = await lighthouse(url, {
    port,
    output: "json",
    logLevel: "error",
    onlyCategories: ["performance", "accessibility", "best-practices", "seo", "agentic-browsing"],
    formFactor: device
  }, device === "desktop" ? desktopConfig : undefined);

  return buildSinglePassResult(index, result?.lhr);
}

export function buildSinglePassResult(index: number, lhr: any): LighthouseSinglePassResult {
  const categories = lhr?.categories;
  const audits = lhr?.audits ?? {};
  const scores = scoresFromCategories(categories);
  const categoryBreakdown = buildCategoryBreakdown(categories, audits);
  const agenticBrowsing = buildAgenticBrowsingResult(categories, audits);
  return {
    ...scores,
    categoryBreakdown,
    agenticBrowsing,
    passSummary: {
      index,
      scores,
      metrics: metricsFromAudits(audits),
      environment: normalizeEnvironment(lhr?.environment),
      warnings: normalizeWarnings(lhr?.runWarnings),
      fetchTime: stringValue(lhr?.fetchTime),
      finalUrl: stringValue(lhr?.finalDisplayedUrl ?? lhr?.finalUrl ?? lhr?.requestedUrl),
      lighthouseVersion: stringValue(lhr?.lighthouseVersion)
    }
  };
}

export function buildFailedLighthousePass(index: number, error: unknown): LighthousePassSummary {
  return {
    index,
    scores: emptyScores(),
    metrics: {},
    warnings: [],
    error: error instanceof Error ? error.message : "Lighthouse pass failed"
  };
}

export function selectMedianLighthouseResult(passes: LighthouseSinglePassResult[], failedPasses: LighthousePassSummary[] = []): LighthouseAuditResult {
  return selectMedianLighthouseResultForPassCount(passes, failedPasses, LIGHTHOUSE_PASS_COUNT);
}

export function selectMedianLighthouseResultForPassCount(
  passes: LighthouseSinglePassResult[],
  failedPasses: LighthousePassSummary[] = [],
  passCount = LIGHTHOUSE_PASS_COUNT
): LighthouseAuditResult {
  const allPasses = [...passes.map((pass) => pass.passSummary), ...failedPasses]
    .sort((a, b) => a.index - b.index);
  const successful = passes
    .filter((pass) => typeof pass.performance === "number")
    .sort(compareMedianCandidates);
  const selected = successful.length > 0 ? successful[Math.floor((successful.length - 1) / 2)] : null;
  const lighthouseVersion = firstString(allPasses.map((pass) =>
    "lighthouseVersion" in pass && typeof pass.lighthouseVersion === "string" ? pass.lighthouseVersion : null
  ));

  if (!selected) {
    return {
      ...emptyScores(),
      categoryBreakdown: {},
      lighthousePasses: {
        passCount,
        aggregation: "median-performance-pass",
        selectedPassIndex: null,
        lighthouseVersion,
        passes: allPasses
      }
    };
  }

  return {
    performance: selected.performance,
    accessibility: selected.accessibility,
    bestPractices: selected.bestPractices,
    seo: selected.seo,
    agenticBrowsing: selected.agenticBrowsing,
    categoryBreakdown: selected.categoryBreakdown,
    lighthousePasses: {
      passCount,
      aggregation: "median-performance-pass",
      selectedPassIndex: selected.passSummary.index,
      lighthouseVersion,
      passes: allPasses
    }
  };
}

export function scoresFromCategories(categories: any): AuditScores {
  return {
    performance: toScore(categories?.performance?.score),
    accessibility: toScore(categories?.accessibility?.score),
    bestPractices: toScore(categories?.["best-practices"]?.score),
    seo: toScore(categories?.seo?.score)
  };
}

export function buildAgenticBrowsingResult(categories: any, audits: Record<string, any>): AgenticBrowsingResult | undefined {
  const category = categories?.["agentic-browsing"];
  if (!category || !Array.isArray(category.auditRefs)) return undefined;

  const checks = category.auditRefs
    .map((ref: any) => toAgenticCheck(ref, audits[ref.id]))
    .filter((check: AgenticBrowsingCheck | null): check is AgenticBrowsingCheck => check !== null);

  return {
    score: toScore(category.score),
    title: stringValue(category.title) ?? "Agentic Browsing",
    description: stringValue(category.description),
    checks
  };
}

function toAgenticCheck(ref: any, audit: any): AgenticBrowsingCheck | null {
  if (!audit) return null;
  const rawScore = typeof audit.score === "number" ? audit.score : null;

  return {
    id: stringValue(audit.id ?? ref.id) ?? "agentic-check",
    title: stringValue(audit.title ?? ref.id) ?? "Agentic browsing check",
    description: stringValue(audit.description),
    score: rawScore == null ? null : Math.round(rawScore * 100),
    displayValue: stringValue(audit.displayValue),
    status: agenticCheckStatus(audit, rawScore),
    items: extractItems(audit.details)
  };
}

function agenticCheckStatus(audit: any, score: number | null): AgenticBrowsingCheckStatus {
  if (audit.scoreDisplayMode === "notApplicable") return "notApplicable";
  if (audit.scoreDisplayMode === "manual") return "manual";
  if (Array.isArray(audit.warnings) && audit.warnings.length > 0) return "warning";
  if (score === 1) return "passed";
  if (score != null && score < 1) return "failed";
  return "manual";
}

export async function runLighthouseRecheck(
  url: string,
  port: number,
  device: "mobile" | "desktop",
  targetScores: Record<AuditScoreCategory, number> = defaultTargetScores
): Promise<LighthouseRecheckResponse> {
  const result = await lighthouse(url, {
    port,
    output: "json",
    logLevel: "error",
    onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
    formFactor: device
  }, device === "desktop" ? desktopConfig : undefined);

  return buildLighthouseRecheckResponse(result?.lhr.categories, result?.lhr.audits ?? {}, targetScores);
}

export function buildLighthouseRecheckResponse(
  categories: any,
  audits: Record<string, any>,
  targetScores: Record<AuditScoreCategory, number> = defaultTargetScores
): LighthouseRecheckResponse {
  const scores = scoresFromCategories(categories);

  return {
    scores,
    passedTarget: Object.entries(targetScores).every(([key, target]) => {
      const score = scores[key as AuditScoreCategory];
      return score != null && score >= target;
    }),
    target: targetScores,
    metrics: metricsFromAudits(audits),
    opportunities: compactAudits(audits, "opportunity").slice(0, 10),
    diagnostics: compactAudits(audits, "diagnostic").slice(0, 10)
  };
}

function compareMedianCandidates(a: LighthouseSinglePassResult, b: LighthouseSinglePassResult) {
  const performanceDelta = (a.performance ?? 0) - (b.performance ?? 0);
  if (performanceDelta !== 0) return performanceDelta;
  const totalDelta = totalScore(b) - totalScore(a);
  if (totalDelta !== 0) return totalDelta;
  return a.passSummary.index - b.passSummary.index;
}

function totalScore(result: AuditScores) {
  return Object.values(result).reduce((total, score) => total + (score ?? 0), 0);
}

function emptyScores(): AuditScores {
  return {
    performance: null,
    accessibility: null,
    bestPractices: null,
    seo: null
  };
}

function metricsFromAudits(audits: Record<string, any>): LighthousePassMetrics {
  return {
    firstContentfulPaint: auditDisplayValue(audits[metricAuditIds.firstContentfulPaint]),
    largestContentfulPaint: auditDisplayValue(audits[metricAuditIds.largestContentfulPaint]),
    totalBlockingTime: auditDisplayValue(audits[metricAuditIds.totalBlockingTime]),
    cumulativeLayoutShift: auditDisplayValue(audits[metricAuditIds.cumulativeLayoutShift]) ?? scoreDisplay(audits[metricAuditIds.cumulativeLayoutShift]?.numericValue),
    speedIndex: auditDisplayValue(audits[metricAuditIds.speedIndex])
  };
}

function normalizeEnvironment(environment: any) {
  if (!environment || typeof environment !== "object") return undefined;
  return {
    benchmarkIndex: typeof environment.benchmarkIndex === "number" ? environment.benchmarkIndex : undefined,
    hostUserAgent: stringValue(environment.hostUserAgent) ?? undefined,
    networkUserAgent: stringValue(environment.networkUserAgent) ?? undefined
  };
}

function normalizeWarnings(warnings: unknown) {
  return Array.isArray(warnings)
    ? warnings.map((warning) => stringValue(warning)).filter((warning): warning is string => warning !== null)
    : [];
}

function firstString(values: Array<string | null | undefined>) {
  return values.find((value): value is string => typeof value === "string" && value.length > 0) ?? null;
}

function toScore(score: number | null | undefined) {
  return typeof score === "number" ? Math.round(score * 100) : null;
}

function buildCategoryBreakdown(categories: any, audits: Record<string, any>): AuditCategoryBreakdown {
  const breakdown: AuditCategoryBreakdown = {};

  for (const [lighthouseKey, appKey] of Object.entries(categoryMap)) {
    const auditRefs = categories?.[lighthouseKey]?.auditRefs ?? [];
    const findings = auditRefs
      .map((ref: any) => toFinding(ref, audits[ref.id]))
      .filter((finding: AuditCategoryFinding | null): finding is AuditCategoryFinding => finding !== null)
      .sort((a: AuditCategoryFinding, b: AuditCategoryFinding) => b.weight - a.weight);

    breakdown[appKey] = findings;
  }

  return breakdown;
}

function toFinding(ref: any, audit: any): AuditCategoryFinding | null {
  if (!audit) return null;
  const score = typeof audit.score === "number" ? audit.score : null;
  const scoreDisplayMode = audit.scoreDisplayMode;
  const impact = scoreDisplayMode === "manual" || scoreDisplayMode === "notApplicable"
    ? "manual"
    : score != null && score < 1
      ? "failed"
      : audit.warnings?.length
        ? "warning"
        : null;

  if (!impact) return null;

  const items = extractItems(audit.details);
  const displayValue = typeof audit.displayValue === "string" ? audit.displayValue : null;
  const weight = Number(ref.weight ?? 0);

  if (impact === "manual" && weight === 0 && items.length === 0) return null;

  return {
    id: audit.id ?? ref.id,
    title: audit.title ?? ref.id,
    description: audit.description ?? null,
    score: score == null ? null : Math.round(score * 100),
    displayValue,
    weight,
    impact,
    items
  };
}

function extractItems(details: any): AuditFindingItem[] {
  if (!details) return [];
  if (Array.isArray(details.items)) {
    return details.items.map(itemFromDetails).filter(Boolean) as AuditFindingItem[];
  }
  if (Array.isArray(details.children)) {
    return details.children.flatMap(extractItems);
  }
  return [];
}

function itemFromDetails(item: any): AuditFindingItem | null {
  const node = item.node ?? item.source ?? item.element;
  const url = stringValue(item.url ?? item.request?.url ?? item.source?.url);
  const selector = stringValue(node?.selector);
  const snippet = stringValue(node?.snippet);
  const label = stringValue(node?.nodeLabel ?? item.label ?? item.groupLabel ?? item.url ?? item.source?.url ?? item.request?.url);
  const value = stringValue(item.wastedBytes ? `${Math.round(Number(item.wastedBytes) / 1024)} KB potential savings` : item.wastedMs ? `${Math.round(Number(item.wastedMs))} ms potential savings` : item.value ?? item.size ?? item.totalBytes);

  if (!label && !selector && !snippet && !url) return null;

  return {
    label: label ?? selector ?? url ?? snippet ?? "Affected item",
    value,
    selector,
    snippet,
    url
  };
}

function compactAudits(audits: Record<string, any>, detailsType: "opportunity" | "diagnostic"): LighthouseRecheckAudit[] {
  return Object.values(audits)
    .filter((audit: any) => audit?.details?.type === detailsType)
    .map(toCompactAudit)
    .filter((audit: LighthouseRecheckAudit | null): audit is LighthouseRecheckAudit => audit !== null)
    .sort((a, b) => {
      const aSavings = maxItemSavings(a.items);
      const bSavings = maxItemSavings(b.items);
      if (aSavings !== bSavings) return bSavings - aSavings;
      return (a.score ?? 100) - (b.score ?? 100);
    });
}

function toCompactAudit(audit: any): LighthouseRecheckAudit | null {
  if (!audit?.id || !audit?.title) return null;
  const items = extractItems(audit.details).slice(0, 5);
  const displayValue = auditDisplayValue(audit);
  const score = typeof audit.score === "number" ? Math.round(audit.score * 100) : null;

  if (score === 100 && items.length === 0 && !displayValue) return null;

  return {
    id: audit.id,
    title: audit.title,
    displayValue,
    score,
    items
  };
}

function auditDisplayValue(audit: any) {
  return typeof audit?.displayValue === "string" && audit.displayValue.trim() ? audit.displayValue.trim() : null;
}

function scoreDisplay(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return String(Math.round(value * 1000) / 1000);
}

function maxItemSavings(items: AuditFindingItem[]) {
  return items.reduce((max, item) => {
    const match = item.value?.match(/\d+(?:\.\d+)?/);
    const next = match ? Number(match[0]) : 0;
    return Math.max(max, Number.isFinite(next) ? next : 0);
  }, 0);
}

function stringValue(value: unknown) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}
