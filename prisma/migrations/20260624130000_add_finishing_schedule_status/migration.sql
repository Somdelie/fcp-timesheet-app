CREATE TYPE "FinishingScheduleStatus" AS ENUM ('INITIAL');

ALTER TABLE "SiteFinishingSchedule"
  ADD COLUMN "status" "FinishingScheduleStatus" NOT NULL DEFAULT 'INITIAL';
