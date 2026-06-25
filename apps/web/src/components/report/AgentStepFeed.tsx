import { Zap } from "lucide-react";
import type { JourneyStepEntry } from "../../../../../packages/shared/types";

export function AgentStepFeed({ steps }: { steps: JourneyStepEntry[] }) {
  if (steps.length === 0) return null;

  return (
    <div className="agent-feed">
      <div className="panel-title">
        <Zap size={15} /> Agent steps
      </div>
      {steps.map((step) => (
        <div key={step.index} className="agent-step">
          <span>{step.index + 1}</span>
          <div>
            <strong>{step.action}</strong>
            <small>{step.status}{step.detail ? ` · ${step.detail}` : ""}</small>
          </div>
        </div>
      ))}
    </div>
  );
}
