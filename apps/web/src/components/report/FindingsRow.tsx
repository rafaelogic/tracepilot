import type { SectionTimelineEntry } from "../../../../../packages/shared/types";
import { completeMs, formatMs, getSlowestSections } from "../../utils/reportMetrics";

export function FindingsRow({ sections }: { sections: SectionTimelineEntry[] }) {
  const slowest = getSlowestSections(sections);
  if (slowest.length === 0) return null;

  return (
    <div className="findings-row">
      {slowest.map((section) => (
        <div className="finding" key={section.selector}>
          <small>Slow section</small>
          <strong>{section.label}</strong>
          <span>{formatMs(completeMs(section))} · {section.blockingResourceCount} likely blockers</span>
          <em>{section.layoutShiftScore > 0.01 ? `CLS ${section.layoutShiftScore.toFixed(3)}` : "Stable layout"}</em>
        </div>
      ))}
    </div>
  );
}
