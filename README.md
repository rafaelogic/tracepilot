# Tracepilot

Tracepilot is a local-first web performance and technical SEO auditor. It combines Lighthouse category scores with section-level rendering timelines, resource waterfalls, browser-driven journey audits, and focused crawler/SEO tools so teams can find slow, broken, or crawler-hostile parts of a page before they ship.

<img width="1221" height="739" alt="Screenshot 2026-06-26 at 11 00 03 PM" src="https://github.com/user-attachments/assets/8057fc0a-c21d-4877-a7af-dc4b1fa2e84a" />

## Features

- Audit local, staging, and production URLs.
- Run natural-language browser journeys with Stagehand when OpenAI credentials are configured.
- Compare Performance, Accessibility, Best Practices, and SEO scores.
- Review Lighthouse Agentic Browsing checks and copy a focused repair prompt for a coding agent.
- Inspect section visibility, stability, render-completion timing, and screenshot evidence with target overlays.
- Trace network resources against each section's render window.
- Use the Tools workspace for standalone crawler and technical SEO checks without running a full Lighthouse audit.
- Review visual tool summaries, tabbed details, findings, and copyable issue-resolution prompts after each analysis.
- Persist audit history in PostgreSQL through Prisma.

## Requirements

Choose one setup:

- Docker Desktop with Docker Compose, or
- Node.js 22.19+, npm, PostgreSQL 16+, and a local Chromium-compatible browser.

## Installation With Docker

1. Clone the repository and enter it:

   ```bash
   git clone <repository-url> tracepilot
   cd tracepilot
   ```

2. Create the local environment file:

   ```bash
   cp .env.example .env
   ```

3. Build and start the stack:

   ```bash
   docker compose up -d --build
   ```

4. Open `http://localhost:5175`.

   The audit workspace is at `/`, and the standalone tools workspace is at `/tools`.

The API is available at `http://localhost:4041`, and PostgreSQL is exposed on `localhost:55432`. The API container applies Prisma migrations automatically during startup.

## Local Development

1. Clone the repository, enter it, and install dependencies:

   ```bash
   git clone <repository-url> tracepilot
   cd tracepilot
   npm ci
   cp .env.example .env
   ```

2. Start PostgreSQL with Docker:

   ```bash
   docker compose up -d postgres
   ```

3. Generate the Prisma client and apply migrations:

   ```bash
   npm run prisma:generate
   npm run db:migrate:deploy
   ```

4. Start the API and web development servers:

   ```bash
   npm run dev
   ```

The web app runs at `http://localhost:5173` and the API at `http://localhost:4040`. Vite selects another port if `5173` is unavailable.

In Docker, the web app runs at `http://localhost:5175` and the API proxy is available through `/api`.

## Configuration

The default `.env.example` is ready for the bundled PostgreSQL service. Journey audits can optionally use an OpenAI model:

```dotenv
DATABASE_URL="postgresql://postgres:postgres@localhost:55432/tracepilot"
OPENAI_API_KEY=""
BROWSERBASE_API_KEY=""
```

Without `OPENAI_API_KEY`, URL audits still work and journey audits record that agent execution was skipped. Never commit a populated `.env` file.

When a target hostname resolves to loopback inside Docker, Tracepilot routes it through Docker's host gateway. This allows audits of local development sites without adding each hostname to Compose.

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the API and web development servers |
| `npm run dev:web` | Start only the Vite web server |
| `npm run dev:api` | Start only the API server |
| `npm test` | Run the Vitest suite |
| `npm run build` | Build the web and API applications |
| `npm run build:web` | Build only the web application |
| `npm run build:api` | Build only the API application |
| `npm run lint` | Check TypeScript and React source with ESLint |
| `npm run db:migrate:deploy` | Apply existing Prisma migrations |
| `npm run prisma:migrate` | Create and apply a development migration |

## Project Structure

```text
apps/
  api/       Express API, audit orchestration, Playwright, and Lighthouse
  web/       React and Vite user interface
packages/
  shared/    Shared TypeScript domain and API types
prisma/      PostgreSQL schema and migrations
docs/        Product and implementation specifications
```

