-- CreateEnum
CREATE TYPE "ScanType" AS ENUM ('REGULAR', 'MANUAL');

-- CreateEnum
CREATE TYPE "OvertimeType" AS ENUM ('NONE', 'HALF_DAY', 'FULL_DAY');

-- AlterTable
ALTER TABLE "AttendanceScan" ADD COLUMN     "addedByForemanId" TEXT,
ADD COLUMN     "manualReason" TEXT,
ADD COLUMN     "overtimeType" "OvertimeType" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "scanType" "ScanType" NOT NULL DEFAULT 'REGULAR';

-- CreateTable
CREATE TABLE "ForemanAssistant" (
    "foremanId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForemanAssistant_pkey" PRIMARY KEY ("foremanId","employeeId")
);

-- CreateIndex
CREATE INDEX "ForemanAssistant_employeeId_idx" ON "ForemanAssistant"("employeeId");

-- CreateIndex
CREATE INDEX "AttendanceScan_scanType_idx" ON "AttendanceScan"("scanType");

-- AddForeignKey
ALTER TABLE "ForemanAssistant" ADD CONSTRAINT "ForemanAssistant_foremanId_fkey" FOREIGN KEY ("foremanId") REFERENCES "Foreman"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForemanAssistant" ADD CONSTRAINT "ForemanAssistant_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
