-- Additive: new AppRelease table for private Android APK update distribution
-- (Cloudinary-hosted, not EAS Update). No existing tables/columns touched.
CREATE TABLE "AppRelease" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'android',
    "version" TEXT NOT NULL,
    "versionCode" INTEGER NOT NULL,
    "minVersionCode" INTEGER NOT NULL,
    "downloadPublicId" TEXT NOT NULL,
    "releaseNotes" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppRelease_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppRelease_platform_isActive_idx" ON "AppRelease"("platform", "isActive");
