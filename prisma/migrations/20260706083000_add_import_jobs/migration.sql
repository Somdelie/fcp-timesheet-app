-- This is an empty migration.
CREATE TABLE IF NOT EXISTS "ImportJob" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "fileName" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "error" TEXT,
  "resultJson" JSONB,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),

  CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ImportJob_type_idx" ON "ImportJob"("type");
CREATE INDEX IF NOT EXISTS "ImportJob_status_idx" ON "ImportJob"("status");
CREATE INDEX IF NOT EXISTS "ImportJob_createdAt_idx" ON "ImportJob"("createdAt");
CREATE INDEX IF NOT EXISTS "ImportJob_createdById_idx" ON "ImportJob"("createdById");

ALTER TABLE "ImportJob"
ADD CONSTRAINT "ImportJob_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;