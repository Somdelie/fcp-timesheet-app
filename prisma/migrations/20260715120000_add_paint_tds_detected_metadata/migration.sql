ALTER TABLE "PaintTdsImport"
  ADD COLUMN IF NOT EXISTS "manufacturerDetected" TEXT,
  ADD COLUMN IF NOT EXISTS "descriptionDetected" TEXT,
  ADD COLUMN IF NOT EXISTS "revisionDetected" TEXT,
  ADD COLUMN IF NOT EXISTS "revisionDateDetected" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "packSizesLitres" DOUBLE PRECISION[] NOT NULL DEFAULT ARRAY[]::DOUBLE PRECISION[];

CREATE INDEX IF NOT EXISTS "PaintTdsImport_manufacturerDetected_idx"
  ON "PaintTdsImport"("manufacturerDetected");
