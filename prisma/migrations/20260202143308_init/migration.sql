-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'SUPERVISOR', 'FOREMAN');

-- CreateEnum
CREATE TYPE "TimesheetStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID');

-- CreateEnum
CREATE TYPE "PhotoRequestStatus" AS ENUM ('REQUESTED', 'SUBMITTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PhotoVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'FLAGGED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supervisor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supervisor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Foreman" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "defaultDayRate" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Foreman_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "qrCodeValue" TEXT NOT NULL,
    "defaultDayRate" DECIMAL(12,2) NOT NULL,
    "faceImageUrl" TEXT,
    "faceImageUploadedAt" TIMESTAMP(3),
    "faceImageVerified" BOOLEAN NOT NULL DEFAULT false,
    "faceImageVerifiedAt" TIMESTAMP(3),
    "faceImageVerifiedByUserId" TEXT,
    "faceEmbedding" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "location" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupervisorSiteAssignment" (
    "id" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupervisorSiteAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForemanSiteAssignment" (
    "id" TEXT NOT NULL,
    "foremanId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForemanSiteAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteDay" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "foremanId" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceScan" (
    "id" TEXT NOT NULL,
    "siteDayId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "siteId" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dayRateAtScan" DECIMAL(12,2) NOT NULL,
    "qrPayload" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteDayPhotoRequest" (
    "id" TEXT NOT NULL,
    "siteDayId" TEXT NOT NULL,
    "status" "PhotoRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),
    "requestedByUserId" TEXT,
    "note" TEXT,

    CONSTRAINT "SiteDayPhotoRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteDayPhoto" (
    "id" TEXT NOT NULL,
    "siteDayId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedByUserId" TEXT,
    "requestId" TEXT,

    CONSTRAINT "SiteDayPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoVerification" (
    "id" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "status" "PhotoVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedByUserId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "notes" TEXT,
    "bookedCount" INTEGER,
    "detectedCount" INTEGER,
    "missingCount" INTEGER,
    "suspectedImpersonations" INTEGER,

    CONSTRAINT "PhotoVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoDetection" (
    "id" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "employeeId" TEXT,
    "data" JSONB,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoDetection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimesheetPeriod" (
    "id" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimesheetPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Timesheet" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "foremanId" TEXT NOT NULL,
    "status" "TimesheetStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "approvedBySupervisorId" TEXT,
    "rejectionReason" TEXT,
    "totalWorkerWages" DECIMAL(14,2),
    "totalWorkerDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Timesheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Supervisor_userId_key" ON "Supervisor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Foreman_userId_key" ON "Foreman"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_qrCodeValue_key" ON "Employee"("qrCodeValue");

-- CreateIndex
CREATE UNIQUE INDEX "Site_code_key" ON "Site"("code");

-- CreateIndex
CREATE INDEX "SupervisorSiteAssignment_supervisorId_idx" ON "SupervisorSiteAssignment"("supervisorId");

-- CreateIndex
CREATE INDEX "SupervisorSiteAssignment_siteId_idx" ON "SupervisorSiteAssignment"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "SupervisorSiteAssignment_supervisorId_siteId_startsOn_key" ON "SupervisorSiteAssignment"("supervisorId", "siteId", "startsOn");

-- CreateIndex
CREATE INDEX "ForemanSiteAssignment_foremanId_idx" ON "ForemanSiteAssignment"("foremanId");

-- CreateIndex
CREATE INDEX "ForemanSiteAssignment_siteId_idx" ON "ForemanSiteAssignment"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "ForemanSiteAssignment_foremanId_siteId_startsOn_key" ON "ForemanSiteAssignment"("foremanId", "siteId", "startsOn");

-- CreateIndex
CREATE INDEX "SiteDay_workDate_idx" ON "SiteDay"("workDate");

-- CreateIndex
CREATE INDEX "SiteDay_siteId_workDate_idx" ON "SiteDay"("siteId", "workDate");

-- CreateIndex
CREATE INDEX "SiteDay_foremanId_workDate_idx" ON "SiteDay"("foremanId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "SiteDay_siteId_workDate_key" ON "SiteDay"("siteId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "SiteDay_foremanId_workDate_key" ON "SiteDay"("foremanId", "workDate");

-- CreateIndex
CREATE INDEX "AttendanceScan_siteId_workDate_idx" ON "AttendanceScan"("siteId", "workDate");

-- CreateIndex
CREATE INDEX "AttendanceScan_siteDayId_idx" ON "AttendanceScan"("siteDayId");

-- CreateIndex
CREATE INDEX "AttendanceScan_scannedAt_idx" ON "AttendanceScan"("scannedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceScan_employeeId_workDate_key" ON "AttendanceScan"("employeeId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceScan_siteDayId_employeeId_key" ON "AttendanceScan"("siteDayId", "employeeId");

-- CreateIndex
CREATE INDEX "SiteDayPhotoRequest_siteDayId_status_idx" ON "SiteDayPhotoRequest"("siteDayId", "status");

-- CreateIndex
CREATE INDEX "SiteDayPhotoRequest_requestedAt_idx" ON "SiteDayPhotoRequest"("requestedAt");

-- CreateIndex
CREATE INDEX "SiteDayPhoto_siteDayId_uploadedAt_idx" ON "SiteDayPhoto"("siteDayId", "uploadedAt");

-- CreateIndex
CREATE INDEX "SiteDayPhoto_requestId_idx" ON "SiteDayPhoto"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "PhotoVerification_photoId_key" ON "PhotoVerification"("photoId");

-- CreateIndex
CREATE INDEX "PhotoVerification_status_idx" ON "PhotoVerification"("status");

-- CreateIndex
CREATE INDEX "PhotoVerification_verifiedAt_idx" ON "PhotoVerification"("verifiedAt");

-- CreateIndex
CREATE INDEX "PhotoDetection_photoId_idx" ON "PhotoDetection"("photoId");

-- CreateIndex
CREATE INDEX "PhotoDetection_employeeId_idx" ON "PhotoDetection"("employeeId");

-- CreateIndex
CREATE INDEX "TimesheetPeriod_startDate_idx" ON "TimesheetPeriod"("startDate");

-- CreateIndex
CREATE INDEX "TimesheetPeriod_endDate_idx" ON "TimesheetPeriod"("endDate");

-- CreateIndex
CREATE UNIQUE INDEX "TimesheetPeriod_startDate_endDate_key" ON "TimesheetPeriod"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "Timesheet_status_idx" ON "Timesheet"("status");

-- CreateIndex
CREATE INDEX "Timesheet_foremanId_periodId_idx" ON "Timesheet"("foremanId", "periodId");

-- CreateIndex
CREATE INDEX "Timesheet_approvedBySupervisorId_idx" ON "Timesheet"("approvedBySupervisorId");

-- CreateIndex
CREATE UNIQUE INDEX "Timesheet_periodId_foremanId_key" ON "Timesheet"("periodId", "foremanId");

-- CreateIndex
CREATE INDEX "AuditEvent_action_idx" ON "AuditEvent"("action");

-- CreateIndex
CREATE INDEX "AuditEvent_entity_entityId_idx" ON "AuditEvent"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditEvent_actorUserId_idx" ON "AuditEvent"("actorUserId");

-- AddForeignKey
ALTER TABLE "Supervisor" ADD CONSTRAINT "Supervisor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Foreman" ADD CONSTRAINT "Foreman_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_faceImageVerifiedByUserId_fkey" FOREIGN KEY ("faceImageVerifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisorSiteAssignment" ADD CONSTRAINT "SupervisorSiteAssignment_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Supervisor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisorSiteAssignment" ADD CONSTRAINT "SupervisorSiteAssignment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForemanSiteAssignment" ADD CONSTRAINT "ForemanSiteAssignment_foremanId_fkey" FOREIGN KEY ("foremanId") REFERENCES "Foreman"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForemanSiteAssignment" ADD CONSTRAINT "ForemanSiteAssignment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteDay" ADD CONSTRAINT "SiteDay_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteDay" ADD CONSTRAINT "SiteDay_foremanId_fkey" FOREIGN KEY ("foremanId") REFERENCES "Foreman"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceScan" ADD CONSTRAINT "AttendanceScan_siteDayId_fkey" FOREIGN KEY ("siteDayId") REFERENCES "SiteDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceScan" ADD CONSTRAINT "AttendanceScan_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceScan" ADD CONSTRAINT "AttendanceScan_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteDayPhotoRequest" ADD CONSTRAINT "SiteDayPhotoRequest_siteDayId_fkey" FOREIGN KEY ("siteDayId") REFERENCES "SiteDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteDayPhotoRequest" ADD CONSTRAINT "SiteDayPhotoRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteDayPhoto" ADD CONSTRAINT "SiteDayPhoto_siteDayId_fkey" FOREIGN KEY ("siteDayId") REFERENCES "SiteDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteDayPhoto" ADD CONSTRAINT "SiteDayPhoto_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteDayPhoto" ADD CONSTRAINT "SiteDayPhoto_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SiteDayPhotoRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoVerification" ADD CONSTRAINT "PhotoVerification_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "SiteDayPhoto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoVerification" ADD CONSTRAINT "PhotoVerification_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoDetection" ADD CONSTRAINT "PhotoDetection_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "SiteDayPhoto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoDetection" ADD CONSTRAINT "PhotoDetection_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "TimesheetPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_foremanId_fkey" FOREIGN KEY ("foremanId") REFERENCES "Foreman"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_approvedBySupervisorId_fkey" FOREIGN KEY ("approvedBySupervisorId") REFERENCES "Supervisor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
