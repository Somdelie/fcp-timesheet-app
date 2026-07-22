ALTER TABLE "MaterialColorVariant"
  ADD COLUMN "baseId" TEXT;

UPDATE "MaterialColorVariant" AS c
SET "baseId" = b."id"
FROM "MaterialBase" AS b
WHERE b."materialId" = c."materialId"
  AND lower(b."name") = lower(
    CASE c."baseType"
      WHEN 'CLEAR' THEN 'Clear'
      WHEN 'DEEP' THEN 'Deep'
      WHEN 'NEUTRAL' THEN 'Neutral'
      WHEN 'PASTEL' THEN 'Pastel'
      WHEN 'WHITE' THEN 'White'
      ELSE c."baseType"::text
    END
  );

CREATE INDEX "MaterialColorVariant_baseId_idx"
  ON "MaterialColorVariant"("baseId");

ALTER TABLE "MaterialColorVariant"
  ADD CONSTRAINT "MaterialColorVariant_baseId_fkey"
  FOREIGN KEY ("baseId") REFERENCES "MaterialBase"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
