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
  screenshot?: {
    dataUrl: string;
    clip: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    target: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    highlight: boolean;
  } | null;
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

export interface CrawlerFileAuditFile {
  kind: "robots" | "llms";
  url: string;
  status: number | null;
  contentType: string | null;
  ok: boolean;
  snippet: string | null;
  error?: string;
}

export interface CrawlerFilesAuditResponse {
  url: string;
  origin: string;
  files: CrawlerFileAuditFile[];
  findings: AuditCategoryFinding[];
  passed: boolean;
}

export interface PageStructureHeading {
  level: number;
  text: string;
  selector: string;
}

export interface PageStructureAuditResponse {
  url: string;
  finalUrl: string;
  status: number | null;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  headings: PageStructureHeading[];
  findings: AuditCategoryFinding[];
  passed: boolean;
}

export interface StructuredDataItem {
  type: string | null;
  id: string | null;
  valid: boolean;
  errors: string[];
  snippet: string;
}

export interface StructuredDataAuditResponse {
  url: string;
  finalUrl: string;
  status: number | null;
  items: StructuredDataItem[];
  findings: AuditCategoryFinding[];
  passed: boolean;
}

export interface InternalLinkGraphEntry {
  url: string;
  status: number | null;
  title: string | null;
  linkCount: number;
  error?: string;
}

export interface InternalLinkGraphResponse {
  url: string;
  origin: string;
  crawled: InternalLinkGraphEntry[];
  brokenLinks: Array<{ from: string; to: string; status: number | null; text: string }>;
  findings: AuditCategoryFinding[];
  passed: boolean;
}

export interface MetadataSocialPreviewResponse {
  url: string;
  finalUrl: string;
  status: number | null;
  title: string | null;
  description: string | null;
  canonical: string | null;
  openGraph: Record<string, string | null>;
  twitter: Record<string, string | null>;
  icons: Array<{ rel: string; href: string; sizes?: string | null }>;
  findings: AuditCategoryFinding[];
  passed: boolean;
}

export interface ThirdPartyScriptParty {
  origin: string;
  requestCount: number;
  scriptCount: number;
  resourceTypes: string[];
  urls: string[];
}

export interface ThirdPartyScriptInventoryResponse {
  url: string;
  finalUrl: string;
  firstPartyOrigin: string;
  parties: ThirdPartyScriptParty[];
  findings: AuditCategoryFinding[];
  passed: boolean;
}

export interface ContentFreshnessIndexabilityResponse {
  url: string;
  finalUrl: string;
  status: number | null;
  robotsMeta: string | null;
  canonical: string | null;
  sitemapUrl: string | null;
  sitemapStatus: number | null;
  dateSignals: Array<{ label: string; value: string }>;
  findings: AuditCategoryFinding[];
  passed: boolean;
}

export interface JavaScriptExecutionProfileResponse {
  url: string;
  finalUrl: string;
  status: number | null;
  totalLongTaskTime: number;
  maxLongTaskTime: number;
  longTasks: Array<{ startTime: number; duration: number; attribution: string[] }>;
  scriptResources: Array<{ url: string; transferSize: number; duration: number }>;
  findings: AuditCategoryFinding[];
  passed: boolean;
}

export interface CoverageAuditResponse {
  url: string;
  finalUrl: string;
  js: { totalBytes: number; unusedBytes: number; files: Array<{ url: string; totalBytes: number; unusedBytes: number }> };
  css: { totalBytes: number; unusedBytes: number; files: Array<{ url: string; totalBytes: number; unusedBytes: number }> };
  findings: AuditCategoryFinding[];
  passed: boolean;
}

export interface BundleCompositionResponse {
  url: string;
  finalUrl: string;
  totalScriptBytes: number;
  firstPartyBytes: number;
  thirdPartyBytes: number;
  scripts: Array<{ url: string; bytes: number; firstParty: boolean; host: string }>;
  findings: AuditCategoryFinding[];
  passed: boolean;
}

export interface ImageOptimizationResponse {
  url: string;
  finalUrl: string;
  images: Array<{ src: string; format: string; transferSize: number; naturalWidth: number; naturalHeight: number; displayWidth: number; displayHeight: number; oversizedRatio: number }>;
  totalImageBytes: number;
  potentialSavings: number;
  findings: AuditCategoryFinding[];
  passed: boolean;
}

export interface CriticalCssResponse {
  url: string;
  finalUrl: string;
  totalCssBytes: number;
  unusedCssBytes: number;
  blockingStylesheets: Array<{ url: string; media: string | null }>;
  stylesheets: Array<{ url: string; totalBytes: number; unusedBytes: number }>;
  findings: AuditCategoryFinding[];
  passed: boolean;
}

export interface RumSnippetResponse {
  url: string;
  finalUrl: string;
  endpointPath: string;
  snippet: string;
  metrics: string[];
  payloadShape: Record<string, string>;
  findings: AuditCategoryFinding[];
  passed: boolean;
}

export interface ThirdPartyMitigationResponse {
  url: string;
  finalUrl: string;
  firstPartyOrigin: string;
  parties: Array<{ origin: string; requestCount: number; scriptCount: number; resourceTypes: string[]; recommendations: string[] }>;
  findings: AuditCategoryFinding[];
  passed: boolean;
}

export interface PrefetchOpportunityResponse {
  url: string;
  finalUrl: string;
  candidates: Array<{ url: string; text: string; reason: string; visible: boolean }>;
  avoid: Array<{ url: string; text: string; reason: string }>;
  speculationRules: string;
  findings: AuditCategoryFinding[];
  passed: boolean;
}

export interface RepeatViewFilmstripResponse {
  url: string;
  finalUrl: string;
  firstView: { loadEventEnd: number; domContentLoaded: number; transferSize: number; screenshots: Array<{ atMs: number; dataUrl: string }> };
  repeatView: { loadEventEnd: number; domContentLoaded: number; transferSize: number; screenshots: Array<{ atMs: number; dataUrl: string }> };
  findings: AuditCategoryFinding[];
  passed: boolean;
}
