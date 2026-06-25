import { History, Monitor, Smartphone, Trash2 } from "lucide-react";
import type { AuditRunSummary } from "../../../../../packages/shared/types";
import { groupRunsBySite } from "../../utils/historyGroups";

export function RunHistory({
  runs,
  activeRunId,
  onSelectRun,
  onDeleteRun
}: {
  runs: AuditRunSummary[];
  activeRunId: string | null;
  onSelectRun: (runId: string) => void;
  onDeleteRun: (runId: string) => void;
}) {
  const groups = groupRunsBySite(runs);

  return (
    <aside className="history-panel">
      <div className="panel-title">
        <History size={15} /> Audited sites
      </div>
      <div className="history-list">
        {groups.length === 0 && <p className="empty">No audits yet.</p>}
        {groups.map((group) => (
          <section className="history-site" key={group.key}>
            <strong title={group.label}>{group.label}</strong>
            <div className="history-url-list">
              {group.urls.map((urlGroup) => (
                <div className="history-url" key={urlGroup.key}>
                  <span title={urlGroup.url}>{urlGroup.label}</span>
                  <div className="history-devices">
                    {urlGroup.desktop && <DeviceRun run={urlGroup.desktop} active={urlGroup.desktop.id === activeRunId} onSelect={onSelectRun} onDelete={onDeleteRun} />}
                    {urlGroup.mobile && <DeviceRun run={urlGroup.mobile} active={urlGroup.mobile.id === activeRunId} onSelect={onSelectRun} onDelete={onDeleteRun} />}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}

function DeviceRun({
  run,
  active,
  onSelect,
  onDelete
}: {
  run: AuditRunSummary;
  active: boolean;
  onSelect: (runId: string) => void;
  onDelete: (runId: string) => void;
}) {
  function confirmDelete() {
    if (window.confirm(`Delete this ${run.device} audit? This cannot be undone.`)) onDelete(run.id);
  }

  return (
    <div className="history-device-row">
      <button type="button" className={active ? "history-device active" : "history-device"} onClick={() => onSelect(run.id)}>
        {run.device === "desktop" ? <Monitor size={14} /> : <Smartphone size={14} />}
        <span>{run.device}</span>
        <small>{run.status}</small>
      </button>
      <button type="button" className="history-delete" onClick={confirmDelete} aria-label={`Delete ${run.device} audit for ${run.finalUrl || run.startUrl || run.input}`}>
        <Trash2 size={14} />
      </button>
    </div>
  );
}
