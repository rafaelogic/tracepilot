import type { AuditCategoryBreakdown, AuditCategoryFinding, AuditScoreCategory, AuditScores } from "../../../../../packages/shared/types";
import { findingsPath, scoreCategoryLabels } from "../../utils/reportRoutes";
import { scoreTone, scoreVerdict } from "../../utils/reportMetrics";

const scoreKeys: AuditScoreCategory[] = ["performance", "accessibility", "bestPractices", "seo"];

export function ScoreStrip({
  runId,
  scores,
  categoryBreakdown = {},
  onNavigate
}: {
  runId: string;
  scores: AuditScores;
  categoryBreakdown?: AuditCategoryBreakdown;
  onNavigate: (path: string) => void;
}) {
  return (
    <div className="score-strip">
      {scoreKeys.map((key) => (
        <Score
          key={key}
          category={key}
          label={scoreCategoryLabels[key]}
          value={scores[key]}
          findings={categoryBreakdown[key] ?? []}
          runId={runId}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
}

function Score({
  category,
  label,
  value,
  findings,
  runId,
  onNavigate
}: {
  category: AuditScoreCategory;
  label: string;
  value: number | null;
  findings: AuditCategoryFinding[];
  runId: string;
  onNavigate: (path: string) => void;
}) {
  const verdict = scoreVerdict(value);
  const blockers = findings.filter((finding) => finding.impact === "failed");
  const path = findingsPath(runId, category);

  function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    onNavigate(path);
  }

  return (
    <a className={`score score-link ${scoreTone(value)}`} href={path} onClick={handleClick}>
      <div className="score-heading">
        <span>{label}</span>
        <small>{verdict.label}</small>
      </div>
      <div className="score-reading"><strong>{value ?? "—"}</strong><small>/100</small></div>
      <div className="score-meter" aria-hidden="true"><span style={{ width: `${value ?? 0}%` }} /></div>
      <div className="score-breakdown-title">
        <span>{blockers.length} blocker{blockers.length === 1 ? "" : "s"}</span>
        <small>{findings.length === 0 ? "No detailed findings stored" : `${findings.length} finding${findings.length === 1 ? "" : "s"} · open analysis`}</small>
      </div>
    </a>
  );
}
