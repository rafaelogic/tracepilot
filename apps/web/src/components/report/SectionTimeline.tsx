import { ChevronDown, Clock3, Eye, MousePointer2, TimerReset } from "lucide-react";
import type React from "react";
import type { ResourceTimingEntry, SectionTimelineEntry } from "../../../../../packages/shared/types";
import { completeMs, formatMs, getTimelineMaxMs } from "../../utils/reportMetrics";

export function SectionTimeline({ sections, resources }: { sections: SectionTimelineEntry[]; resources: ResourceTimingEntry[] }) {
  const maxMs = getTimelineMaxMs(sections);

  return (
    <section className="report-canvas timeline-canvas">
      <div className="canvas-header">
        <div>
          <div className="panel-title"><TimerReset size={15} /> Section rendering timeline</div>
          <p>Follow each page region from detection to visible and stable. Focus or hover a row for evidence.</p>
        </div>
        <div className="timeline-legend">
          <span><i className="visible" /> Visible</span>
          <span><i className="stable" /> Stabilizing</span>
        </div>
      </div>

      {sections.length === 0 ? (
        <div className="timeline-empty">
          <Eye />
          <h3>No section evidence yet</h3>
          <p>The observer is waiting for semantic regions. Explicit <code>data-perf-section</code> labels provide the clearest timeline.</p>
        </div>
      ) : (
        <div className="timeline-board">
          <div className="timeline-axis">
            <span>Page section</span>
            <div>{[0, 25, 50, 75, 100].map((tick) => <i style={{ left: `${tick}%` }} key={tick}>{formatMs((maxMs * tick) / 100)}</i>)}</div>
          </div>
          <div className="timeline-rows">
            {sections.map((section) => <TimelineRow key={section.selector} section={section} resources={resources} maxMs={maxMs} />)}
          </div>
        </div>
      )}
    </section>
  );
}

function TimelineRow({ section, resources, maxMs }: { section: SectionTimelineEntry; resources: ResourceTimingEntry[]; maxMs: number }) {
  const detected = Math.max(0, section.firstDetectedMs);
  const visible = section.firstVisibleMs;
  const stable = section.contentStableMs;
  const complete = completeMs(section);
  const stableAt = stable ?? complete;
  const accordionId = `timeline-details-${section.id ?? section.selector.replace(/[^a-z0-9_-]/gi, "-")}`;
  const blockers = blockersForSection(section, resources);
  const suggestions = suggestionsForSection(section, blockers);

  return (
    <details className="timeline-entry" aria-label={`${section.label}, complete at ${formatMs(complete)}`}>
      <summary aria-controls={accordionId}>
        <span className="timeline-entry-label">
          <strong>{section.label}</strong>
          <small>{visible == null ? "Not observed in viewport" : `Visible ${formatMs(visible)}`}</small>
        </span>
        <span className="timeline-phase-track">
          <span className="phase-grid" />
          <i className="detected-marker" style={{ left: percent(detected, maxMs) }} />
          {visible != null && <span className="visible-phase" style={{ left: percent(visible, maxMs), width: range(visible, stableAt, maxMs) }} />}
          <span className="stable-phase" style={{ left: percent(stableAt, maxMs), width: range(stableAt, complete, maxMs) }} />
          <i className="complete-marker" style={{ left: percent(complete, maxMs) }} />
        </span>
        <span className="timeline-quick"><Clock3 /> {formatMs(complete)} <ChevronDown className="timeline-chevron" /></span>
        <span className="timeline-tooltip" role="tooltip">
          <span><small>Selector</small><strong>{section.selector}</strong></span>
          <dl>
            <div><dt>Detected</dt><dd>{formatMs(detected)}</dd></div>
            <div><dt>Visible</dt><dd>{formatMs(visible)}</dd></div>
            <div><dt>Stable</dt><dd>{formatMs(stable)}</dd></div>
            <div><dt>Complete</dt><dd>{formatMs(complete)}</dd></div>
            <div><dt>Layout shift</dt><dd>{section.layoutShiftScore.toFixed(3)}</dd></div>
            <div><dt>Blockers</dt><dd>{section.blockingResourceCount}</dd></div>
          </dl>
          <span><MousePointer2 /> Click to expand evidence for this page region</span>
        </span>
      </summary>
      <div className="timeline-accordion" id={accordionId}>
        <div className="timeline-accordion-grid">
          <EvidencePanel title="Section screenshot">
            <SectionScreenshot section={section} />
          </EvidencePanel>
          <EvidencePanel title="Raw HTML">
            <pre>{section.elementHtml || "Raw HTML was not captured for this audit. Re-run the audit with the updated observer."}</pre>
          </EvidencePanel>
          <EvidencePanel title={`Blockers (${blockers.length})`}>
            {blockers.length === 0 ? (
              <p>No likely blocking resources were captured for this section.</p>
            ) : (
              <ul className="timeline-blocker-list">
                {blockers.map((resource) => (
                  <li key={`${resource.url}-${resource.startMs}`}>
                    <span>{resource.type}</span>
                    <strong title={resource.url}>{resource.url}</strong>
                    <em>{formatMs(resource.durationMs)}</em>
                  </li>
                ))}
              </ul>
            )}
          </EvidencePanel>
          <EvidencePanel title="Suggestions">
            <ul className="timeline-suggestion-list">
              {suggestions.map((suggestion) => <li key={suggestion}>{suggestion}</li>)}
            </ul>
          </EvidencePanel>
        </div>
      </div>
    </details>
  );
}

