CREATE TYPE "SpecStatus" AS ENUM ('NOT_REQUESTED', 'REQUESTED', 'RECEIVED', 'ACTIONED');

ALTER TABLE "Site"
  ADD COLUMN "specStatus" "SpecStatus" NOT NULL DEFAULT 'NOT_REQUESTED';

UPDATE "Site"
SET "specStatus" = CASE
  WHEN "specAvailable" = true THEN 'RECEIVED'::"SpecStatus"
  ELSE 'NOT_REQUESTED'::"SpecStatus"
END;
