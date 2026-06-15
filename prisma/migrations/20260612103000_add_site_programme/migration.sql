DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SiteProgrammeStatus') THEN
    CREATE TYPE "SiteProgrammeStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SiteProgrammeItemStatus') THEN
    CREATE TYPE "SiteProgrammeItemStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'OVERSTAYED', 'CANCELLED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "SiteProgramme" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "plannedStartDate" TIMESTAMP(3) NOT NULL,
  "plannedFinishDate" TIMESTAMP(3) NOT NULL,
  "status" "SiteProgrammeStatus" NOT NULL DEFAULT 'DRAFT',
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SiteProgramme_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SiteProgrammeItem" (
  "id" TEXT NOT NULL,
  "programmeId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "trade" TEXT,
  "description" TEXT,
  "plannedStartDate" TIMESTAMP(3) NOT NULL,
  "plannedFinishDate" TIMESTAMP(3) NOT NULL,
  "actualStartDate" TIMESTAMP(3),
  "actualFinishDate" TIMESTAMP(3),
  "status" "SiteProgrammeItemStatus" NOT NULL DEFAULT 'PLANNED',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SiteProgrammeItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SiteProgramme_siteId_idx"
  ON "SiteProgramme"("siteId");

CREATE INDEX IF NOT EXISTS "SiteProgramme_status_idx"
  ON "SiteProgramme"("status");

CREATE INDEX IF NOT EXISTS "SiteProgramme_plannedStartDate_idx"
  ON "SiteProgramme"("plannedStartDate");

CREATE INDEX IF NOT EXISTS "SiteProgramme_plannedFinishDate_idx"
  ON "SiteProgramme"("plannedFinishDate");

CREATE INDEX IF NOT EXISTS "SiteProgrammeItem_programmeId_idx"
  ON "SiteProgrammeItem"("programmeId");

CREATE INDEX IF NOT EXISTS "SiteProgrammeItem_plannedStartDate_idx"
  ON "SiteProgrammeItem"("plannedStartDate");

CREATE INDEX IF NOT EXISTS "SiteProgrammeItem_plannedFinishDate_idx"
  ON "SiteProgrammeItem"("plannedFinishDate");

CREATE INDEX IF NOT EXISTS "SiteProgrammeItem_actualFinishDate_idx"
  ON "SiteProgrammeItem"("actualFinishDate");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Site'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'SiteProgramme_siteId_fkey'
    ) THEN
      ALTER TABLE "SiteProgramme"
        ADD CONSTRAINT "SiteProgramme_siteId_fkey"
        FOREIGN KEY ("siteId") REFERENCES "Site"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'User'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'SiteProgramme_createdByUserId_fkey'
    ) THEN
      ALTER TABLE "SiteProgramme"
        ADD CONSTRAINT "SiteProgramme_createdByUserId_fkey"
        FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SiteProgrammeItem_programmeId_fkey'
  ) THEN
    ALTER TABLE "SiteProgrammeItem"
      ADD CONSTRAINT "SiteProgrammeItem_programmeId_fkey"
      FOREIGN KEY ("programmeId") REFERENCES "SiteProgramme"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
