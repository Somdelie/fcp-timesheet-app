-- AlterTable
ALTER TABLE "CompanySettings" ADD COLUMN     "scanOutFaceEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "scanOutPhotoEnabled" BOOLEAN NOT NULL DEFAULT true;
