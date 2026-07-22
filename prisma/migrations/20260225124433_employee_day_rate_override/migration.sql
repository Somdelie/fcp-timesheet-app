-- CreateTable
CREATE TABLE "EmployeeDayRateOverride" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "siteId" TEXT,
    "startsOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3),
    "dayRate" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeDayRateOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeDayRateOverride_employeeId_startsOn_idx" ON "EmployeeDayRateOverride"("employeeId", "startsOn");

-- CreateIndex
CREATE INDEX "EmployeeDayRateOverride_siteId_startsOn_idx" ON "EmployeeDayRateOverride"("siteId", "startsOn");

-- AddForeignKey
ALTER TABLE "EmployeeDayRateOverride" ADD CONSTRAINT "EmployeeDayRateOverride_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDayRateOverride" ADD CONSTRAINT "EmployeeDayRateOverride_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDayRateOverride" ADD CONSTRAINT "EmployeeDayRateOverride_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
