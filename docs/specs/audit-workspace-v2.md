# Spec: Audit Workspace V2

## Objective

Turn the audit screen into a live, results-first workspace. Users must understand what the auditor is doing, see desktop and mobile runs grouped by site, inspect a reliable section timeline, and move between large report canvases without long accordion-driven pages.

## Tech Stack

- React 18, TypeScript, Vite, plain tokenized CSS
- Express API, Prisma, PostgreSQL
- Playwright and Lighthouse audit runner
- Vitest for unit and integration-oriented logic tests

## Contract Changes

`AuditRunSummary` and `AuditReport` gain an additive progress object:

```ts
type AuditProgressStage =
  | "queued"
  | "preparing-browser"
  | "navigating"
  | "observing-sections"
  | "collecting-resources"
  | "running-lighthouse"
  | "saving-report"
  | "completed"
  | "failed";

interface AuditProgress {
  stage: AuditProgressStage;
  percent: number;
  message: string;
}
```

`AuditRun` gains `progressStage`, `progressPercent`, and `progressMessage` columns. Existing endpoint paths and existing response fields remain unchanged.

## UX Behavior

### Live progress

- Queued/running reports show a persistent progress module with percentage, current stage, explanatory message, and a completed/current/upcoming step list.
- Existing report polling updates progress at approximately one-second intervals.
- Progress survives page refresh because it is stored with the audit run.
- Failure preserves the last stage and displays the failure message.

### Grouped site history

- Runs are grouped by normalized site key: lowercase hostname plus non-default port, with `www.` removed.
- Each site appears once in history.
- A site group exposes the newest desktop and newest mobile run as separate selectors.
- Selecting a device switches the active report without starting a new audit.
- Repeated runs for the same site/device replace the visible selector with the newest run; older data remains persisted.
- Selecting a run fills the audit controls with its URL and device so it can be rerun or edited immediately.
- Each visible device run has a delete action with confirmation. Queued/running runs cannot be deleted.
- `DELETE /api/audits/:id` returns `204`, `404` for a missing run, and `409` for an active run.

### Report tabs

- Replace diagnostic accordions and the long stacked report with accessible tabs:
  - Overview: verdict, audit facts, category scores, findings, journey details.
  - Timeline: full-width section timeline.
  - Network: full-width resource list/waterfall.
  - Diagnostics: raw structured report.
- Tabs use native buttons, keyboard arrow navigation, `aria-selected`, `aria-controls`, and stable panels.
- The active tab resets to Overview when switching runs.

### Section timeline

- Fix observer startup by waiting for a document root before attaching observers.
- Capture semantic and large block candidates on pages with and without explicit `data-perf-section` labels.
- Render a true horizontal time axis with ticks, detection/visibility/stability/completion phases, and section rows.
- Hovering or focusing a row reveals a detail card containing selector, detected/visible/stable/complete times, layout shift, and blocking-resource count.
- Information remains available through keyboard focus; hover is not the only interaction.
- Sections never seen in the viewport are explicitly labeled instead of treated as missing data.

## Commands

- Test: `npm test`
- Build: `npm run build`
- Validate Compose: `docker compose config`
- Rebuild runtime: `docker compose up -d --build`
- Browser verification: desktop 1440px, tablet 768px, mobile 390px

## Project Structure

- `packages/shared/types.ts`: additive progress contract
- `prisma/`: progress migration
- `apps/api/src/audit/`: stage updates and repaired section observer
- `apps/api/src/report-mapper.ts`: progress response mapping
- `apps/web/src/hooks/`: polling and active-run state
- `apps/web/src/components/history/`: grouped site/device history
- `apps/web/src/components/report/`: progress, tabs, timeline, and report canvases
- `apps/web/src/utils/`: site grouping and timeline presentation utilities

## Testing Strategy

- Unit-test site normalization/grouping and timeline phase calculations.
- Add a section-observer regression test proving initialization works when no document root exists at script start.
- Test progress mapping and stage bounds.
- Run the full suite and production build after every vertical slice.
- Verify a real Docker audit against `cb-puravida.test` from queued through completed.
- Browser-check tab keyboard semantics and desktop/mobile layouts.

## Boundaries

- Always: preserve existing endpoints, validate percentages to 0–100, retain public-site DNS/TLS behavior, keep hover details keyboard accessible.
- Requires approval: additive Prisma migration for progress persistence.
- Never: delete runs without explicit confirmation, merge desktop/mobile score data into one synthetic score, use WebSockets when polling already satisfies the requirement, or auto-scroll audited pages because it would contaminate timing measurements.

## Success Criteria

1. A running audit visibly advances through named stages without refresh.
2. Refreshing during an audit restores its current progress.
3. One history entry represents a site and exposes its latest desktop/mobile results.
4. `cb-puravida.test` produces non-empty section records where semantic candidates exist.
5. Timeline rows provide a readable time axis and hover/focus details.
6. Overview, Timeline, Network, and Diagnostics use accessible tabs with no long accordion stack.
7. Desktop and 390px mobile layouts have no horizontal overflow or console errors.
8. Tests and production build pass.
9. Selecting history fills URL/device controls; confirmed deletion removes the selected completed/failed run.
10. HTML is served with no-cache headers so a container rebuild is visible on reload.

## Implementation Plan

1. Add and migrate the progress contract; instrument runner stages; verify API polling.
2. Repair and regression-test observer initialization; verify non-empty capture in Docker.
3. Add site grouping utilities and grouped history selectors.
4. Add live progress UI and accessible report tabs.
5. Replace timeline presentation with phase visualization and focusable details.
6. Rebuild Docker and verify the complete flow across desktop and mobile.
