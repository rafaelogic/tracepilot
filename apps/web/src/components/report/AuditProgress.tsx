import { Check, LoaderCircle } from "lucide-react";
import type { AuditProgress as AuditProgressValue, AuditProgressStage } from "../../../../../packages/shared/types";

const stages: Array<{ stage: AuditProgressStage; label: string }> = [
  { stage: "preparing-browser", label: "Prepare browser" },
  { stage: "navigating", label: "Open target" },
  { stage: "observing-sections", label: "Observe sections" },
  { stage: "collecting-resources", label: "Map resources" },
  { stage: "running-lighthouse", label: "Run Lighthouse" },
  { stage: "saving-report", label: "Save report" }
];

export function AuditProgress({ progress }: { progress: AuditProgressValue }) {
  const activeIndex = stages.findIndex((item) => item.stage === progress.stage);

  return (
    <section className="audit-progress" aria-live="polite" aria-busy={progress.stage !== "completed" && progress.stage !== "failed"}>
      <div className="progress-readout">
        <span className="progress-spinner"><LoaderCircle /></span>
        <div>
          <small>Audit in progress · {progress.percent}%</small>
          <h3>{progress.message}</h3>
        </div>
      </div>
      <div className="progress-track"><span style={{ width: `${progress.percent}%` }} /></div>
      <ol className="progress-steps">
        {stages.map((item, index) => {
          const completed = activeIndex > index || progress.stage === "completed";
          const active = activeIndex === index;
          return (
            <li className={completed ? "complete" : active ? "active" : ""} key={item.stage}>
              <span>{completed ? <Check /> : index + 1}</span>
              {item.label}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
