-- Safe production migration: additive enum values only.
-- Adding a value to an existing Postgres enum type does not affect any
-- existing row and requires no reset.

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'FINGERPRINT_ENROLLMENT_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'FINGERPRINT_ENROLLMENT_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ATTENDANCE_EXPLANATION_REQUESTED';

ALTER TYPE "AttendanceScanReviewAction" ADD VALUE IF NOT EXISTS 'ADD_SCAN_OUT';
