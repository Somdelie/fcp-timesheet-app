-- Allow custom team names/codes without another enum migration.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'Foreman'
  ) THEN
    ALTER TABLE "Foreman" ALTER COLUMN "defaultTeam" DROP DEFAULT;
    ALTER TABLE "Foreman" ALTER COLUMN "defaultTeam" TYPE TEXT USING "defaultTeam"::text;
    ALTER TABLE "Foreman" ALTER COLUMN "defaultTeam" SET DEFAULT 'PAINTERS';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'AttendanceScan'
  ) THEN
    ALTER TABLE "AttendanceScan" ALTER COLUMN "team" TYPE TEXT USING "team"::text;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "CompanyTeamRate" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "dayRate" DECIMAL(12,2) NOT NULL DEFAULT 250,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CompanyTeamRate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CompanyTeamRate_code_key" ON "CompanyTeamRate"("code");
CREATE INDEX IF NOT EXISTS "CompanyTeamRate_name_idx" ON "CompanyTeamRate"("name");
CREATE INDEX IF NOT EXISTS "CompanyTeamRate_sortOrder_name_idx" ON "CompanyTeamRate"("sortOrder", "name");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'CompanySettings'
  ) THEN
    UPDATE "CompanySettings"
    SET "defaultPainterDayRate" = 250
    WHERE "defaultPainterDayRate" = 0;
  END IF;
END $$;

INSERT INTO "CompanyTeamRate" ("id", "code", "name", "dayRate", "isSystem", "sortOrder", "updatedAt")
VALUES
  ('team_painters', 'PAINTERS', 'Painters', 250, true, 10, CURRENT_TIMESTAMP),
  ('team_building', 'BUILDING', 'Building', 300, true, 20, CURRENT_TIMESTAMP),
  ('team_special_coatings', 'SPECIAL_COATINGS', 'Special Coatings', 270, true, 30, CURRENT_TIMESTAMP),
  ('team_cape_town', 'CAPE_TOWN', 'Cape Town', 270, true, 40, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;