import type { AuditReport, AuditRunSummary, AuditSettings, DeviceProfile } from "../../../../packages/shared/types";

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
