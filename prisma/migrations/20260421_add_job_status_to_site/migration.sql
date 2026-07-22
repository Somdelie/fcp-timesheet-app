-- Add JobStatus enum and jobStatus column to Site
-- All existing sites default to NOT_STARTED.

CREATE TYPE "JobStatus" AS ENUM ('NOT_STARTED', 'ONGOING', 'COMPLETED', 'ON_HOLD');

ALTER TABLE "Site" ADD COLUMN "jobStatus" "JobStatus" NOT NULL DEFAULT 'NOT_STARTED';
