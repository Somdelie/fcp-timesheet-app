CREATE TABLE "SiteDocument" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "documentType" TEXT NOT NULL DEFAULT 'OTHER',
  "mimeType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "cloudinaryPublicId" TEXT,
  "cloudinaryResourceType" TEXT,
  "uploadedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SiteDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SiteDocument_siteId_createdAt_idx" ON "SiteDocument"("siteId", "createdAt");
CREATE INDEX "SiteDocument_documentType_idx" ON "SiteDocument"("documentType");
CREATE INDEX "SiteDocument_uploadedByUserId_idx" ON "SiteDocument"("uploadedByUserId");

ALTER TABLE "SiteDocument"
  ADD CONSTRAINT "SiteDocument_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SiteDocument"
  ADD CONSTRAINT "SiteDocument_uploadedByUserId_fkey"
  FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
