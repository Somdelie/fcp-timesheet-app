/*
  Warnings:

  - A unique constraint covering the columns `[siteId,foremanId,workDate]` on the table `SiteDay` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[periodId,foremanId,siteId]` on the table `Timesheet` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ScanDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "DayAcceptanceStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DeductionType" AS ENUM ('CASH', 'PRODUCT');

-- CreateEnum
CREATE TYPE "DeductionApplyTo" AS ENUM ('CURRENT', 'NEXT');

-- AlterEnum
ALTER TYPE "TimesheetStatus" ADD VALUE 'ACCEPTED';

-- DropIndex
DROP INDEX "SiteDay_workDate_idx";

-- DropIndex
DROP INDEX "Timesheet_periodId_foremanId_key";

-- AlterTable
ALTER TABLE "AttendanceScan" ADD COLUMN     "address" TEXT,
ADD COLUMN     "direction" "ScanDirection" NOT NULL DEFAULT 'IN',
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "idNumber" TEXT;

-- AlterTable
ALTER TABLE "SiteDayPhoto" ADD COLUMN     "address" TEXT,
ADD COLUMN     "cloudinaryPublicId" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Timesheet" ADD COLUMN     "siteId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "PushToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimesheetDayAcceptance" (
    "id" TEXT NOT NULL,
    "timesheetId" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "status" "DayAcceptanceStatus" NOT NULL DEFAULT 'PENDING',
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "acceptedBySupervisorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimesheetDayAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deduction" (
    "id" TEXT NOT NULL,
    "type" "DeductionType" NOT NULL,
    "applyTo" "DeductionApplyTo" NOT NULL DEFAULT 'CURRENT',
    "employeeId" TEXT NOT NULL,
    "foremanId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "timesheetId" TEXT,
    "productId" TEXT,
    "quantity" INTEGER,
    "amount" DECIMAL(12,2),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deduction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushToken_token_key" ON "PushToken"("token");

-- CreateIndex
CREATE INDEX "PushToken_userId_idx" ON "PushToken"("userId");

-- CreateIndex
CREATE INDEX "TimesheetDayAcceptance_timesheetId_idx" ON "TimesheetDayAcceptance"("timesheetId");

-- CreateIndex
CREATE INDEX "TimesheetDayAcceptance_workDate_idx" ON "TimesheetDayAcceptance"("workDate");

-- CreateIndex
CREATE UNIQUE INDEX "TimesheetDayAcceptance_timesheetId_workDate_key" ON "TimesheetDayAcceptance"("timesheetId", "workDate");

-- CreateIndex
CREATE INDEX "Product_isActive_idx" ON "Product"("isActive");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE INDEX "Deduction_employeeId_createdAt_idx" ON "Deduction"("employeeId", "createdAt");

-- CreateIndex
CREATE INDEX "Deduction_foremanId_createdAt_idx" ON "Deduction"("foremanId", "createdAt");

-- CreateIndex
CREATE INDEX "Deduction_timesheetId_idx" ON "Deduction"("timesheetId");

-- CreateIndex
CREATE INDEX "Deduction_productId_idx" ON "Deduction"("productId");

-- CreateIndex
CREATE INDEX "Deduction_applyTo_idx" ON "Deduction"("applyTo");

-- CreateIndex
CREATE INDEX "Deduction_type_idx" ON "Deduction"("type");

-- CreateIndex
CREATE INDEX "AttendanceScan_direction_idx" ON "AttendanceScan"("direction");

-- CreateIndex
CREATE INDEX "Employee_isActive_idx" ON "Employee"("isActive");

-- CreateIndex
CREATE INDEX "Employee_lastName_firstName_idx" ON "Employee"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "Site_isActive_idx" ON "Site"("isActive");

-- CreateIndex
CREATE INDEX "Site_name_idx" ON "Site"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SiteDay_siteId_foremanId_workDate_key" ON "SiteDay"("siteId", "foremanId", "workDate");

-- CreateIndex
CREATE INDEX "Timesheet_siteId_idx" ON "Timesheet"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "Timesheet_periodId_foremanId_siteId_key" ON "Timesheet"("periodId", "foremanId", "siteId");

-- AddForeignKey
ALTER TABLE "PushToken" ADD CONSTRAINT "PushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetDayAcceptance" ADD CONSTRAINT "TimesheetDayAcceptance_acceptedBySupervisorId_fkey" FOREIGN KEY ("acceptedBySupervisorId") REFERENCES "Supervisor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetDayAcceptance" ADD CONSTRAINT "TimesheetDayAcceptance_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deduction" ADD CONSTRAINT "Deduction_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deduction" ADD CONSTRAINT "Deduction_foremanId_fkey" FOREIGN KEY ("foremanId") REFERENCES "Foreman"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deduction" ADD CONSTRAINT "Deduction_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deduction" ADD CONSTRAINT "Deduction_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deduction" ADD CONSTRAINT "Deduction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
