import { chromium, type Page, type Request, type Response } from "playwright";
import net from "node:net";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import type { AgenticBrowsingResult, AuditCategoryBreakdown, AuditScores, AuditSettings, LighthousePassesMetadata, LighthousePassSummary, ResourceTimingEntry, SectionTimelineEntry } from "../../../../packages/shared/types.js";
import { resolveAuditNetwork } from "./network-target.js";
import { sectionObserverScript } from "./section-observer.js";
import { buildFailedLighthousePass, LIGHTHOUSE_PASS_COUNT, runLighthousePass, selectMedianLighthouseResultForPassCount, type LighthouseSinglePassResult } from "./lighthouse.js";
import { estimateBlockingResources, inferResourceType } from "./timing-utils.js";

interface RunnerOptions {
  runId: string;
  mode: "url" | "journey";
  input: string;
  startUrl?: string;
  goal?: string;
  device: "mobile" | "desktop";
  settings?: AuditSettings;
}

interface NetworkRecord {
  url: string;
  type: string;
  initiator?: string | null;
  startMs: number;
  durationMs: number;
  transferSize?: number | null;
  status?: number | null;
}

const deviceProfiles = {
  mobile: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
  },
  desktop: {
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false
  }
};

export async function runAudit(options: RunnerOptions) {
  await prisma.auditRun.update({
    where: { id: options.runId },
    data: {
      status: "running",
      startedAt: new Date(),
      progressStage: "preparing-browser",
      progressPercent: 8,
      progressMessage: "Preparing an isolated browser and device profile."
    }
  });

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

  try {
    const navigationUrl = options.mode === "journey" ? options.startUrl ?? options.input : options.input;
    const auditNetwork = await resolveAuditNetwork(navigationUrl);
    const lighthousePort = await getOpenPort();
    browser = await chromium.launch({
      headless: true,
      args: [`--remote-debugging-port=${lighthousePort}`, ...auditNetwork.chromiumArgs]
    });
    const context = await browser.newContext({
      ...deviceProfiles[options.device],
      ignoreHTTPSErrors: auditNetwork.ignoreHTTPSErrors
    });
    const page = await context.newPage();
    const networkRecords = captureNetwork(page);

    await page.addInitScript(sectionObserverScript);
    await updateProgress(options.runId, "navigating", 22, `Opening ${navigationUrl}`);

    let finalUrl = options.input;
    if (options.mode === "journey") {
      finalUrl = await executeJourney(page, options.startUrl ?? options.input, options.goal ?? "", options.runId, lighthousePort);
    } else {
      await page.goto(options.input, { waitUntil: "networkidle", timeout: 60_000 });
    }

    await updateProgress(options.runId, "observing-sections", 44, "Detecting page sections and waiting for visual stability.");
    await page.waitForTimeout(900);
    let sections = await page.evaluate<SectionTimelineEntry[]>(() => {
      return window.__sectionTimeline?.getSections?.() ?? [];
    });
    sections = await captureSectionScreenshots(page, sections);

    await updateProgress(options.runId, "collecting-resources", 58, "Correlating network activity with rendered sections.");
    const resources = await collectResourceTimings(page, networkRecords);
    await browser.close();
    browser = null;

    const settings = normalizeAuditSettings(options.settings);
    const scores = await runMedianLighthouse(options.runId, finalUrl, options.device, auditNetwork.chromiumArgs, settings.lighthousePassCount ?? LIGHTHOUSE_PASS_COUNT);

    await updateProgress(options.runId, "saving-report", 92, "Saving scores, timeline evidence, and resource timings.");
    await persistResults(options.runId, finalUrl, scores, sections, resources, settings);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown audit failure";
    await prisma.auditRun.update({
      where: { id: options.runId },
      data: {
        status: "failed",
        error: message,
        progressStage: "failed",
        progressMessage: message,
        completedAt: new Date()
      }
    });
  } finally {
    await browser?.close();
  }
}

