import type { ResourceTimingEntry, SectionTimelineEntry } from "../../../../packages/shared/types.js";

export function estimateBlockingResources(section: SectionTimelineEntry, resources: ResourceTimingEntry[]) {
  const complete = section.renderCompleteMs ?? section.contentStableMs ?? section.firstVisibleMs ?? 0;
  return resources.filter((resource) => resource.startMs <= complete && resource.startMs + resource.durationMs >= Math.max(0, complete - 500)).length;
}

export function inferResourceType(url: string) {
  if (/\.(png|jpe?g|webp|gif|avif|svg)$/i.test(url)) return "image";
  if (/\.css($|\?)/i.test(url)) return "css";
  if (/\.(js|mjs)($|\?)/i.test(url)) return "script";
  if (/\.(woff2?|ttf|otf)($|\?)/i.test(url)) return "font";
  return "resource";
}
