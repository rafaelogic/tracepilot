import { Clock3, Gauge, Network, Weight } from "lucide-react";
import type { AuditReport } from "../../../../../packages/shared/types";
import { formatBytes, formatMs, scoreVerdict } from "../../utils/reportMetrics";

export function ReportOverview({ report }: { report: AuditReport }) {
  const performance = report.scores.performance;
  const scoreUnavailable = report.status === "completed" && Object.values(report.scores).every((score) => score == null);
  const verdict = scoreUnavailable ? { label: "Unable to score", tone: "bad" } : scoreVerdict(performance);
  const totalBytes = report.resources.reduce((total, resource) => total + (resource.transferSize ?? 0), 0);
  const slowestResource = report.resources.reduce((slowest, resource) => Math.max(slowest, resource.durationMs), 0);
  const runDuration = report.startedAt && report.completedAt
    ? new Date(report.completedAt).getTime() - new Date(report.startedAt).getTime()
    : null;

  return (
    <section className="report-overview" aria-label="Audit overview">
      <div className={`overview-verdict ${verdict.tone}`}>
        <div className="overview-dial" aria-label={`Performance score ${performance ?? "pending"} out of 100`}>
          <strong>{performance ?? "—"}</strong>
          <span>/100</span>
        </div>
        <div>
          <small>Overall performance</small>
          <h3>{verdict.label}</h3>
          <p>{overviewMessage(report, scoreUnavailable)}</p>
          <p className="score-context">Local Lighthouse score for this {report.device} run. It can differ from PageSpeed Insights when the device mode, throttling, login/session state, network, or final URL differs.</p>
        </div>
      </div>

      <div className="overview-facts">
        <Fact icon={<Clock3 />} label="Audit duration" value={runDuration == null ? "—" : `${(runDuration / 1000).toFixed(1)}s`} />
        <Fact icon={<Network />} label="Requests captured" value={String(report.resources.length)} />
        <Fact icon={<Weight />} label="Transferred" value={formatBytes(totalBytes)} />
        <Fact icon={<Gauge />} label="Slowest request" value={slowestResource ? formatMs(slowestResource) : "—"} />
      </div>
    </section>
  );
}

function overviewMessage(report: AuditReport, scoreUnavailable: boolean) {
  const performance = report.scores.performance;
  if (scoreUnavailable) return "The audited page did not load reliably enough for Lighthouse scoring. Check target server errors, redirects, SSL, or container network access, then re-run the audit.";
  if (performance == null) return "The audit is still collecting evidence.";
  if (performance < 50) return "Prioritize render-blocking work and heavy requests first.";
  if (performance < 90) return "The page is usable, but material improvements remain.";
  return "Core delivery is performing well.";
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="overview-fact">
      <span>{icon}</span>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}
