# Tracepilot

Tracepilot is a local-first web performance auditor. It combines Lighthouse category scores with section-level rendering timelines, resource waterfalls, and browser-driven journey audits so teams can find slow parts of a page before they ship.

## Features

- Audit local, staging, and production URLs.
- Run natural-language browser journeys with Stagehand when OpenAI credentials are configured.
- Compare Performance, Accessibility, Best Practices, and SEO scores.
- Review Lighthouse Agentic Browsing checks and copy a focused repair prompt for a coding agent.
- Inspect section visibility, stability, and render-completion timing.
- Trace network resources against each section's render window.
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
