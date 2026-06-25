import type { AuditRunSummary } from "../../../../packages/shared/types";

export interface SiteRunGroup {
  key: string;
  label: string;
  latestAt: string;
  urls: UrlRunGroup[];
}

export interface UrlRunGroup {
  key: string;
  label: string;
  url: string;
  latestAt: string;
  desktop?: AuditRunSummary;
  mobile?: AuditRunSummary;
}

export function siteKeyForRun(run: AuditRunSummary) {
  const value = run.finalUrl || run.startUrl || run.input;
  try {
    const url = new URL(value);
    return url.host.toLowerCase().replace(/^www\./, "");
  } catch {
    return value.trim().toLowerCase();
  }
}

export function urlKeyForRun(run: AuditRunSummary) {
  const value = run.finalUrl || run.startUrl || run.input;
  try {
    const url = new URL(value);
    url.hash = "";
    url.searchParams.sort();
    const protocol = url.protocol.toLowerCase();
    const host = url.host.toLowerCase().replace(/^www\./, "");
    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    const search = url.search;
    return `${protocol}//${host}${pathname}${search}`;
  } catch {
    return value.trim().toLowerCase();
  }
}

export function groupRunsBySite(runs: AuditRunSummary[]) {
  const groups = new Map<string, SiteRunGroup>();

  for (const run of runs) {
    const key = siteKeyForRun(run);
    const urlKey = urlKeyForRun(run);
    const url = run.finalUrl || run.startUrl || run.input;
    const group = groups.get(key) ?? { key, label: key, latestAt: run.createdAt, urls: [] };
    let urlGroup = group.urls.find((item) => item.key === urlKey);
    if (!urlGroup) {
      urlGroup = { key: urlKey, label: urlLabel(url), url, latestAt: run.createdAt };
      group.urls.push(urlGroup);
    }
    const device = run.device === "desktop" ? "desktop" : "mobile";
    const current = urlGroup[device];

    if (!current || new Date(run.createdAt).getTime() > new Date(current.createdAt).getTime()) {
      urlGroup[device] = run;
    }
    if (new Date(run.createdAt).getTime() > new Date(urlGroup.latestAt).getTime()) {
      urlGroup.latestAt = run.createdAt;
      urlGroup.url = url;
      urlGroup.label = urlLabel(url);
    }
    if (new Date(run.createdAt).getTime() > new Date(group.latestAt).getTime()) group.latestAt = run.createdAt;
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      urls: group.urls.sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime())
    }))
    .sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime());
}

function urlLabel(value: string) {
  try {
    const url = new URL(value);
    return `${url.pathname}${url.search}` || "/";
  } catch {
    return value;
  }
}
