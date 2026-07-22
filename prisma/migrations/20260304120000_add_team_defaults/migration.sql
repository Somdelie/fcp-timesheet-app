-- CreateEnum
CREATE TYPE "TeamType" AS ENUM ('PAINTERS', 'BUILDING', 'SPECIAL_COATINGS');

-- AlterTable: Add defaultTeam to Foreman (default PAINTERS so existing rows are safe)
ALTER TABLE "Foreman" ADD COLUMN "defaultTeam" "TeamType" NOT NULL DEFAULT 'PAINTERS';

-- AlterTable: Add team snapshot to AttendanceScan (nullable for existing rows)
ALTER TABLE "AttendanceScan" ADD COLUMN "team" "TeamType";

-- AlterTable: Add team default day rates to CompanySettings
ALTER TABLE "CompanySettings" ADD COLUMN "defaultPainterDayRate" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "CompanySettings" ADD COLUMN "defaultBuildingDayRate" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "CompanySettings" ADD COLUMN "defaultSpecialCoatingsDayRate" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "AttendanceScan_team_idx" ON "AttendanceScan"("team");
