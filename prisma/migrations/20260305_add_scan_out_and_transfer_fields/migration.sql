-- Safe production migration: Add scan-out and transfer fields to AttendanceScan
-- All columns are NULLABLE - no existing data is affected

-- Add new columns to AttendanceScan
ALTER TABLE "AttendanceScan" ADD COLUMN IF NOT EXISTS "scannedOutAt" TIMESTAMP(3);
ALTER TABLE "AttendanceScan" ADD COLUMN IF NOT EXISTS "scanOutPhotoId" TEXT;
ALTER TABLE "AttendanceScan" ADD COLUMN IF NOT EXISTS "transferredFromSiteId" TEXT;
ALTER TABLE "AttendanceScan" ADD COLUMN IF NOT EXISTS "transferredFromScanId" TEXT;
ALTER TABLE "AttendanceScan" ADD COLUMN IF NOT EXISTS "transferredAt" TIMESTAMP(3);
ALTER TABLE "AttendanceScan" ADD COLUMN IF NOT EXISTS "transferredByUserId" TEXT;

-- Add foreign key: scanOutPhotoId -> SiteDayPhoto
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AttendanceScan_scanOutPhotoId_fkey'
  ) THEN
    ALTER TABLE "AttendanceScan"
      ADD CONSTRAINT "AttendanceScan_scanOutPhotoId_fkey"
      FOREIGN KEY ("scanOutPhotoId") REFERENCES "SiteDayPhoto"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Add foreign key: transferredByUserId -> User
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AttendanceScan_transferredByUserId_fkey'
  ) THEN
    ALTER TABLE "AttendanceScan"
      ADD CONSTRAINT "AttendanceScan_transferredByUserId_fkey"
      FOREIGN KEY ("transferredByUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
