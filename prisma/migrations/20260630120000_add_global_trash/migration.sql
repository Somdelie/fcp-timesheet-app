CREATE TABLE "TrashItem" (
  "id" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "deletedByUserId" TEXT,
  "deletedByName" TEXT,
  "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TrashItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TrashItem_entityType_idx" ON "TrashItem"("entityType");
CREATE INDEX "TrashItem_deletedAt_idx" ON "TrashItem"("deletedAt");
CREATE INDEX "TrashItem_expiresAt_idx" ON "TrashItem"("expiresAt");
