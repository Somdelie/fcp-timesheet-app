-- Add catalogue-only paint/material variant support.
-- This is intentionally additive: no live order tables are dropped or renamed.

ALTER TABLE "MaterialPrice"
  ADD COLUMN "baseId" TEXT,
  ADD COLUMN "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "sourcePdf" TEXT,
  ADD COLUMN "barcode" TEXT,
  ADD COLUMN "sku" TEXT;

CREATE TABLE "MaterialBase" (
  "id" TEXT NOT NULL,
  "materialId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MaterialBase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MaterialPriceHistory" (
  "id" TEXT NOT NULL,
  "materialPriceId" TEXT,
  "supplierId" TEXT NOT NULL,
  "materialId" TEXT NOT NULL,
  "baseId" TEXT,
  "colorVariantId" TEXT,
  "unitSize" DECIMAL(12,3),
  "uom" "ProductUom",
  "oldPrice" DECIMAL(12,2),
  "newPrice" DECIMAL(12,2) NOT NULL,
  "sourcePdf" TEXT,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MaterialPriceHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MaterialBase_materialId_name_key" ON "MaterialBase"("materialId", "name");
CREATE INDEX "MaterialBase_materialId_idx" ON "MaterialBase"("materialId");

CREATE INDEX "MaterialPrice_baseId_idx" ON "MaterialPrice"("baseId");
CREATE INDEX "MaterialPrice_colorVariantId_idx" ON "MaterialPrice"("colorVariantId");
CREATE INDEX "MaterialPrice_lastSeenAt_idx" ON "MaterialPrice"("lastSeenAt");

CREATE INDEX "MaterialPriceHistory_supplierId_materialId_idx" ON "MaterialPriceHistory"("supplierId", "materialId");
CREATE INDEX "MaterialPriceHistory_materialPriceId_idx" ON "MaterialPriceHistory"("materialPriceId");
CREATE INDEX "MaterialPriceHistory_baseId_idx" ON "MaterialPriceHistory"("baseId");
CREATE INDEX "MaterialPriceHistory_colorVariantId_idx" ON "MaterialPriceHistory"("colorVariantId");
CREATE INDEX "MaterialPriceHistory_importedAt_idx" ON "MaterialPriceHistory"("importedAt");

ALTER TABLE "MaterialPrice"
  ADD CONSTRAINT "MaterialPrice_baseId_fkey"
  FOREIGN KEY ("baseId") REFERENCES "MaterialBase"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MaterialBase"
  ADD CONSTRAINT "MaterialBase_materialId_fkey"
  FOREIGN KEY ("materialId") REFERENCES "Material"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MaterialPriceHistory"
  ADD CONSTRAINT "MaterialPriceHistory_materialPriceId_fkey"
  FOREIGN KEY ("materialPriceId") REFERENCES "MaterialPrice"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "MaterialPriceHistory_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "MaterialPriceHistory_materialId_fkey"
  FOREIGN KEY ("materialId") REFERENCES "Material"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "MaterialPriceHistory_baseId_fkey"
  FOREIGN KEY ("baseId") REFERENCES "MaterialBase"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "MaterialPriceHistory_colorVariantId_fkey"
  FOREIGN KEY ("colorVariantId") REFERENCES "MaterialColorVariant"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
