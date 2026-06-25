import { Activity, RadioTower } from "lucide-react";

export function Topbar() {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">
          <Activity size={18} />
        </span>
        <span className="brand-copy">
          <strong>Tracepilot</strong>
          <small>Web performance auditor</small>
        </span>
      </div>
      <div className="topbar-actions">
        <RadioTower size={15} aria-hidden="true" />
        <span className="status-led" aria-hidden="true" />
        <span>Console ready</span>
      </div>
    </header>
  );
}
