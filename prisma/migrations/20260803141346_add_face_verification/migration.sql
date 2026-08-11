-- CreateEnum
CREATE TYPE "FaceEnrollmentStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FaceEnrollmentPose" AS ENUM ('FRONT', 'LEFT', 'RIGHT', 'SMILE', 'NEUTRAL');

-- AlterTable
ALTER TABLE "AttendanceScan" ADD COLUMN     "scanOutFaceMatchScore" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "FaceEnrollment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "pose" "FaceEnrollmentPose" NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "embedding" DOUBLE PRECISION[],
    "qualityScore" DOUBLE PRECISION,
    "helmetDetected" BOOLEAN,
    "safetyGlassesDetected" BOOLEAN,
    "lightingCondition" TEXT,
    "status" "FaceEnrollmentStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
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

    CONSTRAINT "FaceEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaceVerificationAttempt" (
    "id" TEXT NOT NULL,
    "attendanceScanId" TEXT,
    "employeeId" TEXT NOT NULL,
    "matchedEnrollmentId" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "livenessPassed" BOOLEAN,
    "processingTimeMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FaceVerificationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FaceEnrollment_employeeId_idx" ON "FaceEnrollment"("employeeId");

-- CreateIndex
CREATE INDEX "FaceEnrollment_status_idx" ON "FaceEnrollment"("status");

-- CreateIndex
CREATE INDEX "FaceEnrollment_enrolledByForemanId_idx" ON "FaceEnrollment"("enrolledByForemanId");

-- CreateIndex
CREATE INDEX "FaceVerificationAttempt_attendanceScanId_idx" ON "FaceVerificationAttempt"("attendanceScanId");

-- CreateIndex
CREATE INDEX "FaceVerificationAttempt_employeeId_idx" ON "FaceVerificationAttempt"("employeeId");

-- CreateIndex
CREATE INDEX "FaceVerificationAttempt_createdAt_idx" ON "FaceVerificationAttempt"("createdAt");

-- AddForeignKey
ALTER TABLE "FaceEnrollment" ADD CONSTRAINT "FaceEnrollment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaceEnrollment" ADD CONSTRAINT "FaceEnrollment_enrolledByForemanId_fkey" FOREIGN KEY ("enrolledByForemanId") REFERENCES "Foreman"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaceEnrollment" ADD CONSTRAINT "FaceEnrollment_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaceVerificationAttempt" ADD CONSTRAINT "FaceVerificationAttempt_attendanceScanId_fkey" FOREIGN KEY ("attendanceScanId") REFERENCES "AttendanceScan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaceVerificationAttempt" ADD CONSTRAINT "FaceVerificationAttempt_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaceVerificationAttempt" ADD CONSTRAINT "FaceVerificationAttempt_matchedEnrollmentId_fkey" FOREIGN KEY ("matchedEnrollmentId") REFERENCES "FaceEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

