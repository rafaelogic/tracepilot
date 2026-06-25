import type { AuditScoreCategory } from "../../../../packages/shared/types";

export const reportTabs = ["overview", "timeline", "network", "agentic", "diagnostics"] as const;
export type ReportTab = typeof reportTabs[number];

export const scoreCategories = ["performance", "accessibility", "bestPractices", "seo"] as const;

export const scoreCategoryLabels: Record<AuditScoreCategory, string> = {
  performance: "Performance",
  accessibility: "Accessibility",
  bestPractices: "Best Practices",
  seo: "SEO"
};

export type ReportRoute =
  | { kind: "home" }
  | { kind: "report"; runId: string; tab: ReportTab }
  | { kind: "findings"; runId: string; category: AuditScoreCategory };

export function parseReportRoute(pathname = window.location.pathname): ReportRoute {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "reports" || !parts[1]) return { kind: "home" };

  const runId = decodeURIComponent(parts[1]);
  if (parts[2] === "findings" && isScoreCategory(parts[3])) {
    return { kind: "findings", runId, category: parts[3] };
  }
  if (isReportTab(parts[2])) return { kind: "report", runId, tab: parts[2] };
  return { kind: "report", runId, tab: "overview" };
}

export function reportPath(runId: string, tab: ReportTab = "overview") {
  return `/reports/${encodeURIComponent(runId)}/${tab}`;
}

export function findingsPath(runId: string, category: AuditScoreCategory) {
  return `/reports/${encodeURIComponent(runId)}/findings/${category}`;
}

export function isReportTab(value: unknown): value is ReportTab {
  return typeof value === "string" && reportTabs.includes(value as ReportTab);
}

function isScoreCategory(value: unknown): value is AuditScoreCategory {
  return typeof value === "string" && scoreCategories.includes(value as AuditScoreCategory);
}
