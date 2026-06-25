import type { AuditComparison } from "../../../../packages/shared/types.js";
import { prisma } from "../db.js";
import { delta } from "../utils/math.js";

export async function compareAuditRuns(targetRunId: string, baseRunId: string): Promise<AuditComparison | null> {
  const [target, base] = await Promise.all([
    prisma.auditRun.findUnique({
      where: { id: targetRunId },
      include: { sections: true }
    }),
    prisma.auditRun.findUnique({
      where: { id: baseRunId },
      include: { sections: true }
    })
  ]);

  if (!target || !base) return null;

  return {
    baseRunId: base.id,
    targetRunId: target.id,
    scoreDeltas: {
      performance: delta(base.performance, target.performance),
      accessibility: delta(base.accessibility, target.accessibility),
      bestPractices: delta(base.bestPractices, target.bestPractices),
      seo: delta(base.seo, target.seo)
    },
    sectionDeltas: target.sections.map((targetSection) => {
      const baseSection = base.sections.find((section) => section.label === targetSection.label);
      const deltaMs = delta(baseSection?.renderCompleteMs ?? null, targetSection.renderCompleteMs);

      return {
        label: targetSection.label,
        baseRenderCompleteMs: baseSection?.renderCompleteMs ?? null,
        targetRenderCompleteMs: targetSection.renderCompleteMs,
        deltaMs,
        regressed: typeof deltaMs === "number" && deltaMs > Math.max(250, (baseSection?.renderCompleteMs ?? 0) * 0.1)
      };
    })
  };
}
