-- Add site-specific paint colours captured from BuildSmart order PDFs.
CREATE TABLE "SitePaintColor" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "productId" TEXT,
    "colorVariantId" TEXT,
    "supplierId" TEXT,
    "sourceOrderId" TEXT,
    "sourceOrderItemId" TEXT,
    "orderReference" TEXT,
    "sourceFile" TEXT,
    "rawDescription" TEXT,
    "productSnapshot" TEXT,
    "supplierSnapshot" TEXT,
    "colorName" TEXT NOT NULL,
    "colorCode" TEXT,
    "baseType" "ColorBaseType" NOT NULL DEFAULT 'NEUTRAL',
    "isTinted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SitePaintColor_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SitePaintColor_siteId_idx" ON "SitePaintColor"("siteId");
CREATE INDEX "SitePaintColor_siteId_colorName_idx" ON "SitePaintColor"("siteId", "colorName");
CREATE INDEX "SitePaintColor_siteId_baseType_idx" ON "SitePaintColor"("siteId", "baseType");
CREATE INDEX "SitePaintColor_productId_idx" ON "SitePaintColor"("productId");
CREATE INDEX "SitePaintColor_colorVariantId_idx" ON "SitePaintColor"("colorVariantId");
CREATE INDEX "SitePaintColor_supplierId_idx" ON "SitePaintColor"("supplierId");
CREATE INDEX "SitePaintColor_sourceOrderId_idx" ON "SitePaintColor"("sourceOrderId");
CREATE INDEX "SitePaintColor_sourceOrderItemId_idx" ON "SitePaintColor"("sourceOrderItemId");

ALTER TABLE "SitePaintColor"
  ADD CONSTRAINT "SitePaintColor_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SitePaintColor"
  ADD CONSTRAINT "SitePaintColor_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "ProcurementProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SitePaintColor"
  ADD CONSTRAINT "SitePaintColor_colorVariantId_fkey"
  FOREIGN KEY ("colorVariantId") REFERENCES "ProductColorVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SitePaintColor"
  ADD CONSTRAINT "SitePaintColor_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SitePaintColor"
  ADD CONSTRAINT "SitePaintColor_sourceOrderId_fkey"
  FOREIGN KEY ("sourceOrderId") REFERENCES "SiteProductOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SitePaintColor"
  ADD CONSTRAINT "SitePaintColor_sourceOrderItemId_fkey"
  FOREIGN KEY ("sourceOrderItemId") REFERENCES "SiteProductOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