async function runMedianLighthouse(
  runId: string,
  finalUrl: string,
  device: "mobile" | "desktop",
  chromiumArgs: string[],
  passCount: number
) {
  const passes: LighthouseSinglePassResult[] = [];
  const failedPasses: LighthousePassSummary[] = [];

  for (let index = 0; index < passCount; index += 1) {
    await updateProgress(
      runId,
      "running-lighthouse",
      72 + Math.round((index / passCount) * 16),
      `Running Lighthouse pass ${index + 1} of ${passCount}.`
    );

    let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
    try {
      const lighthousePort = await getOpenPort();
      browser = await chromium.launch({
        headless: true,
        args: [`--remote-debugging-port=${lighthousePort}`, ...chromiumArgs]
      });
      passes.push(await runLighthousePass(finalUrl, lighthousePort, device, index));
    } catch (error) {
      failedPasses.push(buildFailedLighthousePass(index, error));
    } finally {
      await browser?.close();
    }
  }

  return selectMedianLighthouseResultForPassCount(passes, failedPasses, passCount);
}

function normalizeAuditSettings(settings?: AuditSettings): AuditSettings {
  return {
    ...settings,
    lighthousePassCount: clampInteger(settings?.lighthousePassCount ?? LIGHTHOUSE_PASS_COUNT, 1, 9),
    targetScores: {
      performance: clampInteger(settings?.targetScores?.performance ?? 90, 0, 100),
      accessibility: clampInteger(settings?.targetScores?.accessibility ?? 90, 0, 100),
      bestPractices: clampInteger(settings?.targetScores?.bestPractices ?? 90, 0, 100),
      seo: clampInteger(settings?.targetScores?.seo ?? 90, 0, 100)
    }
  };
}

function clampInteger(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

async function executeJourney(page: Page, startUrl: string, goal: string, runId: string, cdpPort: number) {
  const startedAt = performance.now();
  await recordStep(runId, 0, "Open start URL", "running", 0);
  await page.goto(startUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
  await recordStep(runId, 0, "Open start URL", "completed", 0, performance.now() - startedAt, page.url());

  if (!process.env.OPENAI_API_KEY && !process.env.BROWSERBASE_API_KEY) {
    await recordStep(
      runId,
      1,
      "Agent goal skipped",
      "completed",
      performance.now() - startedAt,
      performance.now() - startedAt,
      "Set OPENAI_API_KEY or BROWSERBASE_API_KEY to enable Stagehand natural-language browsing."
    );
    return page.url();
  }

  try {
    await recordStep(runId, 1, goal, "running", performance.now() - startedAt);
    const { Stagehand } = await import("@browserbasehq/stagehand");
    const stagehand = new Stagehand({
      env: "LOCAL",
      localBrowserLaunchOptions: {
        cdpUrl: `http://127.0.0.1:${cdpPort}`
      },
      disablePino: true
    });
    await stagehand.init();
    const agent = stagehand.agent({
      systemPrompt: "Navigate to the requested application state for performance auditing. Do not perform destructive actions."
    });
    const result = await agent.execute({
      instruction: goal,
      page,
      maxSteps: 8
    });
    await recordStep(
      runId,
      1,
      goal,
      result.success ? "completed" : "failed",
      undefined,
      performance.now() - startedAt,
      result.message
    );
  } catch (error) {
    await recordStep(
      runId,
      1,
      goal,
      "failed",
      undefined,
      performance.now() - startedAt,
      error instanceof Error ? error.message : "Agent failed."
    );
  }

  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
  return page.url();
}

function captureNetwork(page: Page) {
  const startedAt = performance.now();
  const requestStarts = new Map<Request, number>();
  const records: NetworkRecord[] = [];

  page.on("request", (request) => {
    requestStarts.set(request, performance.now() - startedAt);
  });

  page.on("response", async (response: Response) => {
    const request = response.request();
    const startMs = requestStarts.get(request) ?? 0;
    const durationMs = Math.max(performance.now() - startedAt - startMs, 0);
    records.push({
      url: response.url(),
      type: request.resourceType(),
      initiator: request.frame()?.url() ?? null,
      startMs,
      durationMs,
      status: response.status(),
      transferSize: Number(response.headers()["content-length"]) || null
    });
  });

  return records;
}

async function collectResourceTimings(page: Page, networkRecords: NetworkRecord[]) {
  const browserTimings = await page.evaluate<ResourceTimingEntry[]>(() =>
    performance.getEntriesByType("resource").map((entry) => {
      const resource = entry as PerformanceResourceTiming;
      return {
        url: resource.name,
        type: resource.initiatorType || "resource",
        initiator: resource.initiatorType || null,
        startMs: resource.startTime,
        durationMs: resource.duration,
        transferSize: resource.transferSize || null,
        status: null
      };
    })
  );

  const merged = browserTimings.length > 0 ? browserTimings : networkRecords;
  return merged.map((resource) => ({
    ...resource,
    sectionTimingId: null,
    type: resource.type || inferResourceType(resource.url),
    durationMs: Math.round(resource.durationMs),
    startMs: Math.round(resource.startMs)
  })).sort((a, b) => b.durationMs - a.durationMs).slice(0, 200);
}

async function captureSectionScreenshots(page: Page, sections: SectionTimelineEntry[]) {
  const pageMetrics = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    scrollWidth: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0),
    scrollHeight: Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0)
  }));
  const maxClipHeight = Math.min(900, Math.max(360, pageMetrics.viewportHeight));
  const maxSections = 20;

  const withScreenshots: SectionTimelineEntry[] = [];
  for (const section of sections.slice(0, maxSections)) {
    withScreenshots.push({
      ...section,
      screenshot: await captureSectionScreenshot(page, section, pageMetrics, maxClipHeight)
    });
  }

  return [
    ...withScreenshots,
    ...sections.slice(maxSections)
  ];
}

