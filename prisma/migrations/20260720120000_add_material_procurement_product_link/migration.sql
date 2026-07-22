-- Hybrid cutover: 1:1 shadow link from Material to its relational-anchor ProcurementProduct.
-- App-managed (no DB foreign key) so ProcurementProduct's schema is untouched.

-- AlterTable
ALTER TABLE "Material" ADD COLUMN IF NOT EXISTS "procurementProductId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Material_procurementProductId_key" ON "Material"("procurementProductId");
