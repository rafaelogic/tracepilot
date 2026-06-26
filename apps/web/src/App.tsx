import { useEffect, useState } from "react";
import { Topbar } from "./components/common/Topbar";
import { AuditConsole } from "./components/console/AuditConsole";
import { RunHistory } from "./components/history/RunHistory";
import { ReportView } from "./components/report/ReportView";
import { ToolsPage } from "./components/tools/ToolsPage";
import { useAuditWorkspace } from "./hooks/useAuditWorkspace";
import { parseReportRoute, reportPath, type ReportRoute } from "./utils/reportRoutes";

export function App() {
  const workspace = useAuditWorkspace();
  const route = useReportRoute();
  const appRoute = useAppRoute();
  const view = resolveWorkspaceView(workspace.isInitializing, workspace.activeRunId);
  const hasReport = view === "report";
  const auditConsole = (
    <AuditConsole
      compact={hasReport}
      mode={workspace.mode}
      device={workspace.device}
      input={workspace.input}
      startUrl={workspace.startUrl}
      settings={workspace.settings}
      placeholder={workspace.placeholder}
      canRun={workspace.canRun}
      error={workspace.error}
      onModeChange={workspace.setMode}
      onDeviceChange={workspace.setDevice}
      onInputChange={workspace.setInput}
      onStartUrlChange={workspace.setStartUrl}
      onSettingsChange={workspace.setSettings}
      onRun={workspace.runAudit}
    />
  );

  function navigate(path: string) {
    if (window.location.pathname !== path) window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  return (
    <div className="app-shell">
      <Topbar />

      {appRoute === "tools" ? (
        <ToolsPage />
      ) : view === "loading" ? (
        <main className="workspace workspace-loading" aria-busy="true" aria-label="Loading audit workspace">
          <div className="workspace-loading-indicator" role="status">
            <span className="pulse-dot" />
            Loading workspace
          </div>
        </main>
      ) : view === "home" ? (
        <main className="workspace">
          {auditConsole}
        </main>
      ) : (
      <main className={hasReport ? "workspace report-active" : "workspace"}>
        {auditConsole}

        <section className="content-grid">
          <RunHistory runs={workspace.history} activeRunId={workspace.activeRunId} onSelectRun={workspace.selectRun} onDeleteRun={workspace.deleteRun} />
          <ReportView
            report={workspace.report}
            route={route}
            onNavigate={navigate}
            onSelectTab={(tab) => workspace.report && navigate(reportPath(workspace.report.id, tab))}
          />
        </section>
      </main>
      )}
    </div>
  );
}

export function resolveWorkspaceView(isInitializing: boolean, activeRunId: string | null) {
  if (activeRunId) return "report";
  return isInitializing ? "loading" : "home";
}

function useAppRoute() {
  const [route, setRoute] = useState(() => appRouteFromPath());

  useEffect(() => {
    const updateRoute = () => setRoute(appRouteFromPath());
    window.addEventListener("popstate", updateRoute);
    return () => window.removeEventListener("popstate", updateRoute);
  }, []);

  return route;
}

function appRouteFromPath() {
  return window.location.pathname.startsWith("/tools") ? "tools" : "workspace";
}

function useReportRoute() {
  const [route, setRoute] = useState<ReportRoute>(() => parseReportRoute());

  useEffect(() => {
    const updateRoute = () => setRoute(parseReportRoute());
    window.addEventListener("popstate", updateRoute);
    return () => window.removeEventListener("popstate", updateRoute);
  }, []);

  return route;
}
