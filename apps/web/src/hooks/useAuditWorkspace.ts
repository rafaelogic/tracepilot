import { useEffect, useMemo, useState } from "react";
import type { AuditReport, AuditRunSummary, AuditSettings, DeviceProfile } from "../../../../packages/shared/types";
import { createJourneyAudit, createUrlAudit, deleteAudit, getAudit, listAudits } from "../services/auditApi";
import { parseReportRoute, reportPath } from "../utils/reportRoutes";

export type AuditMode = "url" | "journey";

const defaultAuditSettings: Required<Pick<AuditSettings, "lighthousePassCount" | "targetScores">> = {
  lighthousePassCount: 5,
  targetScores: {
    performance: 90,
    accessibility: 90,
    bestPractices: 90,
    seo: 90
  }
};

export function useAuditWorkspace() {
  const [mode, setMode] = useState<AuditMode>("url");
  const [device, setDevice] = useState<DeviceProfile>("mobile");
  const [input, setInput] = useState("");
  const [startUrl, setStartUrl] = useState("");
  const [settings, setSettings] = useState<AuditSettings>(defaultAuditSettings);
  const [activeRunId, setActiveRunId] = useState<string | null>(() => routeRunId());
  const [report, setReport] = useState<AuditReport | null>(null);
  const [history, setHistory] = useState<AuditRunSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const isRunning = report?.status === "queued" || report?.status === "running" || isSubmitting;
  const canRun = Boolean(input.trim()) && (mode === "url" || Boolean(startUrl.trim())) && !isRunning;
  const placeholder = useMemo(
    () =>
      mode === "url"
        ? "https://your-site.test or http://localhost:3000"
        : "Open dashboard, apply Last 30 days, then audit the report table",
    [mode]
  );

  useEffect(() => {
    let active = true;
    refreshHistory()
      .catch(() => undefined)
      .finally(() => {
        if (active) setIsInitializing(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handlePopState = () => setActiveRunId(routeRunId());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!activeRunId) return;
    let stopped = false;

    const poll = async () => {
      const next = await getAudit(activeRunId);
      if (stopped) return;
      setReport(next);
      if (next.status === "completed" || next.status === "failed") {
        await refreshHistory();
        return;
      }
      window.setTimeout(poll, 1000);
    };

    poll().catch((pollError) => {
      setError(pollError instanceof Error ? pollError.message : "Unable to load report");
    });

    return () => {
      stopped = true;
    };
  }, [activeRunId]);

  async function runAudit() {
    setError(null);
    setIsSubmitting(true);
    try {
      const run =
        mode === "url"
          ? await createUrlAudit(input.trim(), device, normalizeSettings(settings))
          : await createJourneyAudit(startUrl.trim(), input.trim(), device, normalizeSettings(settings));
      setActiveRunId(run.id);
      setUrl(reportPath(run.id));
      setReport({ ...run, sections: [], resources: [], journeySteps: [] });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to start audit");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function refreshHistory() {
    const runs = await listAudits();
    setHistory(runs);
    setActiveRunId((current) => current ?? routeRunId() ?? runs[0]?.id ?? null);
  }

  function selectRun(runId: string) {
    const run = history.find((item) => item.id === runId);
    if (run) {
      const url = run.finalUrl || run.startUrl || run.input;
      setMode("url");
      setInput(url);
      setDevice(run.device === "desktop" ? "desktop" : "mobile");
      setSettings(normalizeSettings(run.settings ?? defaultAuditSettings));
    }
    setActiveRunId(runId);
    setUrl(reportPath(runId));
  }

  async function deleteRun(runId: string) {
    setError(null);
    try {
      await deleteAudit(runId);
      const runs = await listAudits();
      setHistory(runs);
      if (activeRunId === runId) {
        setReport(null);
        const nextRunId = runs[0]?.id ?? null;
        setActiveRunId(nextRunId);
        setUrl(nextRunId ? reportPath(nextRunId) : "/");
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete audit");
    }
  }

  return {
    mode,
    setMode,
    device,
    setDevice,
    input,
    setInput,
    startUrl,
    setStartUrl,
    settings,
    setSettings,
    activeRunId,
    selectRun,
    deleteRun,
    report,
    history,
    error,
    isInitializing,
    canRun,
    placeholder,
    runAudit
  };
}

function normalizeSettings(settings: AuditSettings): AuditSettings {
  return {
    ...settings,
    lighthousePassCount: clampInteger(settings.lighthousePassCount ?? defaultAuditSettings.lighthousePassCount, 1, 9),
    targetScores: {
      performance: clampInteger(settings.targetScores?.performance ?? 90, 0, 100),
      accessibility: clampInteger(settings.targetScores?.accessibility ?? 90, 0, 100),
      bestPractices: clampInteger(settings.targetScores?.bestPractices ?? 90, 0, 100),
      seo: clampInteger(settings.targetScores?.seo ?? 90, 0, 100)
    }
  };
}

function clampInteger(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function routeRunId() {
  const route = parseReportRoute();
  return route.kind === "home" ? null : route.runId;
}

function setUrl(path: string) {
  if (window.location.pathname !== path) {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
}