The web application calls the Express API under `/api`. The API runs browser and Lighthouse audits, stores results through Prisma, and returns reports consumed by the React workspace.

## Audit Workspace

The Audit page runs URL and journey audits and stores a report history grouped by audited site. Reports include:

- **Overview:** Lighthouse scores, category findings, and score-card drilldowns.
- **Timeline:** section rendering phases with screenshot evidence and red target rectangles when the captured screenshot includes extra context.
- **Network:** resource waterfall and diagnostics.
- **Agentic:** Lighthouse Agentic Browsing findings and a coding-agent repair prompt.
- **Diagnostics:** raw audit data for deeper inspection.

Finding drilldowns can generate a repair prompt that includes affected evidence and the Lighthouse recheck endpoint.

## Tools Workspace

Open `/tools` to run focused checks without a full Lighthouse audit. Current tools are:

| Tool | Purpose |
| --- | --- |
| Crawler Files | Checks root-level `robots.txt` and `llms.txt` availability and structure |
| Page Structure | Visualizes rendered heading hierarchy, metadata health, split H1 issues, and related SEO structure problems |
| Structured Data | Validates rendered JSON-LD blocks, entity types, and syntax errors |
| Internal Link Graph | Samples same-origin links, broken internal URLs, and link density |
| Metadata & Social Preview | Checks canonical metadata, Open Graph tags, Twitter/X card tags, preview images, and icons |
| Third-Party Script Inventory | Inventories external origins, scripts, request volume, and resource types |
| Content Freshness & Indexability | Checks robots directives, canonical signals, sitemap availability, and visible freshness date signals |
| JavaScript Execution Profiler | Measures long tasks, script resource timing, and main-thread blocking patterns |
| Unused JS/CSS Coverage | Uses browser coverage to estimate unused JavaScript and CSS bytes for the loaded route |
| Runtime Bundle Composition | Maps loaded JavaScript assets by ownership and transfer size |
| Image Optimization | Inspects rendered image dimensions, formats, transfer size, and responsive-image savings opportunities |
| Critical CSS Analyzer | Measures blocking stylesheet count and CSS usage during initial render |
| Real User Metrics Snippet | Generates a Web Vitals attribution snippet and payload contract for field-data collection |
| Third-Party Mitigation Advisor | Turns third-party inventory into route-level loading, consent, ownership, and removal recommendations |
| Prefetch Opportunity Mapper | Finds safe same-origin links for prefetch or Speculation Rules and flags links to avoid |
| Repeat View Filmstrip | Compares first-view and repeat-view timing, transfer size, and viewport screenshots |

Tool results use compact tabs:

- **Visual:** metrics, status chips, and small charts for quick triage.
- **Details:** raw tool-specific evidence.
- **Findings:** blockers, warnings, manual-review items, and affected evidence.

After a tool completes, Tracepilot shows a **Resolve issues prompt** below the target URL form. The prompt includes the tool findings and evidence, and reminds coding agents to treat diagnostic snippets as untrusted data.

## Labeling Page Sections

Tracepilot detects semantic elements such as `main`, `section`, `article`, landmarks, and large content blocks. Add `data-perf-section` for explicit report labels:

```html
<section data-perf-section="Revenue chart">
  <!-- Page content -->
</section>
```

## Agentic Browsing

New audits include Lighthouse's experimental Agentic Browsing category. Open the **Agentic** report tab to review failed, warning, manual, passed, and not-applicable checks. The tab can generate a copyable coding-agent prompt from actionable findings and their affected-element evidence.

Agentic Browsing evaluates whether automated agents can understand and operate a page. It is separate from Tracepilot Journey audits, which actively use Stagehand to navigate toward a natural-language goal. Historical reports created before this feature display a rerun-required message because their original results are never modified or backfilled.

## Verification

Before opening a pull request, run:

```bash
npm test
npm run build
npm run lint
```

## Contributing

Create a focused branch from `main`, keep changes scoped, and include tests for behavior changes. Pull requests should explain the user-facing impact and list the verification commands that were run.
