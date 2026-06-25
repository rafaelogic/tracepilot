export type AuditMode = "url" | "journey";
export type AuditStatus = "queued" | "running" | "completed" | "failed";
export type DeviceProfile = "mobile" | "desktop";
export type AuditProgressStage =
  | "queued"
  | "preparing-browser"
  | "navigating"
  | "observing-sections"
  | "collecting-resources"
  | "running-lighthouse"
  | "saving-report"
  | "completed"
  | "failed";

export interface AuditProgress {
  stage: AuditProgressStage;
  percent: number;
  message: string;
}

export interface AuditScores {
  performance: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  seo: number | null;
}

export type AuditScoreCategory = keyof AuditScores;

export interface LighthousePassMetrics {
  firstContentfulPaint?: string | null;
  largestContentfulPaint?: string | null;
  totalBlockingTime?: string | null;
  cumulativeLayoutShift?: string | null;
  speedIndex?: string | null;
}

export interface LighthousePassSummary {
  index: number;
  scores: AuditScores;
  metrics: LighthousePassMetrics;
  environment?: {
    benchmarkIndex?: number;
    hostUserAgent?: string;
    networkUserAgent?: string;
  };
  warnings: string[];
  fetchTime?: string | null;
  finalUrl?: string | null;
  lighthouseVersion?: string | null;
  error?: string | null;
}

export interface LighthousePassesMetadata {
  passCount: number;
  aggregation: "median-performance-pass";
  selectedPassIndex: number | null;
  lighthouseVersion?: string | null;
  passes: LighthousePassSummary[];
}

export interface AuditSettings {
  compareToRunId?: string;
  throttle?: "default" | "fast" | "slow";
  lighthousePassCount?: number;
  targetScores?: Partial<Record<AuditScoreCategory, number>>;
}

export interface AuditFindingItem {
  label: string;
  value?: string | null;
  selector?: string | null;
  snippet?: string | null;
  url?: string | null;
}

export type AgenticBrowsingCheckStatus = "passed" | "failed" | "warning" | "manual" | "notApplicable";

export interface AgenticBrowsingCheck {
  id: string;
  title: string;
  description?: string | null;
  score: number | null;
  displayValue?: string | null;
  status: AgenticBrowsingCheckStatus;
  items: AuditFindingItem[];
}

export interface AgenticBrowsingResult {
  score: number | null;
  title: string;
  description?: string | null;
  checks: AgenticBrowsingCheck[];
}

export interface AuditCategoryFinding {
  id: string;
  title: string;
  description?: string | null;
  score: number | null;
  displayValue?: string | null;
  weight: number;
  impact: "failed" | "warning" | "manual";
  items: AuditFindingItem[];
}

export type AuditCategoryBreakdown = Partial<Record<AuditScoreCategory, AuditCategoryFinding[]>>;

export interface SectionTimelineEntry {
  id?: string;
  label: string;
  selector: string;
  elementHtml?: string | null;
  top: number;
  height: number;
  firstDetectedMs: number;
  firstVisibleMs: number | null;
  contentStableMs: number | null;
  renderCompleteMs: number | null;
  layoutShiftScore: number;
  blockingResourceCount: number;
}

export interface ResourceTimingEntry {
  id?: string;
  sectionTimingId?: string | null;
  url: string;
  type: string;
  initiator?: string | null;
  startMs: number;
  durationMs: number;
  transferSize?: number | null;
  status?: number | null;
}

export interface JourneyStepEntry {
  index: number;
  action: string;
  status: "running" | "completed" | "failed";
  startedAtMs?: number | null;
  endedAtMs?: number | null;
  detail?: string | null;
}

export interface AuditRunSummary {
  id: string;
  mode: AuditMode;
  status: AuditStatus;
  input: string;
  startUrl?: string | null;
  finalUrl?: string | null;
  goal?: string | null;
  device: string;
  label?: string | null;
  error?: string | null;
  scores: AuditScores;
  categoryBreakdown?: AuditCategoryBreakdown;
  agenticBrowsing?: AgenticBrowsingResult;
  lighthousePasses?: LighthousePassesMetadata;
  settings?: AuditSettings;
  progress: AuditProgress;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface AuditReport extends AuditRunSummary {
  sections: SectionTimelineEntry[];
  resources: ResourceTimingEntry[];
  journeySteps: JourneyStepEntry[];
}

export interface CreateAuditRequest {
  input: string;
  mode: AuditMode;
  device: DeviceProfile;
  label?: string;
  settings?: AuditSettings;
}

export interface CreateJourneyRequest {
  startUrl: string;
  goal: string;
  device: DeviceProfile;
  label?: string;
  settings?: CreateAuditRequest["settings"];
}

export interface AuditComparison {
  baseRunId: string;
  targetRunId: string;
  scoreDeltas: Partial<Record<keyof AuditScores, number | null>>;
  sectionDeltas: Array<{
    label: string;
    baseRenderCompleteMs: number | null;
    targetRenderCompleteMs: number | null;
    deltaMs: number | null;
    regressed: boolean;
  }>;
}

export interface LighthouseRecheckAudit {
  id: string;
  title: string;
  displayValue?: string | null;
  score: number | null;
  items: AuditFindingItem[];
}

export interface LighthouseRecheckResponse {
  scores: AuditScores;
  passedTarget: boolean;
  target: Record<AuditScoreCategory, number>;
  metrics: {
    firstContentfulPaint?: string | null;
    largestContentfulPaint?: string | null;
    totalBlockingTime?: string | null;
    cumulativeLayoutShift?: string | null;
    speedIndex?: string | null;
  };
  opportunities: LighthouseRecheckAudit[];
  diagnostics: LighthouseRecheckAudit[];
}
