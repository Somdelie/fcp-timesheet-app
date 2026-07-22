CREATE TABLE "MasterProductBase" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterProductBase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MasterProductPrice" (
    "id" TEXT NOT NULL,
    "lookupKey" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "finishId" TEXT,
    "baseId" TEXT NOT NULL,
    "unitSize" DECIMAL(12,3) NOT NULL,
    "uom" "ProductUom" NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "sourceFile" TEXT,
    "sourceRow" INTEGER,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterProductPrice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MasterProductBase_productId_normalizedName_key"
ON "MasterProductBase"("productId", "normalizedName");

CREATE INDEX "MasterProductBase_productId_idx"
ON "MasterProductBase"("productId");

CREATE INDEX "MasterProductBase_normalizedName_idx"
ON "MasterProductBase"("normalizedName");

CREATE UNIQUE INDEX "MasterProductPrice_lookupKey_key"
ON "MasterProductPrice"("lookupKey");

CREATE INDEX "MasterProductPrice_productId_idx"
ON "MasterProductPrice"("productId");

CREATE INDEX "MasterProductPrice_finishId_idx"
ON "MasterProductPrice"("finishId");

CREATE INDEX "MasterProductPrice_baseId_idx"
ON "MasterProductPrice"("baseId");

CREATE INDEX "MasterProductPrice_productId_baseId_unitSize_uom_idx"
ON "MasterProductPrice"("productId", "baseId", "unitSize", "uom");

CREATE INDEX "MasterProductPrice_effectiveFrom_idx"
ON "MasterProductPrice"("effectiveFrom");

CREATE INDEX "MasterProductPrice_isActive_idx"
ON "MasterProductPrice"("isActive");

ALTER TABLE "MasterProductBase"
ADD CONSTRAINT "MasterProductBase_productId_fkey"
FOREIGN KEY ("productId")
REFERENCES "MasterCatalogueProduct"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "MasterProductPrice"
ADD CONSTRAINT "MasterProductPrice_productId_fkey"
FOREIGN KEY ("productId")
REFERENCES "MasterCatalogueProduct"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "MasterProductPrice"
ADD CONSTRAINT "MasterProductPrice_finishId_fkey"
FOREIGN KEY ("finishId")
REFERENCES "MasterProductFinish"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "MasterProductPrice"
ADD CONSTRAINT "MasterProductPrice_baseId_fkey"
FOREIGN KEY ("baseId")
REFERENCES "MasterProductBase"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;