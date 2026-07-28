-- CreateEnum
CREATE TYPE "PlantCondition" AS ENUM ('NEW', 'OLD');

-- AlterTable
ALTER TABLE "ProductVariantStock" ADD COLUMN "condition" "PlantCondition" NOT NULL DEFAULT 'OLD';

-- AlterTable
ALTER TABLE "SitePlantAssignment" ADD COLUMN "condition" "PlantCondition" NOT NULL DEFAULT 'OLD';

-- DropIndex (previous 3-column uniqueness, superseded by the 4-column one below)
DROP INDEX IF EXISTS "ProductVariantStock_productId_size_color_key";

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariantStock_productId_size_color_condition_key" ON "ProductVariantStock"("productId", "size", "color", "condition");
