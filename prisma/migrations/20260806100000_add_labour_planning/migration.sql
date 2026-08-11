-- Additive Labour Planning rollout. Existing attendance, timesheets, rates,
-- payroll, and sites remain unchanged. This migration must not be applied to
-- a database where the MVP LabourPlanEntry table was already deployed.
CREATE TYPE "LabourPlanStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "LabourChangeRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE "LabourPlan" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "LabourPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "submittedByUserId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "cancelledByUserId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "completedByUserId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LabourPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LabourPlanTeam" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "teamCode" TEXT NOT NULL,
    "teamNameSnapshot" TEXT NOT NULL,
    "foremanId" TEXT NOT NULL,
    "suggestedSupervisorId" TEXT,
    "overrideSupervisorId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LabourPlanTeam_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LabourPlanDay" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "peopleCount" INTEGER NOT NULL,
    "expectedOvertime" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LabourPlanDay_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LabourPlanApprovalSnapshot" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "plannedCost" DECIMAL(14,2) NOT NULL,
    "rateBreakdown" JSONB NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LabourPlanApprovalSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LabourChangeRequest" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "peopleDelta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "status" "LabourChangeRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedByUserId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LabourChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LabourPlan_siteId_startDate_endDate_idx" ON "LabourPlan"("siteId", "startDate", "endDate");
CREATE INDEX "LabourPlan_status_startDate_idx" ON "LabourPlan"("status", "startDate");
CREATE INDEX "LabourPlan_createdByUserId_idx" ON "LabourPlan"("createdByUserId");
CREATE INDEX "LabourPlanTeam_planId_idx" ON "LabourPlanTeam"("planId");
CREATE INDEX "LabourPlanTeam_teamCode_idx" ON "LabourPlanTeam"("teamCode");
CREATE INDEX "LabourPlanTeam_foremanId_idx" ON "LabourPlanTeam"("foremanId");
CREATE INDEX "LabourPlanTeam_suggestedSupervisorId_idx" ON "LabourPlanTeam"("suggestedSupervisorId");
CREATE INDEX "LabourPlanTeam_overrideSupervisorId_idx" ON "LabourPlanTeam"("overrideSupervisorId");
CREATE UNIQUE INDEX "LabourPlanDay_teamId_workDate_key" ON "LabourPlanDay"("teamId", "workDate");
CREATE INDEX "LabourPlanDay_workDate_idx" ON "LabourPlanDay"("workDate");
CREATE UNIQUE INDEX "LabourPlanApprovalSnapshot_planId_key" ON "LabourPlanApprovalSnapshot"("planId");
CREATE INDEX "LabourChangeRequest_planId_status_idx" ON "LabourChangeRequest"("planId", "status");
CREATE INDEX "LabourChangeRequest_teamId_startDate_endDate_idx" ON "LabourChangeRequest"("teamId", "startDate", "endDate");
CREATE INDEX "LabourChangeRequest_status_startDate_idx" ON "LabourChangeRequest"("status", "startDate");

ALTER TABLE "LabourPlan" ADD CONSTRAINT "LabourPlan_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LabourPlan" ADD CONSTRAINT "LabourPlan_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LabourPlan" ADD CONSTRAINT "LabourPlan_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LabourPlan" ADD CONSTRAINT "LabourPlan_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LabourPlan" ADD CONSTRAINT "LabourPlan_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LabourPlan" ADD CONSTRAINT "LabourPlan_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LabourPlanTeam" ADD CONSTRAINT "LabourPlanTeam_planId_fkey" FOREIGN KEY ("planId") REFERENCES "LabourPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LabourPlanTeam" ADD CONSTRAINT "LabourPlanTeam_foremanId_fkey" FOREIGN KEY ("foremanId") REFERENCES "Foreman"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LabourPlanTeam" ADD CONSTRAINT "LabourPlanTeam_suggestedSupervisorId_fkey" FOREIGN KEY ("suggestedSupervisorId") REFERENCES "Supervisor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LabourPlanTeam" ADD CONSTRAINT "LabourPlanTeam_overrideSupervisorId_fkey" FOREIGN KEY ("overrideSupervisorId") REFERENCES "Supervisor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LabourPlanDay" ADD CONSTRAINT "LabourPlanDay_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "LabourPlanTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LabourPlanApprovalSnapshot" ADD CONSTRAINT "LabourPlanApprovalSnapshot_planId_fkey" FOREIGN KEY ("planId") REFERENCES "LabourPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LabourChangeRequest" ADD CONSTRAINT "LabourChangeRequest_planId_fkey" FOREIGN KEY ("planId") REFERENCES "LabourPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LabourChangeRequest" ADD CONSTRAINT "LabourChangeRequest_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "LabourPlanTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LabourChangeRequest" ADD CONSTRAINT "LabourChangeRequest_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LabourChangeRequest" ADD CONSTRAINT "LabourChangeRequest_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LabourChangeRequest" ADD CONSTRAINT "LabourChangeRequest_rejectedByUserId_fkey" FOREIGN KEY ("rejectedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
