-- Generalise product rates beyond paint coverage while retaining the legacy
-- columns used by the current paint-planning workflow.
CREATE TYPE "ProductRateMode" AS ENUM ('COVERAGE', 'CONSUMPTION', 'CONTAINER_COVERAGE');
CREATE TYPE "ProductRateUnit" AS ENUM ('M2_PER_L', 'M2_PER_KG', 'L_PER_M2', 'KG_PER_M2', 'M2_PER_CONTAINER');
CREATE TYPE "ProductThicknessUnit" AS ENUM ('MICRON', 'MM');

ALTER TABLE "ProcurementProductCoverage"
  ALTER COLUMN "coverageType" DROP NOT NULL,
  ALTER COLUMN "coverageType" DROP DEFAULT,
  ALTER COLUMN "coverageM2" DROP NOT NULL,
  ALTER COLUMN "coverageM2PerLitre" DROP NOT NULL,
  ALTER COLUMN "coverageBasis" DROP NOT NULL,
  ALTER COLUMN "coverageBasis" DROP DEFAULT,
  ALTER COLUMN "recommendedCoats" DROP NOT NULL,
  ALTER COLUMN "recommendedCoats" DROP DEFAULT,
  ADD COLUMN "rateMode" "ProductRateMode" NOT NULL DEFAULT 'COVERAGE',
  ADD COLUMN "rateUnit" "ProductRateUnit" NOT NULL DEFAULT 'M2_PER_L',
  ADD COLUMN "rateMin" DECIMAL(12,3),
  ADD COLUMN "rateMax" DECIMAL(12,3),
  ADD COLUMN "recommendedCoatsMin" INTEGER,
  ADD COLUMN "recommendedCoatsMax" INTEGER,
  ADD COLUMN "thicknessMin" DECIMAL(12,3),
  ADD COLUMN "thicknessMax" DECIMAL(12,3),
  ADD COLUMN "thicknessUnit" "ProductThicknessUnit",
  ADD COLUMN "preferredPackSizeId" TEXT,
  ADD COLUMN "applicationMethods" JSONB,
  ADD COLUMN "manufacturerRateLabel" TEXT,
  ADD COLUMN "sourceSnippet" TEXT;

UPDATE "ProcurementProductCoverage"
SET
  "rateMin" = "coverageM2PerLitre",
  "rateMax" = "coverageM2PerLitre",
  "recommendedCoatsMin" = "recommendedCoats",
  "recommendedCoatsMax" = "recommendedCoats",
  "thicknessMin" = COALESCE("recommendedDftMicrons", "recommendedWftMicrons"),
  "thicknessMax" = COALESCE("recommendedDftMicrons", "recommendedWftMicrons"),
  "thicknessUnit" = CASE
    WHEN "recommendedDftMicrons" IS NOT NULL OR "recommendedWftMicrons" IS NOT NULL
      THEN 'MICRON'::"ProductThicknessUnit"
    ELSE NULL
  END,
  "applicationMethods" = CASE
    WHEN "applicationMethod" IS NOT NULL THEN to_jsonb(ARRAY["applicationMethod"])
    ELSE NULL
  END;

ALTER TABLE "PaintTdsImport"
  ADD COLUMN "packSizes" JSONB;

ALTER TABLE "PaintTdsImportProfile"
  ADD COLUMN "applicationMethods" JSONB,
  ADD COLUMN "rateMode" "ProductRateMode",
  ADD COLUMN "rateUnit" "ProductRateUnit",
  ADD COLUMN "rateMin" DECIMAL(12,3),
  ADD COLUMN "rateMax" DECIMAL(12,3),
  ADD COLUMN "recommendedCoatsMin" INTEGER,
  ADD COLUMN "recommendedCoatsMax" INTEGER,
  ADD COLUMN "thicknessMin" DECIMAL(12,3),
  ADD COLUMN "thicknessMax" DECIMAL(12,3),
  ADD COLUMN "thicknessUnit" "ProductThicknessUnit",
  ADD COLUMN "manufacturerRateLabel" TEXT,
  ADD COLUMN "sourceSnippet" TEXT;

