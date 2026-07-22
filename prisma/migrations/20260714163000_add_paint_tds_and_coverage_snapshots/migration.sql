-- Paint coverage model upgrade + paint plan audit snapshots + TDS staging imports

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaintCoverageBasis') THEN
    CREATE TYPE "PaintCoverageBasis" AS ENUM ('PER_COAT', 'TOTAL_SYSTEM');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaintCoverageType') THEN
    CREATE TYPE "PaintCoverageType" AS ENUM ('THEORETICAL', 'PRACTICAL');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TdsImportStatus') THEN
    CREATE TYPE "TdsImportStatus" AS ENUM (
      'UPLOADED',
      'EXTRACTING',
      'PARSING',
      'NEEDS_REVIEW',
      'APPROVED',
      'IMPORTED',
      'FAILED'
    );
  END IF;
END
$$;

ALTER TABLE "ProcurementProductCoverage"
  ADD COLUMN IF NOT EXISTS "name" TEXT,
  ADD COLUMN IF NOT EXISTS "applicationMethod" TEXT,
  ADD COLUMN IF NOT EXISTS "coverageType" "PaintCoverageType" DEFAULT 'PRACTICAL',
  ADD COLUMN IF NOT EXISTS "coverageM2PerLitre" DECIMAL(12,3),
  ADD COLUMN IF NOT EXISTS "coverageBasis" "PaintCoverageBasis" DEFAULT 'PER_COAT',
  ADD COLUMN IF NOT EXISTS "recommendedCoats" INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "recommendedDftMicrons" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "recommendedWftMicrons" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "sourceDocument" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceRevision" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceRevisionDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "sourcePage" INTEGER,
  ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN DEFAULT false;

UPDATE "ProcurementProductCoverage"
SET
  "name" = COALESCE("name", CONCAT('Legacy coverage ', SUBSTRING("id" FROM 1 FOR 8))),
  "coverageType" = COALESCE("coverageType", 'PRACTICAL'::"PaintCoverageType"),
  "coverageBasis" = COALESCE("coverageBasis", 'PER_COAT'::"PaintCoverageBasis"),
  "recommendedCoats" = COALESCE("recommendedCoats", 1),
  "coverageM2PerLitre" = COALESCE(
    "coverageM2PerLitre",
    CASE
      WHEN COALESCE("unitSize", 0) > 0 THEN ROUND(("coverageM2" / "unitSize")::numeric, 3)
      ELSE ROUND("coverageM2"::numeric, 3)
    END
  )
WHERE "name" IS NULL
   OR "coverageM2PerLitre" IS NULL
   OR "coverageType" IS NULL
   OR "coverageBasis" IS NULL
   OR "recommendedCoats" IS NULL;

ALTER TABLE "ProcurementProductCoverage"
  ALTER COLUMN "name" SET NOT NULL,
  ALTER COLUMN "coverageType" SET NOT NULL,
  ALTER COLUMN "coverageM2PerLitre" SET NOT NULL,
  ALTER COLUMN "coverageBasis" SET NOT NULL,
  ALTER COLUMN "recommendedCoats" SET NOT NULL,
  ALTER COLUMN "isDefault" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ProcurementProductCoverage_productId_name_key"
  ON "ProcurementProductCoverage"("productId", "name");

CREATE INDEX IF NOT EXISTS "ProcurementProductCoverage_productId_isDefault_idx"
  ON "ProcurementProductCoverage"("productId", "isDefault");

ALTER TABLE "SitePaintPlan"
  ADD COLUMN IF NOT EXISTS "coverageNameSnapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "coverageM2PerLitreSnapshot" DECIMAL(12,3),
  ADD COLUMN IF NOT EXISTS "coverageBasisSnapshot" "PaintCoverageBasis" DEFAULT 'PER_COAT',
  ADD COLUMN IF NOT EXISTS "containerSizeLitresSnapshot" DECIMAL(12,3),
  ADD COLUMN IF NOT EXISTS "wastagePercent" DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "requiredLitresBeforeWastage" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "wastageLitres" DECIMAL(12,2) DEFAULT 0;

