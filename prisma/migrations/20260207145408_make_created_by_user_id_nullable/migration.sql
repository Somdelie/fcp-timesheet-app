-- DropForeignKey
ALTER TABLE "Employee" DROP CONSTRAINT "Employee_createdByUserId_fkey";

-- AlterTable
ALTER TABLE "Employee" ALTER COLUMN "createdByUserId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
