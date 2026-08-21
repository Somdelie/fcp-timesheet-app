-- Switches APK storage from a local filename reference to a GitHub Release
-- asset id. AppRelease has 0 rows (nothing has ever been published — the
-- Cloudinary and local-VPS-storage approaches were both abandoned before
-- any release row was created), so this is drop+add, not a lossy rename.
ALTER TABLE "AppRelease" DROP COLUMN "downloadPublicId";
ALTER TABLE "AppRelease" ADD COLUMN "githubAssetId" INTEGER NOT NULL;
