-- Safe production migration: additive enum value only.
-- Adding a value to an existing Postgres enum type does not affect any
-- existing row and requires no reset.

ALTER TYPE "ScanOutMethod" ADD VALUE IF NOT EXISTS 'FACE';
