import { Clock3, Gauge, Network, Weight } from "lucide-react";
import type { AuditReport } from "../../../../../packages/shared/types";
import { formatBytes, formatMs, scoreVerdict } from "../../utils/reportMetrics";

export function ReportOverview({ report }: { report: AuditReport }) {
  const performance = report.scores.performance;
  const verdict = scoreVerdict(performance);
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
          <p>{performance == null ? "The audit is still collecting evidence." : performance < 50 ? "Prioritize render-blocking work and heavy requests first." : performance < 90 ? "The page is usable, but material improvements remain." : "Core delivery is performing well."}</p>
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

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="overview-fact">
      <span>{icon}</span>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}
