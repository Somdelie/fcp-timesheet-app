-- CreateEnum
CREATE TYPE "ProductOrderStatus" AS ENUM ('PENDING', 'PARTIALLY_APPLIED', 'APPLIED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Deduction" ADD COLUMN     "orderItemId" TEXT;

-- CreateTable
CREATE TABLE "ProductOrder" (
    "id" TEXT NOT NULL,
    "foremanId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "status" "ProductOrderStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductOrder_foremanId_createdAt_idx" ON "ProductOrder"("foremanId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductOrder_createdByUserId_createdAt_idx" ON "ProductOrder"("createdByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductOrder_status_idx" ON "ProductOrder"("status");

-- CreateIndex
CREATE INDEX "ProductOrderItem_orderId_idx" ON "ProductOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "ProductOrderItem_productId_idx" ON "ProductOrderItem"("productId");

-- AddForeignKey
ALTER TABLE "Deduction" ADD CONSTRAINT "Deduction_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "ProductOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOrder" ADD CONSTRAINT "ProductOrder_foremanId_fkey" FOREIGN KEY ("foremanId") REFERENCES "Foreman"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOrder" ADD CONSTRAINT "ProductOrder_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOrderItem" ADD CONSTRAINT "ProductOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOrderItem" ADD CONSTRAINT "ProductOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