function SectionScreenshot({ section }: { section: SectionTimelineEntry }) {
  const screenshot = section.screenshot;

  if (!screenshot) {
    return <p>No screenshot was captured for this section. Re-run the audit after this update to collect visual evidence.</p>;
  }

  return (
    <figure className="section-screenshot">
      <div className="section-screenshot-frame">
        <img src={screenshot.dataUrl} alt={`Screenshot of ${section.label}`} loading="lazy" />
        {screenshot.highlight && (
          <span
            className="section-screenshot-highlight"
            aria-hidden="true"
            style={{
              left: `${(screenshot.target.x / screenshot.clip.width) * 100}%`,
              top: `${(screenshot.target.y / screenshot.clip.height) * 100}%`,
              width: `${(screenshot.target.width / screenshot.clip.width) * 100}%`,
              height: `${(screenshot.target.height / screenshot.clip.height) * 100}%`
            }}
          />
        )}
      </div>
      {screenshot.highlight && <figcaption>Red outline marks this section within the captured page area.</figcaption>}
    </figure>
  );
}

function EvidencePanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="timeline-evidence-panel">
      <h4>{title}</h4>
      {children}
    </section>
  );
}

function blockersForSection(section: SectionTimelineEntry, resources: ResourceTimingEntry[]) {
  const blockingTypes = new Set(["document", "script", "stylesheet", "css", "font", "fetch", "xhr"]);
  const complete = completeMs(section);
  return resources
    .filter((resource) => {
      const type = resource.type.toLowerCase();
      const overlapsSectionRender = resource.startMs <= complete && resource.startMs + resource.durationMs >= section.firstDetectedMs;
      return overlapsSectionRender && (blockingTypes.has(type) || resource.durationMs >= 500);
    })
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, Math.max(3, Math.min(section.blockingResourceCount || 3, 8)));
}

function suggestionsForSection(section: SectionTimelineEntry, blockers: ResourceTimingEntry[]) {
  const suggestions = new Set<string>();
  if (section.firstVisibleMs == null) suggestions.add("Confirm this section is reachable in the audited viewport or lazy-render it only when needed.");
  if (section.layoutShiftScore > 0.01) suggestions.add("Reserve stable dimensions for images, embeds, and dynamic content in this section to reduce layout shift.");
  if (section.blockingResourceCount > 0) suggestions.add("Defer non-critical scripts/styles and preload only assets required for this section’s first render.");
  if (blockers.some((resource) => resource.type.toLowerCase().includes("font"))) suggestions.add("Preload critical fonts and use font-display: swap to avoid text render delays.");
  if (blockers.some((resource) => resource.type.toLowerCase().includes("script"))) suggestions.add("Audit long-running scripts that overlap this section’s render window; move non-critical code after interaction.");
  if (blockers.some((resource) => resource.type.toLowerCase().includes("css") || resource.type.toLowerCase().includes("stylesheet"))) suggestions.add("Inline critical CSS for above-the-fold content and split styles that are not needed by this section.");
  if (suggestions.size === 0) suggestions.add("No specific blocker pattern was detected. Inspect the raw HTML and network timings for component-level render work.");
  return [...suggestions];
}

function percent(value: number, maxMs: number) {
  return `${Math.min(99, Math.max(0, (value / maxMs) * 100))}%`;
}

function range(start: number, end: number, maxMs: number) {
  return `${Math.max(1, Math.min(100 - (start / maxMs) * 100, ((end - start) / maxMs) * 100))}%`;
}
