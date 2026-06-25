-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('queued', 'running', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "AuditMode" AS ENUM ('url', 'journey');

-- CreateTable
CREATE TABLE "AuditRun" (
    "id" TEXT NOT NULL,
    "mode" "AuditMode" NOT NULL,
    "status" "AuditStatus" NOT NULL DEFAULT 'queued',
    "input" TEXT NOT NULL,
    "startUrl" TEXT,
    "finalUrl" TEXT,
    "goal" TEXT,
    "device" TEXT NOT NULL,
    "label" TEXT,
    "error" TEXT,
    "performance" INTEGER,
    "accessibility" INTEGER,
    "bestPractices" INTEGER,
    "seo" INTEGER,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectionTiming" (
    "id" TEXT NOT NULL,
    "auditRunId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "selector" TEXT NOT NULL,
    "top" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "firstDetectedMs" DOUBLE PRECISION NOT NULL,
    "firstVisibleMs" DOUBLE PRECISION,
    "contentStableMs" DOUBLE PRECISION,
    "renderCompleteMs" DOUBLE PRECISION,
    "layoutShiftScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "blockingResourceCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SectionTiming_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceTiming" (
    "id" TEXT NOT NULL,
    "auditRunId" TEXT NOT NULL,
    "sectionTimingId" TEXT,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "initiator" TEXT,
    "startMs" DOUBLE PRECISION NOT NULL,
    "durationMs" DOUBLE PRECISION NOT NULL,
    "transferSize" INTEGER,
    "status" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceTiming_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyStep" (
    "id" TEXT NOT NULL,
    "auditRunId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAtMs" DOUBLE PRECISION,
    "endedAtMs" DOUBLE PRECISION,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JourneyStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JourneyStep_auditRunId_index_key" ON "JourneyStep"("auditRunId", "index");

-- AddForeignKey
ALTER TABLE "SectionTiming" ADD CONSTRAINT "SectionTiming_auditRunId_fkey" FOREIGN KEY ("auditRunId") REFERENCES "AuditRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceTiming" ADD CONSTRAINT "ResourceTiming_auditRunId_fkey" FOREIGN KEY ("auditRunId") REFERENCES "AuditRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyStep" ADD CONSTRAINT "JourneyStep_auditRunId_fkey" FOREIGN KEY ("auditRunId") REFERENCES "AuditRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
