CREATE TABLE "MasterCatalogueProduct" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterCatalogueProduct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MasterProductFinish" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterProductFinish_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX
    "MasterCatalogueProduct_supplierId_normalizedName_key"
ON "MasterCatalogueProduct"("supplierId", "normalizedName");

CREATE INDEX
    "MasterCatalogueProduct_supplierId_idx"
ON "MasterCatalogueProduct"("supplierId");

CREATE INDEX
    "MasterCatalogueProduct_name_idx"
ON "MasterCatalogueProduct"("name");

CREATE INDEX
    "MasterCatalogueProduct_normalizedName_idx"
ON "MasterCatalogueProduct"("normalizedName");

CREATE INDEX
    "MasterCatalogueProduct_isActive_idx"
ON "MasterCatalogueProduct"("isActive");

CREATE UNIQUE INDEX
    "MasterProductFinish_productId_normalizedName_key"
ON "MasterProductFinish"("productId", "normalizedName");

CREATE INDEX
    "MasterProductFinish_productId_idx"
ON "MasterProductFinish"("productId");

CREATE INDEX
    "MasterProductFinish_normalizedName_idx"
ON "MasterProductFinish"("normalizedName");

ALTER TABLE "MasterCatalogueProduct"
ADD CONSTRAINT "MasterCatalogueProduct_supplierId_fkey"
FOREIGN KEY ("supplierId")
REFERENCES "Supplier"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "MasterProductFinish"
ADD CONSTRAINT "MasterProductFinish_productId_fkey"
FOREIGN KEY ("productId")
REFERENCES "MasterCatalogueProduct"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;