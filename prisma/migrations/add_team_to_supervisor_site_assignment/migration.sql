-- Add team field to SupervisorSiteAssignment
-- This allows specifying which team each supervisor manages at a site
ALTER TABLE "SupervisorSiteAssignment" ADD COLUMN "team" VARCHAR(50);

-- For existing assignments, they should be set manually via UI
-- We don't auto-populate since we don't know the intent
