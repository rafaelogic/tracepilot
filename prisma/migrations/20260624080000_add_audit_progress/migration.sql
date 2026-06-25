ALTER TABLE "AuditRun"
ADD COLUMN "progressStage" TEXT NOT NULL DEFAULT 'queued',
ADD COLUMN "progressPercent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "progressMessage" TEXT NOT NULL DEFAULT 'Waiting for the audit worker.';

UPDATE "AuditRun"
SET
  "progressStage" = CASE
    WHEN "status" = 'completed' THEN 'completed'
    WHEN "status" = 'failed' THEN 'failed'
    WHEN "status" = 'running' THEN 'preparing-browser'
    ELSE 'queued'
  END,
  "progressPercent" = CASE
    WHEN "status" IN ('completed', 'failed') THEN 100
    WHEN "status" = 'running' THEN 10
    ELSE 0
  END,
  "progressMessage" = CASE
    WHEN "status" = 'completed' THEN 'Audit completed.'
    WHEN "status" = 'failed' THEN COALESCE("error", 'Audit failed.')
    WHEN "status" = 'running' THEN 'Preparing the browser.'
    ELSE 'Waiting for the audit worker.'
  END;
