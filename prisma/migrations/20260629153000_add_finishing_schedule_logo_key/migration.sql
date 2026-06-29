CREATE TYPE "FinishingScheduleLogo" AS ENUM ('FIRST_CLASS', 'UNWABU');

ALTER TABLE "SiteFinishingSchedule"
  ADD COLUMN "logoKey" "FinishingScheduleLogo" NOT NULL DEFAULT 'FIRST_CLASS';