UPDATE "SitePaintPlan" spp
SET
  "coverageNameSnapshot" = COALESCE(spp."coverageNameSnapshot", ppc."name", 'Legacy coverage'),
  "coverageM2PerLitreSnapshot" = COALESCE(
    spp."coverageM2PerLitreSnapshot",
    ppc."coverageM2PerLitre",
    CASE
      WHEN ppc."coverageM2" IS NOT NULL AND COALESCE(ppc."unitSize", 0) > 0
        THEN ROUND((ppc."coverageM2" / ppc."unitSize")::numeric, 3)
      WHEN COALESCE(spp."requiredLitres", 0) > 0
        THEN ROUND(((spp."areaM2" * GREATEST(spp."coats", 1)) / spp."requiredLitres")::numeric, 3)
      ELSE 1
    END
  ),
  "coverageBasisSnapshot" = COALESCE(
    spp."coverageBasisSnapshot",
    ppc."coverageBasis",
    'PER_COAT'::"PaintCoverageBasis"
  ),
  "containerSizeLitresSnapshot" = COALESCE(
    spp."containerSizeLitresSnapshot",
    ppc."unitSize",
    pp."unitSize",
    20
  ),
  "wastagePercent" = COALESCE(spp."wastagePercent", 0),
  "requiredLitresBeforeWastage" = COALESCE(spp."requiredLitresBeforeWastage", spp."requiredLitres", 0),
  "wastageLitres" = COALESCE(spp."wastageLitres", 0)
FROM "ProcurementProductCoverage" ppc
LEFT JOIN "ProcurementProduct" pp ON pp."id" = ppc."productId"
WHERE spp."coverageId" = ppc."id";

-- Backfill rows without coverage profile
UPDATE "SitePaintPlan" spp
SET
  "coverageNameSnapshot" = COALESCE(spp."coverageNameSnapshot", 'Manual coverage'),
  "coverageM2PerLitreSnapshot" = COALESCE(
    spp."coverageM2PerLitreSnapshot",
    CASE
      WHEN COALESCE(spp."requiredLitres", 0) > 0
        THEN ROUND(((spp."areaM2" * GREATEST(spp."coats", 1)) / spp."requiredLitres")::numeric, 3)
      ELSE 1
    END
  ),
  "coverageBasisSnapshot" = COALESCE(spp."coverageBasisSnapshot", 'PER_COAT'::"PaintCoverageBasis"),
  "containerSizeLitresSnapshot" = COALESCE(spp."containerSizeLitresSnapshot", pp."unitSize", 20),
  "wastagePercent" = COALESCE(spp."wastagePercent", 0),
  "requiredLitresBeforeWastage" = COALESCE(spp."requiredLitresBeforeWastage", spp."requiredLitres", 0),
  "wastageLitres" = COALESCE(spp."wastageLitres", 0)
FROM "ProcurementProduct" pp
WHERE spp."productId" = pp."id"
  AND spp."coverageId" IS NULL;

ALTER TABLE "SitePaintPlan"
  ALTER COLUMN "coverageM2PerLitreSnapshot" SET NOT NULL,
  ALTER COLUMN "coverageBasisSnapshot" SET NOT NULL,
  ALTER COLUMN "containerSizeLitresSnapshot" SET NOT NULL,
  ALTER COLUMN "wastagePercent" SET NOT NULL,
  ALTER COLUMN "requiredLitresBeforeWastage" SET NOT NULL,
  ALTER COLUMN "wastageLitres" SET NOT NULL;

CREATE TABLE IF NOT EXISTS "PaintTdsImport" (
  "id" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileUrl" TEXT,
  "status" "TdsImportStatus" NOT NULL DEFAULT 'UPLOADED',
  "extractedText" TEXT,
  "parsedJson" JSONB,
  "warnings" JSONB,
  "productCodeDetected" TEXT,
  "productNameDetected" TEXT,
  "errorMessage" TEXT,
  "uploadedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaintTdsImport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PaintTdsImportProfile" (
  "id" TEXT NOT NULL,
  "importId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "applicationMethod" TEXT,
  "coverageM2PerLitre" DECIMAL(12,3),
  "coverageBasis" "PaintCoverageBasis",
  "coverageType" "PaintCoverageType",
  "recommendedCoats" INTEGER,
  "recommendedDftMicrons" DECIMAL(12,2),
  "recommendedWftMicrons" DECIMAL(12,2),
  "sourcePage" INTEGER,
  "note" TEXT,
  "confidence" DECIMAL(5,4),
  "isSelected" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaintTdsImportProfile_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'PaintTdsImport_uploadedByUserId_fkey'
  ) THEN
    ALTER TABLE "PaintTdsImport"
      ADD CONSTRAINT "PaintTdsImport_uploadedByUserId_fkey"
      FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'PaintTdsImportProfile_importId_fkey'
  ) THEN
    ALTER TABLE "PaintTdsImportProfile"
      ADD CONSTRAINT "PaintTdsImportProfile_importId_fkey"
      FOREIGN KEY ("importId") REFERENCES "PaintTdsImport"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "PaintTdsImport_status_idx" ON "PaintTdsImport"("status");
CREATE INDEX IF NOT EXISTS "PaintTdsImport_productCodeDetected_idx" ON "PaintTdsImport"("productCodeDetected");
CREATE INDEX IF NOT EXISTS "PaintTdsImportProfile_importId_idx" ON "PaintTdsImportProfile"("importId");
