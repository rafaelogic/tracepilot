import { ArrowLeft, Check, Clipboard, Lightbulb, ListChecks } from "lucide-react";
import { useMemo, useState } from "react";
import type { AuditCategoryFinding, AuditFindingItem, AuditReport, AuditScoreCategory } from "../../../../../packages/shared/types";
import { reportPath, scoreCategoryLabels } from "../../utils/reportRoutes";

type FindingStatus = AuditCategoryFinding["impact"];
type StatusFilter = "all" | FindingStatus;

const filters: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "failed", label: "Blockers" },
  { value: "warning", label: "Warnings" },
  { value: "manual", label: "Manual" }
];

export function FindingAnalysis({
  report,
  category,
  onNavigate
}: {
  report: AuditReport;
  category: AuditScoreCategory;
  onNavigate: (path: string) => void;
}) {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [copied, setCopied] = useState(false);
  const findings = report.categoryBreakdown?.[category] ?? [];
  const blockers = findings.filter((finding) => finding.impact === "failed");
  const counts = useMemo(() => countFindings(findings), [findings]);
  const allGroups = useMemo(() => groupFindings(findings, "all"), [findings]);
  const groups = useMemo(() => groupFindings(findings, filter), [findings, filter]);
  const label = scoreCategoryLabels[category];
  const targetUrl = report.finalUrl || report.startUrl || report.input;
  const prompt = useMemo(() => buildAgentPrompt(report, category, allGroups), [report, category, allGroups]);

  async function copyPrompt() {
    await copyText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section className="finding-analysis-page" aria-label={`${label} blocker analysis`}>
      <div className="finding-analysis-header">
        <button type="button" className="analysis-back" onClick={() => onNavigate(reportPath(report.id))}>
          <ArrowLeft size={15} /> Overview
        </button>
        <div>
          <div className="panel-title">{label} analysis</div>
          <h3>{blockers.length} blocker{blockers.length === 1 ? "" : "s"} · {findings.length} Lighthouse finding{findings.length === 1 ? "" : "s"}</h3>
          <p>Filter this category by status and review related findings grouped by issue.</p>
        </div>
      </div>

      <section className="agent-prompt-panel" aria-label="AI coding agent prompt">
        <div className="agent-prompt-header">
          <div>
            <h4>AI agent prompt</h4>
            <p>Copy this into a coding agent so it can fix the issues, call the Lighthouse recheck endpoint, and continue until every category reaches its target.</p>
          </div>
          <button type="button" className="copy-prompt-button" onClick={copyPrompt}>
            {copied ? <Check size={15} /> : <Clipboard size={15} />}
            {copied ? "Copied" : "Copy prompt"}
          </button>
        </div>
        <pre className="agent-prompt-preview">{prompt}</pre>
        <p className="agent-prompt-endpoint">Endpoint target: <code>{recheckEndpoint()}</code> for <code>{targetUrl}</code></p>
      </section>

      <div className="issue-filter-bar analysis-filter-bar">
        <div className="issue-filter" role="group" aria-label={`Filter ${label} findings by status`}>
          {filters.map((item) => (
            <button
              type="button"
              key={item.value}
              className={filter === item.value ? "active" : ""}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
              <span>{counts[item.value]}</span>
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="timeline-empty">
          <ListChecks />
          <h3>No findings match this filter</h3>
          <p>Switch filters or re-run this audit to collect more Lighthouse finding details for {label.toLowerCase()}.</p>
        </div>
      ) : (
        <div className="analysis-issue-group-list">
          {groups.map((group, groupIndex) => (
            <article className={`issue-group analysis-issue-group ${dominantStatus(group.findings)}`} key={group.key}>
              <div className="issue-group-summary">
                <div>
                  <strong>{group.label}</strong>
                  <span>{group.findings.length} finding{group.findings.length === 1 ? "" : "s"}</span>
                </div>
                <span className={`issue-status ${dominantStatus(group.findings)}`}>{statusLabel(dominantStatus(group.findings))}</span>
              </div>
              <div className="analysis-finding-list">
                {group.findings.map((finding, index) => (
                  <FindingDetail key={finding.id} finding={finding} defaultOpen={groupIndex === 0 && index === 0} />
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function buildAgentPrompt(report: AuditReport, category: AuditScoreCategory, groups: Array<{ label: string; findings: AuditCategoryFinding[] }>) {
  const targetUrl = report.finalUrl || report.startUrl || report.input;
  const endpoint = recheckEndpoint();
  const targetScores = {
    performance: report.settings?.targetScores?.performance ?? 90,
    accessibility: report.settings?.targetScores?.accessibility ?? 90,
    bestPractices: report.settings?.targetScores?.bestPractices ?? 90,
    seo: report.settings?.targetScores?.seo ?? 90
  };
  const requestBody = {
    url: targetUrl,
    device: report.device === "desktop" ? "desktop" : "mobile",
    targetScores
  };
  const targetLines = Object.entries(scoreCategoryLabels)
    .map(([key, label]) => `- ${label}: ${targetScores[key as AuditScoreCategory]}+/100`)
    .join("\n");
  const scoreLines = Object.entries(scoreCategoryLabels)
    .map(([key, label]) => `- ${label}: ${report.scores[key as AuditScoreCategory] ?? "not available"}/100`)
    .join("\n");
  const groupLines = groups.length === 0
    ? "- No grouped findings were stored for this category."
    : groups.map(formatPromptGroup).join("\n\n");
  const totalFindings = groups.reduce((total, group) => total + group.findings.length, 0);
  const totalBlockers = groups.reduce(
    (total, group) => total + group.findings.filter((finding) => finding.impact === "failed").length,
    0
  );

  return `You are optimizing ${targetUrl} for Lighthouse quality.

Goal: make every Lighthouse category meet or exceed its configured target.
Device profile: ${requestBody.device}
Saved audit Lighthouse passes: ${report.settings?.lighthousePassCount ?? report.lighthousePasses?.passCount ?? 5}
Selected category: ${scoreCategoryLabels[category]}
Selected category stored findings: ${totalFindings}
Selected category blockers: ${totalBlockers}

Target Lighthouse scores:
${targetLines}

Current Lighthouse scores:
${scoreLines}

Current grouped ${scoreCategoryLabels[category]} issues with full blocker details:
${groupLines}

Instructions:
1. Inspect and update the application code to address every blocker and finding listed above, using the descriptions, suggested fixes, and affected-item evidence.
2. After each adjustment, call the Lighthouse recheck endpoint below.
3. Read the returned scores, metrics, opportunities, and diagnostics.
4. Continue improving the code and rechecking until every category meets or exceeds the target score listed above.

Recheck command:
curl -X POST ${endpoint} \\
  -H 'Content-Type: application/json' \\
  -d '${JSON.stringify(requestBody)}'`;
}

function formatPromptGroup(group: { label: string; findings: AuditCategoryFinding[] }) {
  const lines = [`## ${group.label} (${group.findings.length} finding${group.findings.length === 1 ? "" : "s"})`];

  group.findings.forEach((finding, index) => {
    lines.push(formatPromptFinding(finding, index + 1));
  });

  return lines.join("\n");
}

function formatPromptFinding(finding: AuditCategoryFinding, index: number) {
  const lines = [
    `${index}. ${finding.title}`,
    `   - ID: ${finding.id}`,
    `   - Status: ${statusLabel(finding.impact)}`
  ];

  if (finding.score != null) lines.push(`   - Score: ${finding.score}/100`);
  if (finding.displayValue) lines.push(`   - Lighthouse value: ${oneLine(finding.displayValue)}`);
  if (finding.weight > 0) lines.push(`   - Category weight: ${finding.weight}`);
  if (finding.description) lines.push(`   - Description: ${oneLine(finding.description)}`);

  lines.push("   - Suggested fixes:");
  suggestionsForFinding(finding).forEach((suggestion) => {
    lines.push(`     - ${oneLine(suggestion)}`);
  });

  if (finding.items.length === 0) {
    lines.push("   - Affected items: Lighthouse did not provide element-level evidence for this finding.");
  } else {
    lines.push(`   - Affected items (${finding.items.length}):`);
    finding.items.forEach((item, itemIndex) => {
      lines.push(...formatPromptEvidence(item, itemIndex + 1));
    });
  }

  return lines.join("\n");
}

function formatPromptEvidence(item: AuditFindingItem, index: number) {
  const lines = [`     ${index}. ${oneLine(item.label)}`];
  if (item.value) lines.push(`        - Value: ${oneLine(item.value)}`);
  if (item.selector) lines.push(`        - Selector: ${oneLine(item.selector)}`);
  if (item.url) lines.push(`        - URL: ${item.url}`);
  if (item.snippet) lines.push(`        - Snippet: ${oneLine(item.snippet)}`);
  return lines;
}

function oneLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function recheckEndpoint() {
  return `${typeof window === "undefined" ? "" : window.location.origin}/api/lighthouse/recheck`;
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function FindingDetail({ finding, defaultOpen }: { finding: AuditCategoryFinding; defaultOpen: boolean }) {
  const suggestions = suggestionsForFinding(finding);

  return (
    <details className={`score-finding analysis-finding ${finding.impact}`} open={defaultOpen}>
      <summary>
        <span className="score-finding-copy">
          <strong>{finding.title}</strong>
          <span>{impactLabel(finding)}</span>
        </span>
      </summary>
      <div className="score-finding-detail">
        {finding.description && <p>{finding.description}</p>}
        <div className="score-finding-fix">
          <h4><Lightbulb size={13} /> Suggested fix</h4>
          <ul>
            {suggestions.map((suggestion) => <li key={suggestion}>{suggestion}</li>)}
          </ul>
        </div>
        <div className="score-finding-evidence">
          <h4><ListChecks size={13} /> Affected items</h4>
          {finding.items.length === 0 ? (
            <p>No element-level evidence was reported by Lighthouse for this finding.</p>
          ) : (
            <ul>
              {finding.items.map((item, index) => <FindingEvidence key={`${item.label}-${index}`} item={item} />)}
            </ul>
          )}
        </div>
      </div>
    </details>
  );
}

function FindingEvidence({ item }: { item: AuditFindingItem }) {
  return (
    <li>
      <strong title={item.label}>{item.label}</strong>
      {item.value && <span>{item.value}</span>}
      {item.selector && <code>{item.selector}</code>}
      {item.url && <a href={item.url} target="_blank" rel="noreferrer">{item.url}</a>}
      {item.snippet && <pre>{item.snippet}</pre>}
    </li>
  );
}

function impactLabel(finding: AuditCategoryFinding) {
  const score = finding.score == null ? "manual review" : `${finding.score}/100`;
  const value = finding.displayValue ?? score;
  if (finding.impact === "failed") return `Blocker · ${value}`;
  if (finding.impact === "warning") return `Warning · ${value}`;
  return `Manual check · ${value}`;
}

function groupFindings(findings: AuditCategoryFinding[], filter: StatusFilter) {
  const groups = new Map<string, { key: string; label: string; findings: AuditCategoryFinding[] }>();

  findings.forEach((finding) => {
    if (filter !== "all" && finding.impact !== filter) return;
    const group = groupForFinding(finding);
    const current = groups.get(group.key) ?? { ...group, findings: [] };
    current.findings.push(finding);
    groups.set(group.key, current);
  });

  return [...groups.values()].sort((a, b) => {
    const statusDelta = statusRank(dominantStatus(b.findings)) - statusRank(dominantStatus(a.findings));
    if (statusDelta !== 0) return statusDelta;
    return b.findings.length - a.findings.length;
  });
}

function countFindings(findings: AuditCategoryFinding[]) {
  const counts: Record<StatusFilter, number> = { all: findings.length, failed: 0, warning: 0, manual: 0 };
  findings.forEach((finding) => {
    counts[finding.impact] += 1;
  });
  return counts;
}

function dominantStatus(findings: AuditCategoryFinding[]): FindingStatus {
  if (findings.some((finding) => finding.impact === "failed")) return "failed";
  if (findings.some((finding) => finding.impact === "warning")) return "warning";
  return "manual";
}

function statusRank(status: FindingStatus) {
  if (status === "failed") return 3;
  if (status === "warning") return 2;
  return 1;
}

function statusLabel(status: FindingStatus) {
  if (status === "failed") return "Blocker";
  if (status === "warning") return "Warning";
  return "Manual";
}

function groupForFinding(finding: AuditCategoryFinding) {
  const text = `${finding.id} ${finding.title}`.toLowerCase();
  if (text.includes("largest-contentful-paint") || text.includes("lcp")) return { key: "lcp", label: "LCP and hero rendering" };
  if (text.includes("total-blocking-time") || text.includes("mainthread") || text.includes("long-task") || text.includes("bootup")) return { key: "main-thread", label: "Main-thread blocking" };
  if (text.includes("layout-shift") || text.includes("cls") || text.includes("cumulative-layout-shift")) return { key: "layout-shift", label: "Layout stability" };
  if (text.includes("image") || text.includes("alt")) return { key: "images", label: "Images and media" };
  if (text.includes("contrast") || text.includes("background and foreground")) return { key: "contrast", label: "Text contrast" };
  if (text.includes("link") || text.includes("name") || text.includes("discernible")) return { key: "accessible-names", label: "Accessible names and links" };
  if (text.includes("cookie")) return { key: "cookies", label: "Cookies and privacy" };
  if (text.includes("deprec")) return { key: "deprecated", label: "Deprecated APIs" };
  if (text.includes("robots-txt") || text.includes("llms-txt")) return { key: "crawler-text-files", label: "Crawler and AI discovery files" };
  if (text.includes("seo") || text.includes("crawl") || text.includes("meta")) return { key: "seo", label: "Search metadata" };
  return { key: "other", label: "Other audit findings" };
}

function suggestionsForFinding(finding: AuditCategoryFinding) {
  const id = finding.id.toLowerCase();
  const title = finding.title.toLowerCase();
  const text = `${id} ${title}`;

  if (text.includes("total-blocking-time") || text.includes("mainthread") || text.includes("long-task")) {
    return [
      "Split or defer non-critical JavaScript so the main thread is free during initial render.",
      "Remove unused third-party scripts and move analytics, widgets, and tags after first interaction when possible."
    ];
  }
  if (text.includes("largest-contentful-paint") || text.includes("lcp")) {
    return [
      "Prioritize the LCP element: preload its image/font, avoid lazy-loading it, and keep it discoverable in the initial HTML.",
      "Reduce server response time and render-blocking CSS/JS before the LCP element paints."
    ];
  }
  if (text.includes("layout-shift") || text.includes("cumulative-layout-shift") || text.includes("cls")) {
    return [
      "Reserve explicit width, height, or aspect-ratio for images, embeds, ads, and dynamic content.",
      "Avoid inserting banners or late-loading UI above existing content unless space is already reserved."
    ];
  }
  if (text.includes("color-contrast") || text.includes("background and foreground")) {
    return [
      "Increase the foreground/background contrast for each listed element to meet WCAG AA.",
      "Check hover, focus, disabled, and selected states too; Lighthouse only reports the captured state."
    ];
  }
  if (text.includes("image-alt") || text.includes("alt")) {
    return [
      "Add meaningful alt text for informative images and empty alt attributes for decorative images.",
      "For linked images, make the alt text describe the link destination or action."
    ];
  }
  if (text.includes("link-name") || text.includes("descriptive text") || text.includes("discernible name")) {
    return [
      "Replace vague link text with labels that describe the destination or action.",
      "If the link is icon-only, add an accessible name with visible text or an aria-label."
    ];
  }
  if (text.includes("deprec")) {
    return [
      "Open the affected source URL or stack trace and replace the deprecated browser API with the current supported API.",
      "Update the dependency that owns the call if it comes from a third-party bundle."
    ];
  }
  if (text.includes("cookie")) {
    return [
      "Audit the listed third-party cookie owner and remove it if it is not required for the audited journey.",
      "If it is required, confirm the provider has a first-party or partitioned-cookie path for modern browser privacy rules."
    ];
  }
  if (id.startsWith("robots-txt")) {
    if (id.includes("sitemap")) {
      return [
        "Add a Sitemap directive to /robots.txt using an absolute URL such as 'Sitemap: https://example.com/sitemap.xml'.",
        "Make sure the sitemap contains canonical public URLs and is updated when content changes."
      ];
    }
    if (id.includes("blocks-all")) {
      return [
        "Remove blanket 'Disallow: /' rules from production robots.txt unless the entire origin should stay private.",
        "Replace broad blocks with path-scoped rules for private, duplicate, or low-value routes."
      ];
    }
    return [
      "Serve /robots.txt as plain text from the origin root with at least 'User-agent: *' and explicit Allow or Disallow directives.",
      "Keep robots.txt deterministic and cacheable, and avoid returning the frontend app shell or an HTML error page."
    ];
  }
  if (id.startsWith("llms-txt")) {
    return [
      "Add /llms.txt as concise Markdown with one H1, a short blockquote summary, and curated Markdown links to the most useful pages.",
      "Include durable URLs for docs, pricing, API references, policies, and other pages an AI assistant should read before answering."
    ];
  }

  return [
    "Review the affected items below, then fix the underlying template/component so the issue is resolved everywhere it appears.",
    "Re-run the audit after the change and compare this finding's score and item count."
  ];
}
