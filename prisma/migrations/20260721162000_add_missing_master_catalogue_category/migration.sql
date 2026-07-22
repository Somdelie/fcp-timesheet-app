ALTER TABLE "MasterCatalogueProduct"
ADD COLUMN "category" TEXT NOT NULL DEFAULT 'Paints';

CREATE INDEX "MasterCatalogueProduct_category_idx"
ON "MasterCatalogueProduct"("category");