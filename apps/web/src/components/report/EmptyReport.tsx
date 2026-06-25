export function EmptyReport() {
  return (
    <section className="report-panel empty-report">
      <div className="orbital-ring" />
      <h2>Waiting for a target</h2>
      <p>Run a URL or journey audit to generate Lighthouse scores, section timeline, and resource timing.</p>
    </section>
  );
}
