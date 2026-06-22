-- Allow custom team names/codes without another enum migration.
ALTER TABLE "Foreman" ALTER COLUMN "defaultTeam" DROP DEFAULT;
ALTER TABLE "Foreman" ALTER COLUMN "defaultTeam" TYPE TEXT USING "defaultTeam"::text;
ALTER TABLE "Foreman" ALTER COLUMN "defaultTeam" SET DEFAULT 'PAINTERS';

ALTER TABLE "AttendanceScan" ALTER COLUMN "team" TYPE TEXT USING "team"::text;

CREATE TABLE "CompanyTeamRate" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "dayRate" DECIMAL(12,2) NOT NULL DEFAULT 250,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CompanyTeamRate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyTeamRate_code_key" ON "CompanyTeamRate"("code");
CREATE INDEX "CompanyTeamRate_name_idx" ON "CompanyTeamRate"("name");
CREATE INDEX "CompanyTeamRate_sortOrder_name_idx" ON "CompanyTeamRate"("sortOrder", "name");

-- Painters must not default to zero.
UPDATE "CompanySettings"
SET "defaultPainterDayRate" = 250
WHERE "defaultPainterDayRate" = 0;

INSERT INTO "CompanyTeamRate" ("id", "code", "name", "dayRate", "isSystem", "sortOrder", "updatedAt")
VALUES
  ('team_painters', 'PAINTERS', 'Painters', COALESCE((SELECT "defaultPainterDayRate" FROM "CompanySettings" WHERE "id" = 'singleton'), 250), true, 10, CURRENT_TIMESTAMP),
  ('team_building', 'BUILDING', 'Building', COALESCE((SELECT "defaultBuildingDayRate" FROM "CompanySettings" WHERE "id" = 'singleton'), 300), true, 20, CURRENT_TIMESTAMP),
  ('team_special_coatings', 'SPECIAL_COATINGS', 'Special Coatings', COALESCE((SELECT "defaultSpecialCoatingsDayRate" FROM "CompanySettings" WHERE "id" = 'singleton'), 270), true, 30, CURRENT_TIMESTAMP),
  ('team_cape_town', 'CAPE_TOWN', 'Cape Town', COALESCE((SELECT "defaultCapeTownDayRate" FROM "CompanySettings" WHERE "id" = 'singleton'), 270), true, 40, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
