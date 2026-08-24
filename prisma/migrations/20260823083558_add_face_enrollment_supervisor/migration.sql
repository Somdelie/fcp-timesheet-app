-- DropForeignKey
ALTER TABLE "FaceEnrollment" DROP CONSTRAINT "FaceEnrollment_enrolledByForemanId_fkey";

-- AlterTable
ALTER TABLE "FaceEnrollment" ADD COLUMN     "enrolledBySupervisorId" TEXT,
ALTER COLUMN "enrolledByForemanId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "FaceEnrollment_enrolledBySupervisorId_idx" ON "FaceEnrollment"("enrolledBySupervisorId");

-- AddForeignKey
ALTER TABLE "FaceEnrollment" ADD CONSTRAINT "FaceEnrollment_enrolledByForemanId_fkey" FOREIGN KEY ("enrolledByForemanId") REFERENCES "Foreman"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaceEnrollment" ADD CONSTRAINT "FaceEnrollment_enrolledBySupervisorId_fkey" FOREIGN KEY ("enrolledBySupervisorId") REFERENCES "Supervisor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
