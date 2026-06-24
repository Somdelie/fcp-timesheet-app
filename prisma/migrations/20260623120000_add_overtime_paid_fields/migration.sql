ALTER TABLE "OvertimeEntry"
  ADD COLUMN "paidAt" TIMESTAMP(3),
  ADD COLUMN "paidByUserId" TEXT;

ALTER TABLE "OvertimeEntry"
  ADD CONSTRAINT "OvertimeEntry_paidByUserId_fkey"
  FOREIGN KEY ("paidByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "OvertimeEntry_paidAt_idx" ON "OvertimeEntry"("paidAt");
CREATE INDEX "OvertimeEntry_paidByUserId_idx" ON "OvertimeEntry"("paidByUserId");
