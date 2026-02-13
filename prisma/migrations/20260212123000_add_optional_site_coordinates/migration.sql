-- Add optional address/coordinate fields to Site (nullable so existing rows are unaffected)
ALTER TABLE "Site" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "Site" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "Site" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
