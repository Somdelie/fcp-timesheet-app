/*
  Warnings:

  - A unique constraint covering the columns `[masterCatalogueProductId]` on the table `ProcurementProduct` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "MasterCatalogueProduct" ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "colors" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "deductionSplits" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "isDeductible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isReturnable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "productType" "ProductType" NOT NULL DEFAULT 'MATERIAL',
ADD COLUMN     "sizes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "sku" TEXT,
ADD COLUMN     "stockQty" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "thumbnailUrl" TEXT,
ADD COLUMN     "unitSize" DECIMAL(12,3),
ADD COLUMN     "uom" "ProductUom";

-- AlterTable
ALTER TABLE "ProcurementProduct" ADD COLUMN     "masterCatalogueProductId" TEXT;

-- CreateIndex
CREATE INDEX "MasterCatalogueProduct_categoryId_idx" ON "MasterCatalogueProduct"("categoryId");

-- CreateIndex
CREATE INDEX "MasterCatalogueProduct_sku_idx" ON "MasterCatalogueProduct"("sku");

-- CreateIndex
CREATE INDEX "MasterCatalogueProduct_productType_idx" ON "MasterCatalogueProduct"("productType");

-- CreateIndex
CREATE UNIQUE INDEX "ProcurementProduct_masterCatalogueProductId_key" ON "ProcurementProduct"("masterCatalogueProductId");

-- CreateIndex
CREATE INDEX "ProcurementProduct_masterCatalogueProductId_idx" ON "ProcurementProduct"("masterCatalogueProductId");

-- AddForeignKey
ALTER TABLE "ProcurementProduct" ADD CONSTRAINT "ProcurementProduct_masterCatalogueProductId_fkey" FOREIGN KEY ("masterCatalogueProductId") REFERENCES "MasterCatalogueProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterCatalogueProduct" ADD CONSTRAINT "MasterCatalogueProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
