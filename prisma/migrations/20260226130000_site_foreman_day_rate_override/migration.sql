-- CreateTable
CREATE TABLE "SiteForemanDayRateOverride" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "foremanId" TEXT NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3),
    "dayRate" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteForemanDayRateOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SiteForemanDayRateOverride_siteId_idx" ON "SiteForemanDayRateOverride"("siteId");

-- CreateIndex
CREATE INDEX "SiteForemanDayRateOverride_foremanId_idx" ON "SiteForemanDayRateOverride"("foremanId");

-- CreateIndex
CREATE INDEX "SiteForemanDayRateOverride_siteId_foremanId_startsOn_idx" ON "SiteForemanDayRateOverride"("siteId", "foremanId", "startsOn");

-- AddForeignKey
ALTER TABLE "SiteForemanDayRateOverride" ADD CONSTRAINT "SiteForemanDayRateOverride_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteForemanDayRateOverride" ADD CONSTRAINT "SiteForemanDayRateOverride_foremanId_fkey" FOREIGN KEY ("foremanId") REFERENCES "Foreman"("id") ON DELETE CASCADE ON UPDATE CASCADE;
