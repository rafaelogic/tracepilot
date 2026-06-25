import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { AuditReport } from "../../../../../packages/shared/types";

export function ReportHeader({ report }: { report: AuditReport }) {
  return (
    <div className="report-header">
      <div>
        <div className="status-pill">{statusIcon(report.status)} {report.status}</div>
        <h2>{report.finalUrl || report.startUrl || report.input}</h2>
      </div>
      <div className="run-meta">{report.device} · {new Date(report.createdAt).toLocaleString()}</div>
    </div>
  );
}

function statusIcon(status: string) {
  if (status === "failed") return <AlertTriangle size={14} />;
  if (status === "completed") return <CheckCircle2 size={14} />;
  return <span className="pulse-dot" />;
}
