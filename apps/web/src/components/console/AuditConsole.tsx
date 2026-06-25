import { Bot, ChevronDown, Gauge, Laptop, Play, SlidersHorizontal, Smartphone } from "lucide-react";
import { useState } from "react";
import type { AuditScoreCategory, AuditSettings, DeviceProfile } from "../../../../../packages/shared/types";
import type { AuditMode } from "../../hooks/useAuditWorkspace";
import { SegmentedButton } from "../common/SegmentedButton";

const scoreInputs: Array<{ key: AuditScoreCategory; label: string }> = [
  { key: "performance", label: "Performance" },
  { key: "accessibility", label: "Accessibility" },
  { key: "bestPractices", label: "Best Practices" },
  { key: "seo", label: "SEO" }
];

interface AuditConsoleProps {
  compact: boolean;
  mode: AuditMode;
  device: DeviceProfile;
  input: string;
  startUrl: string;
  settings: AuditSettings;
  placeholder: string;
  canRun: boolean;
  error: string | null;
  onModeChange: (mode: AuditMode) => void;
  onDeviceChange: (device: DeviceProfile) => void;
  onInputChange: (value: string) => void;
  onStartUrlChange: (value: string) => void;
  onSettingsChange: (settings: AuditSettings) => void;
  onRun: () => void;
}

export function AuditConsole(props: AuditConsoleProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const targetScores = props.settings.targetScores ?? {};

  function updatePassCount(value: string) {
    props.onSettingsChange({
      ...props.settings,
      lighthousePassCount: toBoundedInteger(value, 1, 9, 5)
    });
  }

  function updateTargetScore(key: AuditScoreCategory, value: string) {
    props.onSettingsChange({
      ...props.settings,
      targetScores: {
        performance: targetScores.performance ?? 90,
        accessibility: targetScores.accessibility ?? 90,
        bestPractices: targetScores.bestPractices ?? 90,
        seo: targetScores.seo ?? 90,
        [key]: toBoundedInteger(value, 0, 100, 90)
      }
    });
  }

  return (
    <section className={props.compact ? "console-panel compact" : "console-panel"}>
      <div className="console-intro">
        <div className="console-kicker">
          <Bot size={16} />
          <span>TP–01 / Agentic performance console</span>
        </div>
        <h1>{props.compact ? <>Audit another <span>target.</span></> : <>Find the slow section <span>before it ships.</span></>}</h1>
        <p className="lede">{props.compact ? "Run another URL or journey without leaving the current report." : "Audit a URL or send the browser through a user journey, then inspect section timing, network cost, and regressions."}</p>
      </div>

      <div className="composer">
        <div className="composer-header">
          <span>Audit configuration</span>
          <button
            type="button"
            className="settings-button"
            onClick={() => setAdvancedOpen((open) => !open)}
            aria-label={advancedOpen ? "Close advanced settings" : "Open advanced settings"}
            aria-controls="advanced-settings-panel"
            aria-expanded={advancedOpen}
            title={advancedOpen ? "Close advanced settings" : "Open advanced settings"}
          >
            <SlidersHorizontal size={17} />
            <ChevronDown size={14} className={advancedOpen ? "open" : ""} />
          </button>
        </div>
        <div className="mode-row">
          <SegmentedButton active={props.mode === "url"} onClick={() => props.onModeChange("url")} icon={<Gauge size={15} />} label="URL" />
          <SegmentedButton active={props.mode === "journey"} onClick={() => props.onModeChange("journey")} icon={<Bot size={15} />} label="Journey" />
          <span className="divider" />
          <SegmentedButton active={props.device === "mobile"} onClick={() => props.onDeviceChange("mobile")} icon={<Smartphone size={15} />} label="Mobile" />
          <SegmentedButton active={props.device === "desktop"} onClick={() => props.onDeviceChange("desktop")} icon={<Laptop size={15} />} label="Desktop" />
        </div>

        {props.mode === "journey" && (
          <input
            className="start-url-input"
            value={props.startUrl}
            onChange={(event) => props.onStartUrlChange(event.target.value)}
            placeholder="Start URL, e.g. http://localhost:3000/login"
            aria-label="Journey start URL"
          />
        )}

        <div className="prompt-row">
          <textarea
            value={props.input}
            onChange={(event) => props.onInputChange(event.target.value)}
            placeholder={props.placeholder}
            aria-label={props.mode === "url" ? "URL to audit" : "Journey goal"}
            rows={props.mode === "url" ? 1 : 3}
          />
          <button className="run-button" type="button" onClick={props.onRun} disabled={!props.canRun}>
            <Play size={16} fill="currentColor" />
            Run audit
          </button>
        </div>

        <div className="advanced-settings">
          {advancedOpen && (
            <div className="advanced-settings-panel" id="advanced-settings-panel">
              <label className="advanced-field pass-count-field">
                <span>Lighthouse passes</span>
                <input
                  type="number"
                  min={1}
                  max={9}
                  step={1}
                  value={props.settings.lighthousePassCount ?? 5}
                  onChange={(event) => updatePassCount(event.target.value)}
                  aria-label="Number of Lighthouse passes"
                />
              </label>
              <div className="target-score-grid" aria-label="AI agent target category scores">
                {scoreInputs.map((item) => (
                  <label className="advanced-field" key={item.key}>
                    <span>{item.label}</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={targetScores[item.key] ?? 90}
                      onChange={(event) => updateTargetScore(item.key, event.target.value)}
                      aria-label={`${item.label} target score`}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {props.error && <div className="error-banner" role="alert">{props.error}</div>}
    </section>
  );
}

function toBoundedInteger(value: string, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}
