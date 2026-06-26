import type {
  AuditReport,
  AuditRunSummary,
  AuditSettings,
  BundleCompositionResponse,
  ContentFreshnessIndexabilityResponse,
  CoverageAuditResponse,
  CrawlerFilesAuditResponse,
  CriticalCssResponse,
  DeviceProfile,
  ImageOptimizationResponse,
  InternalLinkGraphResponse,
  JavaScriptExecutionProfileResponse,
  MetadataSocialPreviewResponse,
  PageStructureAuditResponse,
  PrefetchOpportunityResponse,
  RepeatViewFilmstripResponse,
  RumSnippetResponse,
  StructuredDataAuditResponse,
  ThirdPartyMitigationResponse,
  ThirdPartyScriptInventoryResponse
} from "../../../../packages/shared/types";

export async function createUrlAudit(input: string, device: DeviceProfile, settings: AuditSettings) {
  return postJson<AuditRunSummary>("/api/audits", { input, mode: "url", device, settings });
}

export async function createJourneyAudit(startUrl: string, goal: string, device: DeviceProfile, settings: AuditSettings) {
  return postJson<AuditRunSummary>("/api/journeys", { startUrl, goal, device, settings });
}

export async function getAudit(id: string) {
  const response = await fetch(`/api/audits/${id}`);
  return parseResponse<AuditReport>(response);
}

export async function listAudits() {
  const response = await fetch("/api/audits");
  return parseResponse<AuditRunSummary[]>(response);
}

export async function deleteAudit(id: string) {
  const response = await fetch(`/api/audits/${id}`, { method: "DELETE" });
  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error ?? "Unable to delete audit");
  }
}

export async function checkCrawlerFiles(url: string) {
  return postJson<CrawlerFilesAuditResponse>("/api/tools/crawler-files", { url });
}

export async function checkPageStructure(url: string) {
  return postJson<PageStructureAuditResponse>("/api/tools/page-structure", { url });
}

export async function checkStructuredData(url: string) {
  return postJson<StructuredDataAuditResponse>("/api/tools/structured-data", { url });
}

export async function checkInternalLinkGraph(url: string) {
  return postJson<InternalLinkGraphResponse>("/api/tools/internal-link-graph", { url });
}

export async function checkMetadataSocial(url: string) {
  return postJson<MetadataSocialPreviewResponse>("/api/tools/metadata-social", { url });
}

export async function checkThirdPartyInventory(url: string) {
  return postJson<ThirdPartyScriptInventoryResponse>("/api/tools/third-party-inventory", { url });
}

export async function checkFreshnessIndexability(url: string) {
  return postJson<ContentFreshnessIndexabilityResponse>("/api/tools/freshness-indexability", { url });
}

export async function checkJsExecutionProfile(url: string) {
  return postJson<JavaScriptExecutionProfileResponse>("/api/tools/js-execution-profile", { url });
}

export async function checkUnusedCoverage(url: string) {
  return postJson<CoverageAuditResponse>("/api/tools/unused-coverage", { url });
}

export async function checkBundleComposition(url: string) {
  return postJson<BundleCompositionResponse>("/api/tools/bundle-composition", { url });
}

export async function checkImageOptimization(url: string) {
  return postJson<ImageOptimizationResponse>("/api/tools/image-optimization", { url });
}

export async function checkCriticalCss(url: string) {
  return postJson<CriticalCssResponse>("/api/tools/critical-css", { url });
}

export async function generateRumSnippet(url: string) {
  return postJson<RumSnippetResponse>("/api/tools/rum-snippet", { url });
}

export async function checkThirdPartyMitigation(url: string) {
  return postJson<ThirdPartyMitigationResponse>("/api/tools/third-party-mitigation", { url });
}

export async function checkPrefetchOpportunities(url: string) {
  return postJson<PrefetchOpportunityResponse>("/api/tools/prefetch-opportunities", { url });
}

export async function checkRepeatViewFilmstrip(url: string) {
  return postJson<RepeatViewFilmstripResponse>("/api/tools/repeat-view-filmstrip", { url });
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return parseResponse<T>(response);
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error ?? "Request failed");
  }
  return body as T;
}
