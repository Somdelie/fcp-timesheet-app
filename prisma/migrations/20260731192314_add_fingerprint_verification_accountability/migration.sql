-- Safe production migration: Fingerprint Verification & Accountability
-- Additive only: new enums, new tables, and new NULLABLE / DEFAULTED columns.
-- No existing table, column, or row is dropped, renamed, or modified in a
-- breaking way. Existing QR scan-in, photo scan-out-all, payroll, and
-- timesheet behavior is completely unaffected until these new fields are
-- explicitly populated by the new fingerprint flows.

-- ── New enums ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FingerprintEnrollmentStatus') THEN
    CREATE TYPE "FingerprintEnrollmentStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AttendanceVerificationStatus') THEN
    CREATE TYPE "AttendanceVerificationStatus" AS ENUM ('VERIFIED', 'PENDING_REVIEW', 'REJECTED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ScanOutMethod') THEN
    CREATE TYPE "ScanOutMethod" AS ENUM ('PHOTO', 'FINGERPRINT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AttendanceScanReviewAction') THEN
    CREATE TYPE "AttendanceScanReviewAction" AS ENUM ('MARK_VALID', 'REQUEST_EXPLANATION');
  END IF;
END $$;

-- ── New nullable columns on AttendanceScan ──────────────────────────────
ALTER TABLE "AttendanceScan" ADD COLUMN IF NOT EXISTS "scanOutMethod" "ScanOutMethod";
ALTER TABLE "AttendanceScan" ADD COLUMN IF NOT EXISTS "scanOutFingerprintMatchScore" DOUBLE PRECISION;
ALTER TABLE "AttendanceScan" ADD COLUMN IF NOT EXISTS "verificationStatus" "AttendanceVerificationStatus";
ALTER TABLE "AttendanceScan" ADD COLUMN IF NOT EXISTS "supervisorAuthByUserId" TEXT;
ALTER TABLE "AttendanceScan" ADD COLUMN IF NOT EXISTS "supervisorAuthAt" TIMESTAMP(3);
ALTER TABLE "AttendanceScan" ADD COLUMN IF NOT EXISTS "supervisorAuthDevice" TEXT;
ALTER TABLE "AttendanceScan" ADD COLUMN IF NOT EXISTS "supervisorAuthMatchScore" DOUBLE PRECISION;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AttendanceScan_supervisorAuthByUserId_fkey'
  ) THEN
    ALTER TABLE "AttendanceScan"
      ADD CONSTRAINT "AttendanceScan_supervisorAuthByUserId_fkey"
      FOREIGN KEY ("supervisorAuthByUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "AttendanceScan_verificationStatus_idx" ON "AttendanceScan"("verificationStatus");
CREATE INDEX IF NOT EXISTS "AttendanceScan_scanOutMethod_idx" ON "AttendanceScan"("scanOutMethod");
CREATE INDEX IF NOT EXISTS "AttendanceScan_supervisorAuthByUserId_idx" ON "AttendanceScan"("supervisorAuthByUserId");

-- ── New defaulted column on Site (rollout opt-in, default false) ───────
ALTER TABLE "Site" ADD COLUMN IF NOT EXISTS "manualAttendanceRequiresSupervisorFingerprint" BOOLEAN NOT NULL DEFAULT false;

-- ── New defaulted column on CompanySettings (rollout gate, default false) ─
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "fingerprintMandatory" BOOLEAN NOT NULL DEFAULT false;

-- ── New table: FingerprintEnrollment ────────────────────────────────────
CREATE TABLE IF NOT EXISTS "FingerprintEnrollment" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "rightThumbTemplate" BYTEA NOT NULL,
  "leftThumbTemplate" BYTEA NOT NULL,
  "status" "FingerprintEnrollmentStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
  "enrolledByForemanId" TEXT NOT NULL,
  "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "device" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "approvedByUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "rejectedReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FingerprintEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FingerprintEnrollment_employeeId_key" ON "FingerprintEnrollment"("employeeId");
CREATE INDEX IF NOT EXISTS "FingerprintEnrollment_status_idx" ON "FingerprintEnrollment"("status");
CREATE INDEX IF NOT EXISTS "FingerprintEnrollment_enrolledByForemanId_idx" ON "FingerprintEnrollment"("enrolledByForemanId");
CREATE INDEX IF NOT EXISTS "FingerprintEnrollment_approvedByUserId_idx" ON "FingerprintEnrollment"("approvedByUserId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FingerprintEnrollment_employeeId_fkey'
  ) THEN
    ALTER TABLE "FingerprintEnrollment"
      ADD CONSTRAINT "FingerprintEnrollment_employeeId_fkey"
      FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FingerprintEnrollment_enrolledByForemanId_fkey'
  ) THEN
    ALTER TABLE "FingerprintEnrollment"
      ADD CONSTRAINT "FingerprintEnrollment_enrolledByForemanId_fkey"
      FOREIGN KEY ("enrolledByForemanId") REFERENCES "Foreman"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FingerprintEnrollment_approvedByUserId_fkey'
  ) THEN
    ALTER TABLE "FingerprintEnrollment"
      ADD CONSTRAINT "FingerprintEnrollment_approvedByUserId_fkey"
      FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ── New table: AttendanceScanReview ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS "AttendanceScanReview" (
  "id" TEXT NOT NULL,
  "attendanceScanId" TEXT NOT NULL,
  "action" "AttendanceScanReviewAction" NOT NULL,
  "note" TEXT,
  "byUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AttendanceScanReview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AttendanceScanReview_attendanceScanId_idx" ON "AttendanceScanReview"("attendanceScanId");
CREATE INDEX IF NOT EXISTS "AttendanceScanReview_byUserId_idx" ON "AttendanceScanReview"("byUserId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AttendanceScanReview_attendanceScanId_fkey'
  ) THEN
    ALTER TABLE "AttendanceScanReview"
      ADD CONSTRAINT "AttendanceScanReview_attendanceScanId_fkey"
      FOREIGN KEY ("attendanceScanId") REFERENCES "AttendanceScan"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AttendanceScanReview_byUserId_fkey'
  ) THEN
    ALTER TABLE "AttendanceScanReview"
      ADD CONSTRAINT "AttendanceScanReview_byUserId_fkey"
      FOREIGN KEY ("byUserId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
