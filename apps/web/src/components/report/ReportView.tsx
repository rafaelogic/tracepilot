import type { AuditReport } from "../../../../../packages/shared/types";
import { AgentStepFeed } from "./AgentStepFeed";
import { AgenticBrowsing } from "./AgenticBrowsing";
import { AuditProgress } from "./AuditProgress";
import { EmptyReport } from "./EmptyReport";
import { FindingAnalysis } from "./FindingAnalysis";
import { RawDiagnostics, ResourceWaterfall } from "./ResourceWaterfall";
import { ReportHeader } from "./ReportHeader";
import { ReportOverview } from "./ReportOverview";
import { ScoreStrip } from "./ScoreStrip";
import { SectionTimeline } from "./SectionTimeline";
import { reportTabs, type ReportRoute, type ReportTab } from "../../utils/reportRoutes";

export function ReportView({
  report,
  route,
  onNavigate,
  onSelectTab
}: {
  report: AuditReport | null;
  route: ReportRoute;
  onNavigate: (path: string) => void;
  onSelectTab: (tab: ReportTab) => void;
}) {
  if (!report) return <EmptyReport />;

  const isRunning = report.status === "queued" || report.status === "running";
  const activeTab = route.kind === "report" && route.runId === report.id ? route.tab : "overview";
  const activeFindingCategory = route.kind === "findings" && route.runId === report.id ? route.category : null;

  function handleTabKey(event: React.KeyboardEvent<HTMLButtonElement>, tab: ReportTab) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const next = reportTabs[(reportTabs.indexOf(tab) + direction + reportTabs.length) % reportTabs.length];
    onSelectTab(next);
    requestAnimationFrame(() => document.getElementById(`report-tab-${next}`)?.focus());
  }

  return (
    <section className="report-panel">
      <ReportHeader report={report} />
      {report.error && <div className="error-banner" role="alert">{report.error}</div>}
      {isRunning && <AuditProgress progress={report.progress} />}

      <div className="report-tabs" role="tablist" aria-label="Audit report views">
        {reportTabs.map((tab) => (
          <button
            type="button"
            role="tab"
            id={`report-tab-${tab}`}
            aria-controls={`report-panel-${tab}`}
            aria-selected={activeTab === tab}
            tabIndex={activeTab === tab ? 0 : -1}
            className={activeTab === tab ? "active" : ""}
            onClick={() => onSelectTab(tab)}
            onKeyDown={(event) => handleTabKey(event, tab)}
            key={tab}
          >
            {tab}
            {tab === "timeline" && report.sections.length > 0 && <span>{report.sections.length}</span>}
            {tab === "network" && report.resources.length > 0 && <span>{report.resources.length}</span>}
            {tab === "agentic" && report.agenticBrowsing && <span>{actionableAgenticCount(report.agenticBrowsing.checks)}</span>}
          </button>
        ))}
      </div>

      {activeFindingCategory ? (
        <FindingAnalysis report={report} category={activeFindingCategory} onNavigate={onNavigate} />
      ) : (
        <div role="tabpanel" id={`report-panel-${activeTab}`} aria-labelledby={`report-tab-${activeTab}`} className="report-tab-panel">
          {activeTab === "overview" && <>
            <div className="overview-stack">
              <section className="overview-section overview-section-primary" aria-label="Audit summary">
                <ReportOverview report={report} />
              </section>
              <section className="overview-section" aria-label="Lighthouse categories">
                <div className="overview-section-heading">
                  <span>Score Categories</span>
                  <small>Open a card for full analysis</small>
                </div>
                <ScoreStrip runId={report.id} scores={report.scores} categoryBreakdown={report.categoryBreakdown} onNavigate={onNavigate} />
              </section>
              <AgentStepFeed steps={report.journeySteps} />
            </div>
          </>}
          {activeTab === "timeline" && <SectionTimeline sections={report.sections} resources={report.resources} />}
          {activeTab === "network" && <ResourceWaterfall resources={report.resources} />}
          {activeTab === "agentic" && <AgenticBrowsing report={report} />}
          {activeTab === "diagnostics" && <RawDiagnostics report={report} />}
        </div>
      )}
    </section>
  );
}

function actionableAgenticCount(checks: NonNullable<AuditReport["agenticBrowsing"]>["checks"]) {
  return checks.filter((check) => check.status === "failed" || check.status === "warning" || check.status === "manual").length;
}