UPDATE "PaintTdsImportProfile"
SET
  "applicationMethods" = CASE
    WHEN "applicationMethod" IS NOT NULL THEN to_jsonb(ARRAY["applicationMethod"])
    ELSE NULL
  END,
  "rateMode" = 'COVERAGE',
  "rateUnit" = 'M2_PER_L',
  "rateMin" = "coverageM2PerLitre",
  "rateMax" = "coverageM2PerLitre",
  "recommendedCoatsMin" = "recommendedCoats",
  "recommendedCoatsMax" = "recommendedCoats",
  "thicknessMin" = COALESCE("recommendedDftMicrons", "recommendedWftMicrons"),
  "thicknessMax" = COALESCE("recommendedDftMicrons", "recommendedWftMicrons"),
  "thicknessUnit" = CASE
    WHEN "recommendedDftMicrons" IS NOT NULL OR "recommendedWftMicrons" IS NOT NULL
      THEN 'MICRON'::"ProductThicknessUnit"
    ELSE NULL
  END;

CREATE TABLE "ProcurementProductPackSize" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" DECIMAL(12,3) NOT NULL,
  "uom" "ProductUom" NOT NULL,
  "label" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProcurementProductPackSize_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ProcurementProductPackSize" (
  "id", "productId", "quantity", "uom", "label", "updatedAt"
)
SELECT
  'legacy_' || "id", "id", "unitSize", "uom",
  trim(to_char("unitSize", 'FM999999990.###')) || ' ' || "uom"::text,
  CURRENT_TIMESTAMP
FROM "ProcurementProduct"
WHERE "unitSize" IS NOT NULL AND "uom" IS NOT NULL;

CREATE TABLE "ProcurementProductCoverageStep" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "stepNumber" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "rateMin" DECIMAL(12,3),
  "rateMax" DECIMAL(12,3),
  "rateUnit" "ProductRateUnit",
  "wetFilmThicknessMicrons" DECIMAL(12,3),
  "dryFilmThicknessMicrons" DECIMAL(12,3),
  "applicationMethod" TEXT,
  "note" TEXT,

  CONSTRAINT "ProcurementProductCoverageStep_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProcurementProductCoverageStep_profileId_stepNumber_key"
  ON "ProcurementProductCoverageStep"("profileId", "stepNumber");
CREATE INDEX "ProcurementProductCoverageStep_profileId_idx"
  ON "ProcurementProductCoverageStep"("profileId");
CREATE INDEX "ProcurementProductCoverage_productId_idx"
  ON "ProcurementProductCoverage"("productId");
CREATE INDEX "ProcurementProductCoverage_rateMode_idx"
  ON "ProcurementProductCoverage"("rateMode");
CREATE INDEX "ProcurementProductCoverage_rateUnit_idx"
  ON "ProcurementProductCoverage"("rateUnit");
CREATE INDEX "ProcurementProductCoverage_preferredPackSizeId_idx"
  ON "ProcurementProductCoverage"("preferredPackSizeId");
CREATE UNIQUE INDEX "ProcurementProductPackSize_productId_quantity_uom_key"
  ON "ProcurementProductPackSize"("productId", "quantity", "uom");
CREATE INDEX "ProcurementProductPackSize_productId_isActive_idx"
  ON "ProcurementProductPackSize"("productId", "isActive");

ALTER TABLE "ProcurementProductCoverageStep"
  ADD CONSTRAINT "ProcurementProductCoverageStep_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "ProcurementProductCoverage"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProcurementProductPackSize"
  ADD CONSTRAINT "ProcurementProductPackSize_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "ProcurementProduct"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProcurementProductCoverage"
  ADD CONSTRAINT "ProcurementProductCoverage_preferredPackSizeId_fkey"
  FOREIGN KEY ("preferredPackSizeId") REFERENCES "ProcurementProductPackSize"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
