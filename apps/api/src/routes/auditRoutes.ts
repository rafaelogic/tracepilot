import { Router } from "express";
import { crawlerFilesToolSchema, createAuditSchema, createJourneySchema, lighthouseRecheckSchema, pageStructureToolSchema } from "../validation.js";
import { compareAuditRuns } from "../services/comparisonService.js";
import { createAudit, createJourney, deleteAudit, getAuditReport, listAuditRuns } from "../services/auditService.js";
import { recheckLighthouse } from "../services/lighthouseService.js";
import { checkCrawlerFiles } from "../services/crawlerFilesToolService.js";
import { checkPageStructure } from "../services/pageStructureToolService.js";
import {
  checkContentFreshnessIndexability,
  checkInternalLinkGraph,
  checkMetadataSocial,
  checkStructuredData,
  checkThirdPartyInventory
} from "../services/advancedSeoToolsService.js";

export const auditRoutes = Router();

auditRoutes.post("/audits", async (request, response, next) => {
  try {
    const input = createAuditSchema.parse(request.body);
    response.status(202).json(await createAudit(input));
  } catch (error) {
    next(error);
  }
});

auditRoutes.post("/journeys", async (request, response, next) => {
  try {
    const input = createJourneySchema.parse(request.body);
    response.status(202).json(await createJourney(input));
  } catch (error) {
    next(error);
  }
});

auditRoutes.post("/lighthouse/recheck", async (request, response, next) => {
  try {
    const input = lighthouseRecheckSchema.parse(request.body);
    response.json(await recheckLighthouse(input));
  } catch (error) {
    next(error);
  }
});

auditRoutes.post("/tools/crawler-files", async (request, response, next) => {
  try {
    const input = crawlerFilesToolSchema.parse(request.body);
    response.json(await checkCrawlerFiles(input.url));
  } catch (error) {
    next(error);
  }
});

auditRoutes.post("/tools/page-structure", async (request, response, next) => {
  try {
    const input = pageStructureToolSchema.parse(request.body);
    response.json(await checkPageStructure(input.url));
  } catch (error) {
    next(error);
  }
});

auditRoutes.post("/tools/structured-data", async (request, response, next) => {
  try {
    const input = pageStructureToolSchema.parse(request.body);
    response.json(await checkStructuredData(input.url));
  } catch (error) {
    next(error);
  }
});

auditRoutes.post("/tools/internal-link-graph", async (request, response, next) => {
  try {
    const input = pageStructureToolSchema.parse(request.body);
    response.json(await checkInternalLinkGraph(input.url));
  } catch (error) {
    next(error);
  }
});

auditRoutes.post("/tools/metadata-social", async (request, response, next) => {
  try {
    const input = pageStructureToolSchema.parse(request.body);
    response.json(await checkMetadataSocial(input.url));
  } catch (error) {
    next(error);
  }
});

auditRoutes.post("/tools/third-party-inventory", async (request, response, next) => {
  try {
    const input = pageStructureToolSchema.parse(request.body);
    response.json(await checkThirdPartyInventory(input.url));
  } catch (error) {
    next(error);
  }
});

auditRoutes.post("/tools/freshness-indexability", async (request, response, next) => {
  try {
    const input = pageStructureToolSchema.parse(request.body);
    response.json(await checkContentFreshnessIndexability(input.url));
  } catch (error) {
    next(error);
  }
});

auditRoutes.get("/audits", async (_request, response, next) => {
  try {
    response.json(await listAuditRuns());
  } catch (error) {
    next(error);
  }
});

auditRoutes.get("/audits/:id", async (request, response, next) => {
  try {
    const report = await getAuditReport(request.params.id);
    if (!report) {
      response.status(404).json({ error: "Audit not found" });
      return;
    }
    response.json(report);
  } catch (error) {
    next(error);
  }
});

auditRoutes.delete("/audits/:id", async (request, response, next) => {
  try {
    await deleteAudit(request.params.id);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

auditRoutes.get("/audits/:id/compare/:baseId", async (request, response, next) => {
  try {
    const comparison = await compareAuditRuns(request.params.id, request.params.baseId);
    if (!comparison) {
      response.status(404).json({ error: "Comparison run not found" });
      return;
    }
    response.json(comparison);
  } catch (error) {
    next(error);
  }
});
