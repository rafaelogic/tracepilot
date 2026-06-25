import { FileJson, Network } from "lucide-react";
import type { AuditReport, ResourceTimingEntry } from "../../../../../packages/shared/types";
import { formatBytes, formatMs } from "../../utils/reportMetrics";

export function ResourceWaterfall({ resources }: { resources: ResourceTimingEntry[] }) {
  return (
    <section className="report-canvas">
      <div className="canvas-header">
        <div className="panel-title"><Network size={15} /> Network evidence</div>
        <span>{resources.length} requests captured</span>
      </div>
      <div className="resource-list">
        {resources.length === 0 && <p className="empty">Resource evidence will appear as the audit progresses.</p>}
        {resources.slice(0, 100).map((resource) => <ResourceRow key={`${resource.url}-${resource.startMs}`} resource={resource} />)}
      </div>
    </section>
  );
}

export function RawDiagnostics({ report }: { report: AuditReport }) {
  return (
    <section className="report-canvas">
      <div className="canvas-header">
        <div className="panel-title"><FileJson size={15} /> Raw diagnostics</div>
        <span>Structured audit payload</span>
      </div>
      <pre>{JSON.stringify(report, null, 2)}</pre>
    </section>
  );
}

function ResourceRow({ resource }: { resource: ResourceTimingEntry }) {
  return (
    <div className="resource-row">
      <span className="resource-type">{resource.type}</span>
      <span className="resource-url" title={resource.url}>{resource.url}</span>
      <span className="resource-size">{formatBytes(resource.transferSize ?? 0)}</span>
      <strong>{formatMs(resource.durationMs)}</strong>
    </div>
  );
}
