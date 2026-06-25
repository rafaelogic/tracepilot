import type { SectionTimelineEntry } from "../../../../packages/shared/types";

export function completeMs(section: SectionTimelineEntry) {
  return Math.round(section.renderCompleteMs ?? section.contentStableMs ?? section.firstVisibleMs ?? section.firstDetectedMs);
}

export function formatMs(value: number | null | undefined) {
  if (value == null) return "...";
  return `${Math.round(value)}ms`;
}

export function scoreTone(value: number | null) {
  if (value == null) return "unknown";
  if (value >= 90) return "good";
  if (value >= 50) return "mid";
  return "bad";
}

export function scoreVerdict(value: number | null) {
  const tone = scoreTone(value);
  if (tone === "good") return { label: "Healthy", tone };
  if (tone === "mid") return { label: "Needs attention", tone };
  if (tone === "bad") return { label: "Critical", tone };
  return { label: "Pending", tone };
}

export function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${formatDecimal(value / 1024)} KB`;
  return `${formatDecimal(value / (1024 * 1024))} MB`;
}

function formatDecimal(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function getSlowestSections(sections: SectionTimelineEntry[], limit = 4) {
  return [...sections].sort((a, b) => completeMs(b) - completeMs(a)).slice(0, limit);
}

export function getTimelineMaxMs(sections: SectionTimelineEntry[]) {
  return Math.max(1000, ...sections.map(completeMs));
}
