-- Safe production migration: loosen a NOT NULL constraint only.
-- Fingerprint enrollment now confirms OS-level device biometric enrollment
-- rather than uploading/extracting an image-derived template, so these
-- columns are no longer populated on new rows. Making them nullable is
-- backward compatible and requires no data migration or reset.

ALTER TABLE "FingerprintEnrollment" ALTER COLUMN "rightThumbTemplate" DROP NOT NULL;
ALTER TABLE "FingerprintEnrollment" ALTER COLUMN "leftThumbTemplate" DROP NOT NULL;
