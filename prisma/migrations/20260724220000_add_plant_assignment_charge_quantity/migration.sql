-- How many of `quantity` deployed units to actually bill the site for.
-- Null means "charge for all deployed" (falls back to `quantity`).
ALTER TABLE "SitePlantAssignment" ADD COLUMN "chargeQuantity" INTEGER;
