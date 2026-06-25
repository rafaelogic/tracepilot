import { prisma } from "../db.js";
import { runAudit } from "../audit/runner.js";
import { toReport, toSummary } from "../report-mapper.js";
import type { createAuditSchema, createJourneySchema } from "../validation.js";
import type { z } from "zod";

type CreateAuditInput = z.infer<typeof createAuditSchema>;
type CreateJourneyInput = z.infer<typeof createJourneySchema>;

export async function createAudit(input: CreateAuditInput) {
  const run = await prisma.auditRun.create({
    data: {
      mode: input.mode,
      status: "queued",
      input: input.input,
      startUrl: input.mode === "url" ? input.input : undefined,
      device: input.device,
      label: input.label,
      settings: input.settings
    }
  });

  runAudit({
    runId: run.id,
    mode: input.mode,
    input: input.input,
    startUrl: input.mode === "journey" ? input.input : undefined,
    device: input.device,
    settings: input.settings
  }).catch((error) => {
    console.error("Audit worker failed", error);
  });

  return toSummary(run);
}

export async function createJourney(input: CreateJourneyInput) {
  const run = await prisma.auditRun.create({
    data: {
      mode: "journey",
      status: "queued",
      input: input.goal,
      startUrl: input.startUrl,
      goal: input.goal,
      device: input.device,
      label: input.label,
      settings: input.settings
    }
  });

  runAudit({
    runId: run.id,
    mode: "journey",
    input: input.startUrl,
    startUrl: input.startUrl,
    goal: input.goal,
    device: input.device,
    settings: input.settings
  }).catch((error) => {
    console.error("Journey worker failed", error);
  });

  return toSummary(run);
}

export async function listAuditRuns() {
  const runs = await prisma.auditRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 40
  });
  return runs.map(toSummary);
}

export async function getAuditReport(id: string) {
  const run = await prisma.auditRun.findUnique({
    where: { id },
    include: {
      sections: { orderBy: [{ renderCompleteMs: "desc" }] },
      resources: { orderBy: [{ durationMs: "desc" }] },
      journeySteps: { orderBy: [{ index: "asc" }] }
    }
  });

  return run ? toReport(run) : null;
}

export async function deleteAudit(id: string) {
  const result = await prisma.auditRun.deleteMany({ where: { id } });
  return result.count > 0;
}
