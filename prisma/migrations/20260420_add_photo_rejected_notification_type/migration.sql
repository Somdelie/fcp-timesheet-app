-- Add PHOTO_REJECTED value to NotificationType enum
-- Safe to apply on production; ADD VALUE is non-destructive in PostgreSQL.

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PHOTO_REJECTED';
