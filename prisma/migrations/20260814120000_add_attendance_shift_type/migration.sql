-- CreateEnum
CREATE TYPE "ShiftType" AS ENUM ('DAY', 'NIGHT');

-- DropIndex
DROP INDEX "AttendanceScan_employeeId_workDate_key";

-- DropIndex
DROP INDEX "AttendanceScan_siteDayId_employeeId_key";

-- AlterTable
ALTER TABLE "AttendanceScan"
  ADD COLUMN "shiftType" "ShiftType" NOT NULL DEFAULT 'DAY';

-- CreateIndex
CREATE INDEX "AttendanceScan_shiftType_idx"
  ON "AttendanceScan"("shiftType");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceScan_employeeId_workDate_shiftType_key"
  ON "AttendanceScan"("employeeId", "workDate", "shiftType");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceScan_siteDayId_employeeId_shiftType_key"
  ON "AttendanceScan"("siteDayId", "employeeId", "shiftType");
