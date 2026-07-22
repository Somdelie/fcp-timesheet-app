ALTER TABLE "MasterCatalogueProduct"
ADD COLUMN "category" TEXT NOT NULL DEFAULT 'Paints';

CREATE INDEX "MasterCatalogueProduct_category_idx"
ON "MasterCatalogueProduct"("category");

CREATE TYPE "MasterProductUsage" AS ENUM ('Int', 'Ext', 'Int/Ext');

ALTER TABLE "MasterCatalogueProduct"
ADD COLUMN "usage" "MasterProductUsage" NOT NULL DEFAULT 'Int/Ext';

CREATE INDEX "MasterCatalogueProduct_usage_idx"
ON "MasterCatalogueProduct"("usage");