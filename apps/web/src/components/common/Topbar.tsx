import { Activity, Gauge, RadioTower, Wrench } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";

export function Topbar() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const updatePath = () => setPath(window.location.pathname);
    window.addEventListener("popstate", updatePath);
    return () => window.removeEventListener("popstate", updatePath);
  }, []);

  function navigate(event: React.MouseEvent<HTMLAnchorElement>, path: string) {
    event.preventDefault();
    if (window.location.pathname !== path) window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  const isTools = path.startsWith("/tools");

  return (
    <header className="topbar">
      <a className="brand brand-link" href="/" onClick={(event) => navigate(event, "/")}>
        <span className="brand-mark">
          <Activity size={18} />
        </span>
        <span className="brand-copy">
          <strong>Tracepilot</strong>
          <small>Web performance auditor</small>
        </span>
      </a>
      <div className="topbar-actions">
        <a className={`topbar-link ${isTools ? "" : "active"}`} href="/" onClick={(event) => navigate(event, "/")}>
          <Gauge size={15} aria-hidden="true" />
          <span>Audit</span>
        </a>
        <a className={`topbar-link ${isTools ? "active" : ""}`} href="/tools" onClick={(event) => navigate(event, "/tools")}>
          <Wrench size={15} aria-hidden="true" />
          <span>Tools</span>
        </a>
        <RadioTower size={15} aria-hidden="true" />
        <span className="status-led" aria-hidden="true" />
        <span>Console ready</span>
      </div>
    </header>
  );
}