async function captureSectionScreenshot(
  page: Page,
  section: SectionTimelineEntry,
  pageMetrics: { viewportWidth: number; viewportHeight: number; scrollWidth: number; scrollHeight: number },
  maxClipHeight: number
): Promise<SectionTimelineEntry["screenshot"]> {
  const rect = await page.evaluate((selector) => {
    const element = document.querySelector(selector);
    if (!element) return null;
    const box = element.getBoundingClientRect();
    return {
      x: box.left + window.scrollX,
      y: box.top + window.scrollY,
      width: box.width,
      height: box.height
    };
  }, section.selector).catch(() => null);

  if (!rect || rect.width <= 0 || rect.height <= 0) return null;

  const clipWidth = Math.min(pageMetrics.scrollWidth, Math.max(rect.width, pageMetrics.viewportWidth));
  const clipHeight = Math.min(pageMetrics.scrollHeight, Math.max(220, Math.min(rect.height, maxClipHeight)));
  const desiredY = rect.height > clipHeight
    ? rect.y
    : rect.y - Math.max(0, (clipHeight - rect.height) / 2);
  const clip = {
    x: clamp(rect.x - Math.max(0, (clipWidth - rect.width) / 2), 0, Math.max(0, pageMetrics.scrollWidth - clipWidth)),
    y: clamp(desiredY, 0, Math.max(0, pageMetrics.scrollHeight - clipHeight)),
    width: Math.max(1, Math.round(clipWidth)),
    height: Math.max(1, Math.round(clipHeight))
  };
  const target = {
    x: Math.round(rect.x - clip.x),
    y: Math.round(rect.y - clip.y),
    width: Math.round(Math.min(rect.width, clip.width)),
    height: Math.round(Math.min(rect.height, clip.height - Math.max(0, rect.y - clip.y)))
  };
  const highlight = Math.abs(clip.x - rect.x) > 1
    || Math.abs(clip.y - rect.y) > 1
    || Math.abs(clip.width - rect.width) > 1
    || Math.abs(clip.height - rect.height) > 1;

  const image = await page.screenshot({
    type: "png",
    animations: "disabled",
    caret: "hide",
    clip
  }).catch(() => null);

  if (!image) return null;

  return {
    dataUrl: `data:image/png;base64,${image.toString("base64")}`,
    clip,
    target,
    highlight
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

async function persistResults(
  runId: string,
  finalUrl: string,
  scores: AuditScores & { agenticBrowsing?: AgenticBrowsingResult; categoryBreakdown: AuditCategoryBreakdown; lighthousePasses?: LighthousePassesMetadata },
  sections: SectionTimelineEntry[],
  resources: ResourceTimingEntry[],
  settings: AuditSettings
) {
  await prisma.$transaction(async (tx) => {
    await tx.sectionTiming.deleteMany({ where: { auditRunId: runId } });
    await tx.resourceTiming.deleteMany({ where: { auditRunId: runId } });
    await tx.auditRun.update({
      where: { id: runId },
      data: {
        status: "completed",
        finalUrl,
        performance: scores.performance,
        accessibility: scores.accessibility,
        bestPractices: scores.bestPractices,
        seo: scores.seo,
        agenticBrowsing: scores.agenticBrowsing
          ? scores.agenticBrowsing as unknown as Prisma.InputJsonValue
          : undefined,
        settings: settings as unknown as Prisma.InputJsonValue,
        categoryBreakdown: scores.categoryBreakdown as Prisma.InputJsonValue,
        lighthousePasses: "lighthousePasses" in scores && scores.lighthousePasses
          ? scores.lighthousePasses as unknown as Prisma.InputJsonValue
          : undefined,
        progressStage: "completed",
        progressPercent: 100,
        progressMessage: "Audit completed.",
        completedAt: new Date()
      }
    });
    await tx.sectionTiming.createMany({
      data: sections.map((section) => ({
        auditRunId: runId,
        label: section.label,
        selector: section.selector,
        elementHtml: section.elementHtml,
        screenshot: section.screenshot
          ? section.screenshot as unknown as Prisma.InputJsonValue
          : undefined,
        top: section.top,
        height: section.height,
        firstDetectedMs: section.firstDetectedMs,
        firstVisibleMs: section.firstVisibleMs,
        contentStableMs: section.contentStableMs,
        renderCompleteMs: section.renderCompleteMs,
        layoutShiftScore: section.layoutShiftScore,
        blockingResourceCount: estimateBlockingResources(section, resources)
      }))
    });
    await tx.resourceTiming.createMany({
      data: resources.map((resource) => ({
        auditRunId: runId,
        sectionTimingId: null,
        url: resource.url,
        type: resource.type,
        initiator: resource.initiator,
        startMs: resource.startMs,
        durationMs: resource.durationMs,
        transferSize: resource.transferSize,
        status: resource.status
      }))
    });
  });
}

async function updateProgress(runId: string, stage: string, percent: number, message: string) {
  await prisma.auditRun.update({
    where: { id: runId },
    data: {
      progressStage: stage,
      progressPercent: Math.max(0, Math.min(100, percent)),
      progressMessage: message
    }
  });
}

async function recordStep(
  auditRunId: string,
  index: number,
  action: string,
  status: "running" | "completed" | "failed",
  startedAtMs?: number,
  endedAtMs?: number,
  detail?: string
) {
  await prisma.journeyStep.upsert({
    where: { auditRunId_index: { auditRunId, index } },
    create: { auditRunId, index, action, status, startedAtMs, endedAtMs, detail },
    update: { action, status, startedAtMs, endedAtMs, detail }
  });
}

function getOpenPort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (typeof address === "object" && address?.port) resolve(address.port);
        else reject(new Error("Unable to allocate remote debugging port"));
      });
    });
  });
}

declare global {
  interface Window {
    __sectionTimeline?: {
      getSections: () => SectionTimelineEntry[];
    };
  }
}
