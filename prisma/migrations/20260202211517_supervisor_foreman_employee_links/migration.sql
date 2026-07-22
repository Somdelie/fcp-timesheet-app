/*
  Warnings:

  - You are about to drop the column `faceEmbedding` on the `Employee` table. All the data in the column will be lost.
  - You are about to drop the column `faceImageUploadedAt` on the `Employee` table. All the data in the column will be lost.
  - You are about to drop the column `faceImageUrl` on the `Employee` table. All the data in the column will be lost.
  - You are about to drop the column `faceImageVerified` on the `Employee` table. All the data in the column will be lost.
  - You are about to drop the column `faceImageVerifiedAt` on the `Employee` table. All the data in the column will be lost.
  - You are about to drop the column `faceImageVerifiedByUserId` on the `Employee` table. All the data in the column will be lost.
  - Added the required column `createdByUserId` to the `Employee` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Employee" DROP CONSTRAINT "Employee_faceImageVerifiedByUserId_fkey";

-- AlterTable
ALTER TABLE "Employee" DROP COLUMN "faceEmbedding",
DROP COLUMN "faceImageUploadedAt",
DROP COLUMN "faceImageUrl",
DROP COLUMN "faceImageVerified",
DROP COLUMN "faceImageVerifiedAt",
DROP COLUMN "faceImageVerifiedByUserId",
ADD COLUMN     "createdByUserId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "ForemanEmployee" (
    "foremanId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForemanEmployee_pkey" PRIMARY KEY ("foremanId","employeeId")
);

-- CreateTable
CREATE TABLE "SupervisorForeman" (
    "supervisorId" TEXT NOT NULL,
    "foremanId" TEXT NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupervisorForeman_pkey" PRIMARY KEY ("supervisorId","foremanId","startsOn")
);

-- CreateIndex
CREATE INDEX "ForemanEmployee_employeeId_idx" ON "ForemanEmployee"("employeeId");

-- CreateIndex
CREATE INDEX "SupervisorForeman_supervisorId_idx" ON "SupervisorForeman"("supervisorId");

-- CreateIndex
CREATE INDEX "SupervisorForeman_foremanId_idx" ON "SupervisorForeman"("foremanId");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForemanEmployee" ADD CONSTRAINT "ForemanEmployee_foremanId_fkey" FOREIGN KEY ("foremanId") REFERENCES "Foreman"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForemanEmployee" ADD CONSTRAINT "ForemanEmployee_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisorForeman" ADD CONSTRAINT "SupervisorForeman_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Supervisor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisorForeman" ADD CONSTRAINT "SupervisorForeman_foremanId_fkey" FOREIGN KEY ("foremanId") REFERENCES "Foreman"("id") ON DELETE CASCADE ON UPDATE CASCADE;
