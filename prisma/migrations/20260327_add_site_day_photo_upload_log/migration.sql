-- Non-destructive migration: add SiteDayPhotoUploadLog table
-- Safe to apply on production; does not drop or alter existing tables.

CREATE TABLE IF NOT EXISTS "SiteDayPhotoUploadLog" (
  "id" TEXT PRIMARY KEY,
  "ts" TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  "durationMs" INTEGER,
  "success" BOOLEAN DEFAULT false NOT NULL,
  "userId" TEXT,
  "actingForemanId" TEXT,
  "siteDayId" TEXT,
  "cloudinaryPublicId" TEXT,
  "imageUrl" TEXT,
  "width" INTEGER,
  "height" INTEGER,
  "format" TEXT,
  "errorText" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS "SiteDayPhotoUploadLog_ts_idx" ON "SiteDayPhotoUploadLog" ("ts");
CREATE INDEX IF NOT EXISTS "SiteDayPhotoUploadLog_siteDayId_idx" ON "SiteDayPhotoUploadLog" ("siteDayId");
CREATE INDEX IF NOT EXISTS "SiteDayPhotoUploadLog_userId_idx" ON "SiteDayPhotoUploadLog" ("userId");
