-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "HistoricalCostSource" AS ENUM ('BUILDSMART');

-- CreateEnum
CREATE TYPE "SpecStatus" AS ENUM ('NOT_REQUESTED', 'NOT_NEEDED', 'NOT_REQUIRED', 'REQUESTED', 'RECEIVED', 'ACTIONED');

-- CreateEnum
CREATE TYPE "HistoricalCostCategory" AS ENUM ('LABOUR', 'MATERIAL', 'CONSUMABLE', 'PLANT', 'TOOLS', 'SAFETY', 'SCAFFOLDING', 'SUBCONTRACT', 'OTHER');

-- CreateEnum
CREATE TYPE "AttendanceCardScanStatus" AS ENUM ('MATCHED', 'UNMATCHED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'OFFICE', 'SUPERVISOR', 'FOREMAN');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('NOT_STARTED', 'ONGOING', 'COMPLETED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "TimesheetStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'PAID', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "LabourPlanStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "LabourChangeRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PhotoRequestStatus" AS ENUM ('REQUESTED', 'SUBMITTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PhotoVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'FLAGGED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ScanType" AS ENUM ('REGULAR', 'MANUAL');

-- CreateEnum
CREATE TYPE "ScanDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "OvertimeType" AS ENUM ('NONE', 'HALF_DAY', 'FULL_DAY');

-- CreateEnum
CREATE TYPE "ShiftType" AS ENUM ('DAY', 'NIGHT');

-- CreateEnum
CREATE TYPE "FingerprintEnrollmentStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AttendanceVerificationStatus" AS ENUM ('VERIFIED', 'PENDING_REVIEW', 'REJECTED');

-- CreateEnum
CREATE TYPE "ScanOutMethod" AS ENUM ('PHOTO', 'FINGERPRINT', 'FACE');

-- CreateEnum
CREATE TYPE "FaceEnrollmentStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FaceEnrollmentPose" AS ENUM ('FRONT', 'LEFT', 'RIGHT', 'SMILE', 'NEUTRAL');

-- CreateEnum
CREATE TYPE "AttendanceScanReviewAction" AS ENUM ('MARK_VALID', 'REQUEST_EXPLANATION', 'ADD_SCAN_OUT');

-- CreateEnum
CREATE TYPE "DayAcceptanceStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DeductionType" AS ENUM ('CASH', 'PRODUCT');

-- CreateEnum
CREATE TYPE "DeductionApplyTo" AS ENUM ('CURRENT', 'NEXT');

-- CreateEnum
CREATE TYPE "ProductOrderStatus" AS ENUM ('PENDING', 'COLLECTED', 'DEDUCTED', 'PARTIALLY_APPLIED', 'APPLIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockCategory" AS ENUM ('PPE', 'TOOL');

-- CreateEnum
CREATE TYPE "TeamType" AS ENUM ('PAINTERS', 'BUILDING', 'SPECIAL_COATINGS', 'CAPE_TOWN');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('MATERIAL', 'PPE', 'PLANT', 'CONSUMABLE', 'OTHER');

-- CreateEnum
CREATE TYPE "PlantStatus" AS ENUM ('AVAILABLE', 'DEPLOYED', 'RETURNED', 'REPAIR', 'DAMAGED', 'LOST');

-- CreateEnum
CREATE TYPE "PlantCondition" AS ENUM ('NEW', 'OLD');

-- CreateEnum
CREATE TYPE "PpeOrderStatus" AS ENUM ('PENDING', 'APPROVED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProductUom" AS ENUM ('MM', 'CM', 'M', 'M2', 'M3', 'G', 'KG', 'TON', 'ML', 'L', 'UNIT', 'PIECE', 'PACK', 'BOX', 'BAG', 'BUCKET', 'DRUM', 'CAN', 'BOTTLE', 'TUBE', 'BAR', 'EACH', 'ROLL', 'SHEET', 'BUNDLE', 'PALLET', 'HOUR', 'DAY');

-- CreateEnum
CREATE TYPE "SupplierType" AS ENUM ('BRAND', 'VENDOR');

-- CreateEnum
CREATE TYPE "ColorBaseType" AS ENUM ('DEEP', 'PASTEL', 'WHITE', 'CLEAR', 'NEUTRAL');

-- CreateEnum
CREATE TYPE "FinishingZone" AS ENUM ('INTERNAL', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "FinishingScheduleStatus" AS ENUM ('INITIAL');

-- CreateEnum
CREATE TYPE "FinishingScheduleLogo" AS ENUM ('FIRST_CLASS', 'UNWABU');

-- CreateEnum
CREATE TYPE "SiteClaimStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaintCoverageBasis" AS ENUM ('PER_COAT', 'TOTAL_SYSTEM');

-- CreateEnum
CREATE TYPE "PaintCoverageType" AS ENUM ('THEORETICAL', 'PRACTICAL');

-- CreateEnum
CREATE TYPE "ProductRateMode" AS ENUM ('COVERAGE', 'CONSUMPTION', 'CONTAINER_COVERAGE');

-- CreateEnum
CREATE TYPE "ProductRateUnit" AS ENUM ('M2_PER_L', 'M2_PER_KG', 'L_PER_M2', 'KG_PER_M2', 'M2_PER_CONTAINER');

-- CreateEnum
CREATE TYPE "ProductThicknessUnit" AS ENUM ('MICRON', 'MM');

-- CreateEnum
CREATE TYPE "TdsImportStatus" AS ENUM ('UPLOADED', 'EXTRACTING', 'PARSING', 'NEEDS_REVIEW', 'APPROVED', 'IMPORTED', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('PAINT_50_PERCENT', 'PAINT_90_PERCENT', 'SITE_CREATED', 'SITE_FINISHED', 'TIMESHEET_SUBMITTED', 'TIMESHEET_APPROVED', 'TIMESHEET_REJECTED', 'PHOTO_REQUESTED', 'PHOTO_REJECTED', 'MATERIAL_ORDER', 'GENERAL', 'FINGERPRINT_ENROLLMENT_APPROVED', 'FINGERPRINT_ENROLLMENT_REJECTED', 'ATTENDANCE_EXPLANATION_REQUESTED');

-- CreateEnum
CREATE TYPE "SchedulerTaskCategory" AS ENUM ('MEETING', 'TODO', 'REMINDER', 'EVENT');

-- CreateEnum
CREATE TYPE "SchedulerTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "NoteColor" AS ENUM ('DEFAULT', 'RED', 'ORANGE', 'YELLOW', 'GREEN', 'BLUE', 'PURPLE', 'PINK');

-- CreateEnum
CREATE TYPE "NoteMemberRole" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "NoteInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CapeTownOrderStatus" AS ENUM ('PENDING', 'ORDERED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SiteProgrammeStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SiteProgrammeItemStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'OVERSTAYED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MasterProductUsage" AS ENUM ('Int', 'Ext', 'Int/Ext');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL,
    "password" TEXT NOT NULL,
    "phone" TEXT,
    "isSheRep" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "supplierId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppRelease" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'android',
    "version" TEXT NOT NULL,
    "versionCode" INTEGER NOT NULL,
    "minVersionCode" INTEGER NOT NULL,
    "githubAssetId" INTEGER NOT NULL,
    "releaseNotes" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppRelease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "qrCodeValue" TEXT NOT NULL,
    "idNumber" TEXT,
    "phone" TEXT,
    "defaultDayRate" DECIMAL(12,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "faceImageUrl" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supervisor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supervisor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Foreman" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "defaultDayRate" DECIMAL(12,2),
    "bankName" TEXT,
    "defaultTeam" TEXT NOT NULL DEFAULT 'PAINTERS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Foreman_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForemanAssistant" (
    "foremanId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForemanAssistant_pkey" PRIMARY KEY ("foremanId","employeeId")
);

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

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "client" TEXT,
    "location" TEXT,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "jobStatus" "JobStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "stageIndex" INTEGER NOT NULL DEFAULT 0,
    "stagePct" JSONB NOT NULL DEFAULT '{}',
    "specStatus" "SpecStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "specAvailable" BOOLEAN NOT NULL DEFAULT false,
    "finishingScheduleDone" BOOLEAN NOT NULL DEFAULT false,
    "manualAttendanceRequiresSupervisorFingerprint" BOOLEAN NOT NULL DEFAULT false,
    "amountClaimed" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "siteClaimDate" TIMESTAMP(3),

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteDocument" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "documentType" TEXT NOT NULL DEFAULT 'OTHER',
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "cloudinaryPublicId" TEXT,
    "cloudinaryResourceType" TEXT,
    "uploadedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricalSiteCost" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "source" "HistoricalCostSource" NOT NULL DEFAULT 'BUILDSMART',
    "category" "HistoricalCostCategory" NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "externalRef" TEXT,
    "batchRef" TEXT,
    "ledgerCode" TEXT,
    "description" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricalSiteCost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupervisorSiteAssignment" (
    "id" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "team" VARCHAR(50),

    CONSTRAINT "SupervisorSiteAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeDayRateOverride" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "siteId" TEXT,
    "startsOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3),
    "dayRate" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeDayRateOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteForemanDayRateOverride" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "foremanId" TEXT NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3),
    "dayRate" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteForemanDayRateOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForemanSiteAssignment" (
    "id" TEXT NOT NULL,
    "foremanId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForemanSiteAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminSiteAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminSiteAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteDay" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "foremanId" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "readyToSubmit" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceScan" (
    "id" TEXT NOT NULL,
    "siteDayId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "siteId" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dayRateAtScan" DECIMAL(12,2) NOT NULL,
    "team" TEXT,
    "qrPayload" TEXT,
    "addedByForemanId" TEXT,
    "manualReason" TEXT,
    "overtimeType" "OvertimeType" NOT NULL DEFAULT 'NONE',
    "scanType" "ScanType" NOT NULL DEFAULT 'REGULAR',
    "shiftType" "ShiftType" NOT NULL DEFAULT 'DAY',
    "direction" "ScanDirection" NOT NULL DEFAULT 'IN',
    "scannedOutAt" TIMESTAMP(3),
    "scanOutPhotoId" TEXT,
    "scanOutMethod" "ScanOutMethod",
    "scanOutFingerprintMatchScore" DOUBLE PRECISION,
    "verificationStatus" "AttendanceVerificationStatus",
    "scanOutFaceMatchScore" DOUBLE PRECISION,
    "scanOutDevice" TEXT,
    "supervisorAuthByUserId" TEXT,
    "supervisorAuthAt" TIMESTAMP(3),
    "supervisorAuthDevice" TEXT,
    "supervisorAuthMatchScore" DOUBLE PRECISION,
    "transferredFromSiteId" TEXT,
    "transferredFromScanId" TEXT,
    "transferredAt" TIMESTAMP(3),
    "transferredByUserId" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "address" TEXT,
    "hasEarlySignOut" BOOLEAN NOT NULL DEFAULT false,
    "earlySignOutAt" TIMESTAMP(3),
    "earlySignOutReasonId" TEXT,
    "earlySignOutReasonLabel" TEXT,
    "earlySignOutNote" TEXT,
    "earlySignOutCapturedByUserId" TEXT,

    CONSTRAINT "AttendanceScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FingerprintEnrollment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "rightThumbTemplate" BYTEA,
    "leftThumbTemplate" BYTEA,
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

-- CreateTable
CREATE TABLE "AttendanceScanReview" (
    "id" TEXT NOT NULL,
    "attendanceScanId" TEXT NOT NULL,
    "action" "AttendanceScanReviewAction" NOT NULL,
    "note" TEXT,
    "byUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceScanReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceCardScan" (
    "id" TEXT NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "status" "AttendanceCardScanStatus" NOT NULL DEFAULT 'UNMATCHED',
    "employeeId" TEXT,
    "rawName" TEXT,
    "scanTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "siteId" TEXT,

    CONSTRAINT "AttendanceCardScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrashItem" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "deletedByUserId" TEXT,
    "deletedByName" TEXT,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrashItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteDayPhotoRequest" (
    "id" TEXT NOT NULL,
    "siteDayId" TEXT NOT NULL,
    "status" "PhotoRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),
    "requestedByUserId" TEXT,
    "note" TEXT,

    CONSTRAINT "SiteDayPhotoRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteDayPhoto" (
    "id" TEXT NOT NULL,
    "siteDayId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "capturedAt" TIMESTAMP(3),
    "uploadedByUserId" TEXT,
    "requestId" TEXT,
    "cloudinaryPublicId" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "address" TEXT,

    CONSTRAINT "SiteDayPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteDayPhotoUploadLog" (
    "id" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "actingForemanId" TEXT,
    "siteDayId" TEXT,
    "cloudinaryPublicId" TEXT,
    "imageUrl" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "format" TEXT,
    "errorText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteDayPhotoUploadLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoVerification" (
    "id" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "status" "PhotoVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedByUserId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "notes" TEXT,
    "bookedCount" INTEGER,
    "detectedCount" INTEGER,
    "missingCount" INTEGER,
    "suspectedImpersonations" INTEGER,

    CONSTRAINT "PhotoVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoDetection" (
    "id" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "employeeId" TEXT,
    "data" JSONB,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoDetection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimesheetPeriod" (
    "id" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimesheetPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Timesheet" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "foremanId" TEXT NOT NULL,
    "siteId" TEXT,
    "status" "TimesheetStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "approvedBySupervisorId" TEXT,
    "rejectionReason" TEXT,
    "totalWorkerWages" DECIMAL(14,2),
    "totalWorkerDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Timesheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimesheetDayAcceptance" (
    "id" TEXT NOT NULL,
    "timesheetId" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "status" "DayAcceptanceStatus" NOT NULL DEFAULT 'PENDING',
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "acceptedBySupervisorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimesheetDayAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT,
    "sku" TEXT,
    "description" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "category" "StockCategory" NOT NULL DEFAULT 'PPE',
    "sizes" TEXT[],
    "colors" TEXT[],
    "stockQty" INTEGER NOT NULL DEFAULT 0,
    "thumbnailUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockItemVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "size" TEXT,
    "color" TEXT,
    "qty" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StockItemVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockReceipt" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "vendorName" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockReceiptItem" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" TEXT,

    CONSTRAINT "StockReceiptItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deduction" (
    "id" TEXT NOT NULL,
    "type" "DeductionType" NOT NULL,
    "applyTo" "DeductionApplyTo" NOT NULL DEFAULT 'CURRENT',
    "employeeId" TEXT NOT NULL,
    "foremanId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "timesheetId" TEXT,
    "productId" TEXT,
    "quantity" INTEGER,
    "orderItemId" TEXT,
    "siteId" TEXT,
    "amount" DECIMAL(12,2),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductOrder" (
    "id" TEXT NOT NULL,
    "reference" TEXT,
    "foremanId" TEXT,
    "adminUserId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "status" "ProductOrderStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "size" TEXT,
    "color" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "CompanySettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "defaultEmployeeDayRate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "defaultPainterDayRate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "defaultBuildingDayRate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "defaultSpecialCoatingsDayRate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "defaultCapeTownDayRate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "fingerprintMandatory" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyTeamRate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dayRate" DECIMAL(12,2) NOT NULL DEFAULT 250,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyTeamRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimesheetYear" (
    "year" INTEGER NOT NULL,
    "anchorSat" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimesheetYear_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "supplierType" "SupplierType" NOT NULL DEFAULT 'VENDOR',
    "parentSupplierId" TEXT,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcurementProduct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "thumbnailUrl" TEXT,
    "categoryId" TEXT,
    "productType" "ProductType" NOT NULL DEFAULT 'MATERIAL',
    "isReturnable" BOOLEAN NOT NULL DEFAULT false,
    "colors" TEXT[],
    "sizes" TEXT[],
    "stockQty" INTEGER NOT NULL DEFAULT 0,
    "uom" "ProductUom",
    "unitSize" DECIMAL(12,3),
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeductible" BOOLEAN NOT NULL DEFAULT true,
    "deductionSplits" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "supplierId" TEXT,
    "masterCatalogueProductId" TEXT,
    "normalizedName" TEXT,

    CONSTRAINT "ProcurementProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductColorVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "colorName" TEXT NOT NULL,
    "colorCode" TEXT,
    "baseType" "ColorBaseType" NOT NULL DEFAULT 'DEEP',
    "isTinted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductColorVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitePaintColor" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "productId" TEXT,
    "colorVariantId" TEXT,
    "supplierId" TEXT,
    "sourceOrderId" TEXT,
    "sourceOrderItemId" TEXT,
    "orderReference" TEXT,
    "sourceFile" TEXT,
    "rawDescription" TEXT,
    "productSnapshot" TEXT,
    "supplierSnapshot" TEXT,
    "colorName" TEXT NOT NULL,
    "colorCode" TEXT,
    "baseType" "ColorBaseType" NOT NULL DEFAULT 'NEUTRAL',
    "isTinted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SitePaintColor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariantStock" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "size" TEXT,
    "color" TEXT,
    "condition" "PlantCondition" NOT NULL DEFAULT 'OLD',
    "qty" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductVariantStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierProductPrice" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "colorVariantId" TEXT,
    "uom" "ProductUom",
    "unitSize" DECIMAL(12,3),
    "price" DECIMAL(12,2) NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsOn" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierProductPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteProductOrder" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "supplierId" TEXT,
    "createdByUserId" TEXT,
    "foremanId" TEXT,
    "foremanName" TEXT,
    "reference" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "totalCost" DECIMAL(14,2),

    CONSTRAINT "SiteProductOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteProductOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceAtOrder" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "uomAtOrder" "ProductUom",
    "unitSizeAtOrder" DECIMAL(12,3),
    "note" TEXT,
    "rawDescription" TEXT,
    "costCodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteProductOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FortnightMeeting" (
    "id" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "meetingOn" TIMESTAMP(3) NOT NULL,
    "periodId" TEXT,
    "createdByUserId" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizedAt" TIMESTAMP(3),
    "finalizedByUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FortnightMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FortnightMeetingRow" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "materialCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "wagesCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "overtimeCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "projectCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "revenueClaimed" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "revenueReceived" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "profitOrLoss" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "materialPct" DECIMAL(8,2),
    "wagesPct" DECIMAL(8,2),
    "profitPct" DECIMAL(8,2),
    "prevProjectCost" DECIMAL(14,2),
    "prevWagesCost" DECIMAL(14,2),
    "prevMaterialCost" DECIMAL(14,2),
    "projectCostDeltaPct" DECIMAL(8,2),
    "wagesCostDeltaPct" DECIMAL(8,2),
    "materialCostDeltaPct" DECIMAL(8,2),

    CONSTRAINT "FortnightMeetingRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OvertimePrice" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OvertimePrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OvertimeEntry" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "foremanId" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "overtimePriceId" TEXT NOT NULL,
    "rateAtCreation" DECIMAL(12,2) NOT NULL,
    "numberOfEmployees" INTEGER NOT NULL,
    "hoursWorked" DECIMAL(6,2) NOT NULL,
    "totalCost" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "paidAt" TIMESTAMP(3),
    "paidByUserId" TEXT,
    "costCodeId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OvertimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FortnightMeetingTotals" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "totalMaterialCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalWagesCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalOvertimeCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalProjectCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalRevenueClaimed" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalRevenueReceived" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalProfitOrLoss" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "FortnightMeetingTotals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "description" TEXT,
    "categoryId" TEXT,
    "productType" "ProductType" NOT NULL DEFAULT 'MATERIAL',
    "isReturnable" BOOLEAN NOT NULL DEFAULT false,
    "colors" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeductible" BOOLEAN NOT NULL DEFAULT true,
    "deductionSplits" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "supplierId" TEXT,
    "procurementProductId" TEXT,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialPrice" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "baseId" TEXT,
    "colorVariantId" TEXT,
    "uom" "ProductUom",
    "unitSize" DECIMAL(12,3),
    "price" DECIMAL(12,2) NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourcePdf" TEXT,
    "barcode" TEXT,
    "sku" TEXT,
    "startsOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsOn" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialBase" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialBase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialColorVariant" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "baseId" TEXT,
    "colorName" TEXT NOT NULL,
    "colorCode" TEXT,
    "baseType" "ColorBaseType" NOT NULL DEFAULT 'DEEP',
    "isTinted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialColorVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialPriceHistory" (
    "id" TEXT NOT NULL,
    "materialPriceId" TEXT,
    "supplierId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "baseId" TEXT,
    "colorVariantId" TEXT,
    "unitSize" DECIMAL(12,3),
    "uom" "ProductUom",
    "oldPrice" DECIMAL(12,2),
    "newPrice" DECIMAL(12,2) NOT NULL,
    "sourcePdf" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialPriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteMaterial" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "materialId" TEXT,
    "quantity" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteMaterialUsage" (
    "id" TEXT NOT NULL,
    "siteMaterialId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "quantity" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteMaterialUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinishingVariant" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "normalizedLabel" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinishingVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteFinishingSchedule" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "siteAddress" TEXT,
    "contractNo" TEXT,
    "contractManager" TEXT,
    "siteForeman" TEXT,
    "fcpContractManager" TEXT,
    "fcpQs" TEXT,
    "fcpSiteForeman" TEXT,
    "client" TEXT,
    "startDate" TIMESTAMP(3),
    "completionDate" TIMESTAMP(3),
    "drawingDetails" TEXT,
    "contactInfo" TEXT,
    "logoKey" "FinishingScheduleLogo" NOT NULL DEFAULT 'FIRST_CLASS',
    "status" "FinishingScheduleStatus" NOT NULL DEFAULT 'INITIAL',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "supersededById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteFinishingSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteFinishingScheduleArea" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteFinishingScheduleArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteFinishingScheduleItem" (
    "id" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "zone" "FinishingZone" NOT NULL,
    "position" TEXT NOT NULL DEFAULT '',
    "finishingVariantId" TEXT,
    "variantLabelSnapshot" TEXT,
    "siteMaterialId" TEXT,
    "product" TEXT,
    "colorCode" TEXT,
    "supplier" TEXT,
    "procurementProductId" TEXT,
    "supplierId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteFinishingScheduleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EarlySignOutReason" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "normalizedLabel" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "requiresNote" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EarlySignOutReason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteCostCode" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteCostCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteClaim" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "claimNo" TEXT,
    "claimDate" TIMESTAMP(3) NOT NULL,
    "siteClaimDate" TIMESTAMP(3),
    "description" TEXT,
    "amountClaimed" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "amountReceived" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "SiteClaimStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcurementProductCoverage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "applicationMethod" TEXT,
    "applicationMethods" JSONB,
    "rateMode" "ProductRateMode" NOT NULL DEFAULT 'COVERAGE',
    "rateUnit" "ProductRateUnit" NOT NULL DEFAULT 'M2_PER_L',
    "rateMin" DECIMAL(12,3),
    "rateMax" DECIMAL(12,3),
    "coverageType" "PaintCoverageType",
    "coverageM2" DECIMAL(12,2),
    "coverageM2PerLitre" DECIMAL(12,3),
    "coverageBasis" "PaintCoverageBasis",
    "recommendedCoats" INTEGER,
    "recommendedCoatsMin" INTEGER,
    "recommendedCoatsMax" INTEGER,
    "thicknessMin" DECIMAL(12,3),
    "thicknessMax" DECIMAL(12,3),
    "thicknessUnit" "ProductThicknessUnit",
    "preferredPackSizeId" TEXT,
    "uom" "ProductUom",
    "unitSize" DECIMAL(12,3),
    "recommendedDftMicrons" DECIMAL(12,2),
    "recommendedWftMicrons" DECIMAL(12,2),
    "sourceDocument" TEXT,
    "sourceRevision" TEXT,
    "sourceRevisionDate" TIMESTAMP(3),
    "sourcePage" INTEGER,
    "manufacturerRateLabel" TEXT,
    "sourceSnippet" TEXT,
    "note" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcurementProductCoverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcurementProductPackSize" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "uom" "ProductUom" NOT NULL,
    "label" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcurementProductPackSize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcurementProductCoverageStep" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "rateMin" DECIMAL(12,3),
    "rateMax" DECIMAL(12,3),
    "rateUnit" "ProductRateUnit",
    "wetFilmThicknessMicrons" DECIMAL(12,3),
    "dryFilmThicknessMicrons" DECIMAL(12,3),
    "applicationMethod" TEXT,
    "note" TEXT,

    CONSTRAINT "ProcurementProductCoverageStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "error" TEXT,
    "resultJson" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitePaintPlan" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "boqReference" TEXT,
    "description" TEXT NOT NULL,
    "areaM2" DECIMAL(12,2) NOT NULL,
    "productId" TEXT NOT NULL,
    "coverageId" TEXT,
    "coats" INTEGER NOT NULL DEFAULT 1,
    "coverageNameSnapshot" TEXT,
    "coverageM2PerLitreSnapshot" DECIMAL(12,3) NOT NULL,
    "coverageBasisSnapshot" "PaintCoverageBasis" NOT NULL DEFAULT 'PER_COAT',
    "containerSizeLitresSnapshot" DECIMAL(12,3) NOT NULL,
    "wastagePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "requiredLitresBeforeWastage" DECIMAL(12,2) NOT NULL,
    "wastageLitres" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "requiredLitres" DECIMAL(12,2) NOT NULL,
    "requiredContainers" DECIMAL(12,2) NOT NULL,
    "roundedContainers" INTEGER NOT NULL,
    "estimatedCost" DECIMAL(14,2),
    "note" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SitePaintPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabourPlan" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "LabourPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "submittedByUserId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "cancelledByUserId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "completedByUserId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabourPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabourPlanTeam" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "teamCode" TEXT NOT NULL,
    "teamNameSnapshot" TEXT NOT NULL,
    "foremanId" TEXT NOT NULL,
    "suggestedSupervisorId" TEXT,
    "overrideSupervisorId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabourPlanTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabourPlanDay" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "peopleCount" INTEGER NOT NULL,
    "expectedOvertime" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabourPlanDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabourPlanApprovalSnapshot" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "plannedCost" DECIMAL(14,2) NOT NULL,
    "rateBreakdown" JSONB NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabourPlanApprovalSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabourChangeRequest" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "peopleDelta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "status" "LabourChangeRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedByUserId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabourChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaintTdsImport" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT,
    "status" "TdsImportStatus" NOT NULL DEFAULT 'UPLOADED',
    "extractedText" TEXT,
    "parsedJson" JSONB,
    "warnings" JSONB,
    "productCodeDetected" TEXT,
    "productNameDetected" TEXT,
    "manufacturerDetected" TEXT,
    "descriptionDetected" TEXT,
    "revisionDetected" TEXT,
    "revisionDateDetected" TIMESTAMP(3),
    "packSizesLitres" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "packSizes" JSONB,
    "errorMessage" TEXT,
    "uploadedByUserId" TEXT,
    "supplierId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaintTdsImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaintTdsImportProfile" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "applicationMethod" TEXT,
    "applicationMethods" JSONB,
    "rateMode" "ProductRateMode",
    "rateUnit" "ProductRateUnit",
    "rateMin" DECIMAL(12,3),
    "rateMax" DECIMAL(12,3),
    "coverageM2PerLitre" DECIMAL(12,3),
    "coverageBasis" "PaintCoverageBasis",
    "coverageType" "PaintCoverageType",
    "recommendedCoats" INTEGER,
    "recommendedCoatsMin" INTEGER,
    "recommendedCoatsMax" INTEGER,
    "recommendedDftMicrons" DECIMAL(12,2),
    "recommendedWftMicrons" DECIMAL(12,2),
    "thicknessMin" DECIMAL(12,3),
    "thicknessMax" DECIMAL(12,3),
    "thicknessUnit" "ProductThicknessUnit",
    "sourcePage" INTEGER,
    "manufacturerRateLabel" TEXT,
    "sourceSnippet" TEXT,
    "note" TEXT,
    "confidence" DECIMAL(5,4),
    "isSelected" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaintTdsImportProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitePaintUsage" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "usedLitres" DECIMAL(12,2),
    "usedContainers" DECIMAL(12,2),
    "note" TEXT,
    "usedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SitePaintUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "siteId" TEXT,
    "linkUrl" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchedulerTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "SchedulerTaskCategory" NOT NULL DEFAULT 'TODO',
    "priority" "SchedulerTaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "time" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "column" TEXT NOT NULL DEFAULT 'todo',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulerTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "color" "NoteColor" NOT NULL DEFAULT 'DEFAULT',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isRoomNote" BOOLEAN NOT NULL DEFAULT false,
    "background" TEXT NOT NULL DEFAULT 'note-bg',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteMember" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "NoteMemberRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoteMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteInvite" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "invitedUserId" TEXT NOT NULL,
    "role" "NoteMemberRole" NOT NULL DEFAULT 'VIEWER',
    "status" "NoteInviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),

    CONSTRAINT "NoteInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteAttachment" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "mimeType" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteComment" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoteComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteProgressNote" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteProgressNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitePlantAssignment" (
    "id" TEXT NOT NULL,
    "reference" TEXT,
    "siteId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" "PlantStatus" NOT NULL DEFAULT 'DEPLOYED',
    "deployedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedOn" TIMESTAMP(3),
    "note" TEXT,
    "supervisorName" TEXT,
    "unitPrice" DECIMAL(12,2),
    "chargeToSite" BOOLEAN NOT NULL DEFAULT false,
    "chargeQuantity" INTEGER,
    "assignedByUserId" TEXT,
    "transferredFromSiteId" TEXT,
    "transferredFromAssignmentId" TEXT,
    "size" TEXT,
    "condition" "PlantCondition" NOT NULL DEFAULT 'OLD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SitePlantAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlantTransfer" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "fromSiteId" TEXT,
    "toSiteId" TEXT,
    "fromAssignmentId" TEXT,
    "toAssignmentId" TEXT,
    "note" TEXT,
    "transferredByUserId" TEXT,
    "transferredOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlantTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForemanPpeOrder" (
    "id" TEXT NOT NULL,
    "foremanId" TEXT NOT NULL,
    "siteId" TEXT,
    "status" "PpeOrderStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "chargeToSite" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForemanPpeOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForemanPpeOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "size" TEXT,
    "color" TEXT,
    "note" TEXT,
    "unitPriceAtOrder" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForemanPpeOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentHolder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentHolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentItem" (
    "id" TEXT NOT NULL,
    "holderId" TEXT,
    "category" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "condition" TEXT NOT NULL,
    "notes" TEXT,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapeTownStockItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "StockCategory" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "unit" TEXT,
    "notes" TEXT,
    "sizes" TEXT[],
    "colors" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapeTownStockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapeTownStockVariant" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "size" TEXT,
    "color" TEXT,
    "qty" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CapeTownStockVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapeTownDeployment" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "size" TEXT,
    "color" TEXT,
    "deployedTo" TEXT NOT NULL,
    "notes" TEXT,
    "deployedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapeTownDeployment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapeTownStockOrder" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "size" TEXT,
    "color" TEXT,
    "supplier" TEXT,
    "status" "CapeTownOrderStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "orderedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapeTownStockOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotePresence" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cursorPosition" INTEGER,
    "cursorLine" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isTyping" BOOLEAN NOT NULL DEFAULT false,
    "isEditing" BOOLEAN NOT NULL DEFAULT false,
    "lastActivityAt" TIMESTAMP(3) NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotePresence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteEditHistory" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "previousContent" TEXT NOT NULL,
    "newContent" TEXT NOT NULL,
    "changeType" TEXT NOT NULL DEFAULT 'text',
    "operation" TEXT NOT NULL DEFAULT 'update',
    "startPosition" INTEGER,
    "endPosition" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteEditHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteProgramme" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "plannedStartDate" TIMESTAMP(3) NOT NULL,
    "plannedFinishDate" TIMESTAMP(3) NOT NULL,
    "status" "SiteProgrammeStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteProgramme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteProgrammeItem" (
    "id" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "trade" TEXT,
    "description" TEXT,
    "plannedStartDate" TIMESTAMP(3) NOT NULL,
    "plannedFinishDate" TIMESTAMP(3) NOT NULL,
    "actualStartDate" TIMESTAMP(3),
    "actualFinishDate" TIMESTAMP(3),
    "status" "SiteProgrammeItemStatus" NOT NULL DEFAULT 'PLANNED',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteProgrammeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterCatalogueProduct" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'Paints',
    "categoryId" TEXT,
    "sku" TEXT,
    "thumbnailUrl" TEXT,
    "productType" "ProductType" NOT NULL DEFAULT 'MATERIAL',
    "isReturnable" BOOLEAN NOT NULL DEFAULT false,
    "colors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sizes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "stockQty" INTEGER NOT NULL DEFAULT 0,
    "uom" "ProductUom",
    "unitSize" DECIMAL(12,3),
    "isDeductible" BOOLEAN NOT NULL DEFAULT true,
    "deductionSplits" INTEGER NOT NULL DEFAULT 1,
    "usage" "MasterProductUsage" NOT NULL DEFAULT 'Int/Ext',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterCatalogueProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterProductFinish" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterProductFinish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterProductBase" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterProductBase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterProductPrice" (
    "id" TEXT NOT NULL,
    "lookupKey" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "finishId" TEXT,
    "baseId" TEXT NOT NULL,
    "unitSize" DECIMAL(12,3) NOT NULL,
    "uom" "ProductUom" NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "sourceFile" TEXT,
    "sourceRow" INTEGER,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterProductPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_supplierId_idx" ON "User"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "PushToken_token_key" ON "PushToken"("token");

-- CreateIndex
CREATE INDEX "PushToken_userId_idx" ON "PushToken"("userId");

-- CreateIndex
CREATE INDEX "AppRelease_platform_isActive_idx" ON "AppRelease"("platform", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_qrCodeValue_key" ON "Employee"("qrCodeValue");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");

-- CreateIndex
CREATE INDEX "Employee_isActive_idx" ON "Employee"("isActive");

-- CreateIndex
CREATE INDEX "Employee_lastName_firstName_idx" ON "Employee"("lastName", "firstName");

-- CreateIndex
CREATE UNIQUE INDEX "Supervisor_userId_key" ON "Supervisor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Foreman_userId_key" ON "Foreman"("userId");

-- CreateIndex
CREATE INDEX "ForemanAssistant_employeeId_idx" ON "ForemanAssistant"("employeeId");

-- CreateIndex
CREATE INDEX "ForemanEmployee_employeeId_idx" ON "ForemanEmployee"("employeeId");

-- CreateIndex
CREATE INDEX "SupervisorForeman_supervisorId_idx" ON "SupervisorForeman"("supervisorId");

-- CreateIndex
CREATE INDEX "SupervisorForeman_foremanId_idx" ON "SupervisorForeman"("foremanId");

-- CreateIndex
CREATE UNIQUE INDEX "Site_code_key" ON "Site"("code");

-- CreateIndex
CREATE INDEX "Site_isActive_idx" ON "Site"("isActive");

-- CreateIndex
CREATE INDEX "Site_name_idx" ON "Site"("name");

-- CreateIndex
CREATE INDEX "SiteDocument_siteId_createdAt_idx" ON "SiteDocument"("siteId", "createdAt");

-- CreateIndex
CREATE INDEX "SiteDocument_documentType_idx" ON "SiteDocument"("documentType");

-- CreateIndex
CREATE INDEX "SiteDocument_uploadedByUserId_idx" ON "SiteDocument"("uploadedByUserId");

-- CreateIndex
CREATE INDEX "HistoricalSiteCost_siteId_transactionDate_idx" ON "HistoricalSiteCost"("siteId", "transactionDate");

-- CreateIndex
CREATE INDEX "HistoricalSiteCost_category_idx" ON "HistoricalSiteCost"("category");

-- CreateIndex
CREATE INDEX "HistoricalSiteCost_externalRef_idx" ON "HistoricalSiteCost"("externalRef");

-- CreateIndex
CREATE UNIQUE INDEX "HistoricalSiteCost_siteId_source_externalRef_ledgerCode_key" ON "HistoricalSiteCost"("siteId", "source", "externalRef", "ledgerCode");

-- CreateIndex
CREATE INDEX "SupervisorSiteAssignment_supervisorId_idx" ON "SupervisorSiteAssignment"("supervisorId");

-- CreateIndex
CREATE INDEX "SupervisorSiteAssignment_siteId_idx" ON "SupervisorSiteAssignment"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "SupervisorSiteAssignment_supervisorId_siteId_startsOn_key" ON "SupervisorSiteAssignment"("supervisorId", "siteId", "startsOn");

-- CreateIndex
CREATE INDEX "EmployeeDayRateOverride_employeeId_startsOn_idx" ON "EmployeeDayRateOverride"("employeeId", "startsOn");

-- CreateIndex
CREATE INDEX "EmployeeDayRateOverride_siteId_startsOn_idx" ON "EmployeeDayRateOverride"("siteId", "startsOn");

-- CreateIndex
CREATE INDEX "SiteForemanDayRateOverride_siteId_idx" ON "SiteForemanDayRateOverride"("siteId");

-- CreateIndex
CREATE INDEX "SiteForemanDayRateOverride_foremanId_idx" ON "SiteForemanDayRateOverride"("foremanId");

-- CreateIndex
CREATE INDEX "SiteForemanDayRateOverride_siteId_foremanId_startsOn_idx" ON "SiteForemanDayRateOverride"("siteId", "foremanId", "startsOn");

-- CreateIndex
CREATE INDEX "ForemanSiteAssignment_foremanId_idx" ON "ForemanSiteAssignment"("foremanId");

-- CreateIndex
CREATE INDEX "ForemanSiteAssignment_siteId_idx" ON "ForemanSiteAssignment"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "ForemanSiteAssignment_foremanId_siteId_startsOn_key" ON "ForemanSiteAssignment"("foremanId", "siteId", "startsOn");

-- CreateIndex
CREATE INDEX "AdminSiteAssignment_userId_idx" ON "AdminSiteAssignment"("userId");

-- CreateIndex
CREATE INDEX "AdminSiteAssignment_siteId_idx" ON "AdminSiteAssignment"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSiteAssignment_userId_siteId_startsOn_key" ON "AdminSiteAssignment"("userId", "siteId", "startsOn");

-- CreateIndex
CREATE INDEX "SiteDay_foremanId_workDate_idx" ON "SiteDay"("foremanId", "workDate");

-- CreateIndex
CREATE INDEX "SiteDay_siteId_workDate_idx" ON "SiteDay"("siteId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "SiteDay_siteId_foremanId_workDate_key" ON "SiteDay"("siteId", "foremanId", "workDate");

-- CreateIndex
CREATE INDEX "AttendanceScan_siteId_workDate_idx" ON "AttendanceScan"("siteId", "workDate");

-- CreateIndex
CREATE INDEX "AttendanceScan_siteDayId_idx" ON "AttendanceScan"("siteDayId");

-- CreateIndex
CREATE INDEX "AttendanceScan_scannedAt_idx" ON "AttendanceScan"("scannedAt");

-- CreateIndex
CREATE INDEX "AttendanceScan_scanType_idx" ON "AttendanceScan"("scanType");

-- CreateIndex
CREATE INDEX "AttendanceScan_direction_idx" ON "AttendanceScan"("direction");

-- CreateIndex
CREATE INDEX "AttendanceScan_team_idx" ON "AttendanceScan"("team");

-- CreateIndex
CREATE INDEX "AttendanceScan_shiftType_idx" ON "AttendanceScan"("shiftType");

-- CreateIndex
CREATE INDEX "AttendanceScan_hasEarlySignOut_idx" ON "AttendanceScan"("hasEarlySignOut");

-- CreateIndex
CREATE INDEX "AttendanceScan_earlySignOutReasonId_idx" ON "AttendanceScan"("earlySignOutReasonId");

-- CreateIndex
CREATE INDEX "AttendanceScan_earlySignOutCapturedByUserId_idx" ON "AttendanceScan"("earlySignOutCapturedByUserId");

-- CreateIndex
CREATE INDEX "AttendanceScan_verificationStatus_idx" ON "AttendanceScan"("verificationStatus");

-- CreateIndex
CREATE INDEX "AttendanceScan_scanOutMethod_idx" ON "AttendanceScan"("scanOutMethod");

-- CreateIndex
CREATE INDEX "AttendanceScan_supervisorAuthByUserId_idx" ON "AttendanceScan"("supervisorAuthByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceScan_employeeId_workDate_shiftType_key" ON "AttendanceScan"("employeeId", "workDate", "shiftType");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceScan_siteDayId_employeeId_shiftType_key" ON "AttendanceScan"("siteDayId", "employeeId", "shiftType");

-- CreateIndex
CREATE UNIQUE INDEX "FingerprintEnrollment_employeeId_key" ON "FingerprintEnrollment"("employeeId");

-- CreateIndex
CREATE INDEX "FingerprintEnrollment_status_idx" ON "FingerprintEnrollment"("status");

-- CreateIndex
CREATE INDEX "FingerprintEnrollment_enrolledByForemanId_idx" ON "FingerprintEnrollment"("enrolledByForemanId");

-- CreateIndex
CREATE INDEX "FingerprintEnrollment_approvedByUserId_idx" ON "FingerprintEnrollment"("approvedByUserId");

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

-- CreateIndex
CREATE INDEX "AttendanceScanReview_attendanceScanId_idx" ON "AttendanceScanReview"("attendanceScanId");

-- CreateIndex
CREATE INDEX "AttendanceScanReview_byUserId_idx" ON "AttendanceScanReview"("byUserId");

-- CreateIndex
CREATE INDEX "AttendanceCardScan_cardNumber_idx" ON "AttendanceCardScan"("cardNumber");

-- CreateIndex
CREATE INDEX "AttendanceCardScan_status_idx" ON "AttendanceCardScan"("status");

-- CreateIndex
CREATE INDEX "AttendanceCardScan_employeeId_idx" ON "AttendanceCardScan"("employeeId");

-- CreateIndex
CREATE INDEX "AttendanceCardScan_siteId_idx" ON "AttendanceCardScan"("siteId");

-- CreateIndex
CREATE INDEX "AttendanceCardScan_scanTime_idx" ON "AttendanceCardScan"("scanTime");

-- CreateIndex
CREATE INDEX "TrashItem_entityType_idx" ON "TrashItem"("entityType");

-- CreateIndex
CREATE INDEX "TrashItem_deletedAt_idx" ON "TrashItem"("deletedAt");

-- CreateIndex
CREATE INDEX "TrashItem_expiresAt_idx" ON "TrashItem"("expiresAt");

-- CreateIndex
CREATE INDEX "SiteDayPhotoRequest_siteDayId_status_idx" ON "SiteDayPhotoRequest"("siteDayId", "status");

-- CreateIndex
CREATE INDEX "SiteDayPhotoRequest_requestedAt_idx" ON "SiteDayPhotoRequest"("requestedAt");

-- CreateIndex
CREATE INDEX "SiteDayPhoto_siteDayId_uploadedAt_idx" ON "SiteDayPhoto"("siteDayId", "uploadedAt");

-- CreateIndex
CREATE INDEX "SiteDayPhoto_requestId_idx" ON "SiteDayPhoto"("requestId");

-- CreateIndex
CREATE INDEX "SiteDayPhotoUploadLog_ts_idx" ON "SiteDayPhotoUploadLog"("ts");

-- CreateIndex
CREATE INDEX "SiteDayPhotoUploadLog_siteDayId_idx" ON "SiteDayPhotoUploadLog"("siteDayId");

-- CreateIndex
CREATE INDEX "SiteDayPhotoUploadLog_userId_idx" ON "SiteDayPhotoUploadLog"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PhotoVerification_photoId_key" ON "PhotoVerification"("photoId");

-- CreateIndex
CREATE INDEX "PhotoVerification_status_idx" ON "PhotoVerification"("status");

-- CreateIndex
CREATE INDEX "PhotoVerification_verifiedAt_idx" ON "PhotoVerification"("verifiedAt");

-- CreateIndex
CREATE INDEX "PhotoDetection_photoId_idx" ON "PhotoDetection"("photoId");

-- CreateIndex
CREATE INDEX "PhotoDetection_employeeId_idx" ON "PhotoDetection"("employeeId");

-- CreateIndex
CREATE INDEX "TimesheetPeriod_startDate_idx" ON "TimesheetPeriod"("startDate");

-- CreateIndex
CREATE INDEX "TimesheetPeriod_endDate_idx" ON "TimesheetPeriod"("endDate");

-- CreateIndex
CREATE UNIQUE INDEX "TimesheetPeriod_startDate_endDate_key" ON "TimesheetPeriod"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "Timesheet_status_idx" ON "Timesheet"("status");

-- CreateIndex
CREATE INDEX "Timesheet_foremanId_periodId_idx" ON "Timesheet"("foremanId", "periodId");

-- CreateIndex
CREATE INDEX "Timesheet_approvedBySupervisorId_idx" ON "Timesheet"("approvedBySupervisorId");

-- CreateIndex
CREATE INDEX "Timesheet_siteId_idx" ON "Timesheet"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "Timesheet_periodId_foremanId_siteId_key" ON "Timesheet"("periodId", "foremanId", "siteId");

-- CreateIndex
CREATE INDEX "TimesheetDayAcceptance_timesheetId_idx" ON "TimesheetDayAcceptance"("timesheetId");

-- CreateIndex
CREATE INDEX "TimesheetDayAcceptance_workDate_idx" ON "TimesheetDayAcceptance"("workDate");

-- CreateIndex
CREATE UNIQUE INDEX "TimesheetDayAcceptance_timesheetId_workDate_key" ON "TimesheetDayAcceptance"("timesheetId", "workDate");

-- CreateIndex
CREATE INDEX "Product_isActive_idx" ON "Product"("isActive");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE INDEX "Product_normalizedName_idx" ON "Product"("normalizedName");

-- CreateIndex
CREATE INDEX "Product_category_idx" ON "Product"("category");

-- CreateIndex
CREATE INDEX "StockItemVariant_productId_idx" ON "StockItemVariant"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "StockItemVariant_productId_size_color_key" ON "StockItemVariant"("productId", "size", "color");

-- CreateIndex
CREATE INDEX "StockReceipt_reference_idx" ON "StockReceipt"("reference");

-- CreateIndex
CREATE INDEX "StockReceipt_receivedAt_idx" ON "StockReceipt"("receivedAt");

-- CreateIndex
CREATE INDEX "StockReceiptItem_receiptId_idx" ON "StockReceiptItem"("receiptId");

-- CreateIndex
CREATE INDEX "StockReceiptItem_productId_idx" ON "StockReceiptItem"("productId");

-- CreateIndex
CREATE INDEX "Deduction_employeeId_createdAt_idx" ON "Deduction"("employeeId", "createdAt");

-- CreateIndex
CREATE INDEX "Deduction_foremanId_createdAt_idx" ON "Deduction"("foremanId", "createdAt");

-- CreateIndex
CREATE INDEX "Deduction_timesheetId_idx" ON "Deduction"("timesheetId");

-- CreateIndex
CREATE INDEX "Deduction_productId_idx" ON "Deduction"("productId");

-- CreateIndex
CREATE INDEX "Deduction_siteId_idx" ON "Deduction"("siteId");

-- CreateIndex
CREATE INDEX "Deduction_applyTo_idx" ON "Deduction"("applyTo");

-- CreateIndex
CREATE INDEX "Deduction_type_idx" ON "Deduction"("type");

-- CreateIndex
CREATE UNIQUE INDEX "ProductOrder_reference_key" ON "ProductOrder"("reference");

-- CreateIndex
CREATE INDEX "ProductOrder_foremanId_createdAt_idx" ON "ProductOrder"("foremanId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductOrder_adminUserId_createdAt_idx" ON "ProductOrder"("adminUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductOrder_createdByUserId_createdAt_idx" ON "ProductOrder"("createdByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductOrder_status_idx" ON "ProductOrder"("status");

-- CreateIndex
CREATE INDEX "ProductOrderItem_orderId_idx" ON "ProductOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "ProductOrderItem_productId_idx" ON "ProductOrderItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyTeamRate_code_key" ON "CompanyTeamRate"("code");

-- CreateIndex
CREATE INDEX "CompanyTeamRate_name_idx" ON "CompanyTeamRate"("name");

-- CreateIndex
CREATE INDEX "CompanyTeamRate_sortOrder_name_idx" ON "CompanyTeamRate"("sortOrder", "name");

-- CreateIndex
CREATE INDEX "AuditEvent_action_idx" ON "AuditEvent"("action");

-- CreateIndex
CREATE INDEX "AuditEvent_entity_entityId_idx" ON "AuditEvent"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditEvent_actorUserId_idx" ON "AuditEvent"("actorUserId");

-- CreateIndex
CREATE INDEX "ProductCategory_normalizedName_idx" ON "ProductCategory"("normalizedName");

-- CreateIndex
CREATE INDEX "Supplier_isActive_idx" ON "Supplier"("isActive");

-- CreateIndex
CREATE INDEX "Supplier_normalizedName_idx" ON "Supplier"("normalizedName");

-- CreateIndex
CREATE INDEX "Supplier_parentSupplierId_idx" ON "Supplier"("parentSupplierId");

-- CreateIndex
CREATE INDEX "Supplier_supplierType_idx" ON "Supplier"("supplierType");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_name_key" ON "Supplier"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ProcurementProduct_masterCatalogueProductId_key" ON "ProcurementProduct"("masterCatalogueProductId");

-- CreateIndex
CREATE INDEX "ProcurementProduct_isActive_idx" ON "ProcurementProduct"("isActive");

-- CreateIndex
CREATE INDEX "ProcurementProduct_categoryId_idx" ON "ProcurementProduct"("categoryId");

-- CreateIndex
CREATE INDEX "ProcurementProduct_name_idx" ON "ProcurementProduct"("name");

-- CreateIndex
CREATE INDEX "ProcurementProduct_normalizedName_idx" ON "ProcurementProduct"("normalizedName");

-- CreateIndex
CREATE INDEX "ProcurementProduct_productType_idx" ON "ProcurementProduct"("productType");

-- CreateIndex
CREATE INDEX "ProcurementProduct_isReturnable_idx" ON "ProcurementProduct"("isReturnable");

-- CreateIndex
CREATE INDEX "ProcurementProduct_masterCatalogueProductId_idx" ON "ProcurementProduct"("masterCatalogueProductId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcurementProduct_sku_key" ON "ProcurementProduct"("sku");

-- CreateIndex
CREATE INDEX "ProductColorVariant_productId_idx" ON "ProductColorVariant"("productId");

-- CreateIndex
CREATE INDEX "ProductColorVariant_colorName_idx" ON "ProductColorVariant"("colorName");

-- CreateIndex
CREATE INDEX "ProductColorVariant_baseType_idx" ON "ProductColorVariant"("baseType");

-- CreateIndex
CREATE UNIQUE INDEX "ProductColorVariant_productId_colorName_baseType_key" ON "ProductColorVariant"("productId", "colorName", "baseType");

-- CreateIndex
CREATE INDEX "SitePaintColor_siteId_idx" ON "SitePaintColor"("siteId");

-- CreateIndex
CREATE INDEX "SitePaintColor_siteId_colorName_idx" ON "SitePaintColor"("siteId", "colorName");

-- CreateIndex
CREATE INDEX "SitePaintColor_siteId_baseType_idx" ON "SitePaintColor"("siteId", "baseType");

-- CreateIndex
CREATE INDEX "SitePaintColor_productId_idx" ON "SitePaintColor"("productId");

-- CreateIndex
CREATE INDEX "SitePaintColor_colorVariantId_idx" ON "SitePaintColor"("colorVariantId");

-- CreateIndex
CREATE INDEX "SitePaintColor_supplierId_idx" ON "SitePaintColor"("supplierId");

-- CreateIndex
CREATE INDEX "SitePaintColor_sourceOrderId_idx" ON "SitePaintColor"("sourceOrderId");

-- CreateIndex
CREATE INDEX "SitePaintColor_sourceOrderItemId_idx" ON "SitePaintColor"("sourceOrderItemId");

-- CreateIndex
CREATE INDEX "ProductVariantStock_productId_idx" ON "ProductVariantStock"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariantStock_productId_size_color_condition_key" ON "ProductVariantStock"("productId", "size", "color", "condition");

-- CreateIndex
CREATE INDEX "SupplierProductPrice_supplierId_productId_idx" ON "SupplierProductPrice"("supplierId", "productId");

-- CreateIndex
CREATE INDEX "SupplierProductPrice_productId_isActive_idx" ON "SupplierProductPrice"("productId", "isActive");

-- CreateIndex
CREATE INDEX "SupplierProductPrice_supplierId_isActive_idx" ON "SupplierProductPrice"("supplierId", "isActive");

-- CreateIndex
CREATE INDEX "SiteProductOrder_siteId_createdAt_idx" ON "SiteProductOrder"("siteId", "createdAt");

-- CreateIndex
CREATE INDEX "SiteProductOrder_supplierId_createdAt_idx" ON "SiteProductOrder"("supplierId", "createdAt");

-- CreateIndex
CREATE INDEX "SiteProductOrder_createdByUserId_createdAt_idx" ON "SiteProductOrder"("createdByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "SiteProductOrder_foremanId_createdAt_idx" ON "SiteProductOrder"("foremanId", "createdAt");

-- CreateIndex
CREATE INDEX "SiteProductOrder_reference_idx" ON "SiteProductOrder"("reference");

-- CreateIndex
CREATE INDEX "SiteProductOrderItem_orderId_idx" ON "SiteProductOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "SiteProductOrderItem_productId_idx" ON "SiteProductOrderItem"("productId");

-- CreateIndex
CREATE INDEX "SiteProductOrderItem_costCodeId_idx" ON "SiteProductOrderItem"("costCodeId");

-- CreateIndex
CREATE INDEX "FortnightMeeting_meetingOn_idx" ON "FortnightMeeting"("meetingOn");

-- CreateIndex
CREATE INDEX "FortnightMeeting_finalizedAt_idx" ON "FortnightMeeting"("finalizedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FortnightMeeting_startDate_endDate_key" ON "FortnightMeeting"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "FortnightMeetingRow_siteId_idx" ON "FortnightMeetingRow"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "FortnightMeetingRow_meetingId_siteId_key" ON "FortnightMeetingRow"("meetingId", "siteId");

-- CreateIndex
CREATE INDEX "OvertimePrice_isActive_idx" ON "OvertimePrice"("isActive");

-- CreateIndex
CREATE INDEX "OvertimeEntry_siteId_workDate_idx" ON "OvertimeEntry"("siteId", "workDate");

-- CreateIndex
CREATE INDEX "OvertimeEntry_foremanId_workDate_idx" ON "OvertimeEntry"("foremanId", "workDate");

-- CreateIndex
CREATE INDEX "OvertimeEntry_overtimePriceId_idx" ON "OvertimeEntry"("overtimePriceId");

-- CreateIndex
CREATE INDEX "OvertimeEntry_createdByUserId_idx" ON "OvertimeEntry"("createdByUserId");

-- CreateIndex
CREATE INDEX "OvertimeEntry_paidAt_idx" ON "OvertimeEntry"("paidAt");

-- CreateIndex
CREATE INDEX "OvertimeEntry_paidByUserId_idx" ON "OvertimeEntry"("paidByUserId");

-- CreateIndex
CREATE INDEX "OvertimeEntry_workDate_idx" ON "OvertimeEntry"("workDate");

-- CreateIndex
CREATE INDEX "OvertimeEntry_costCodeId_idx" ON "OvertimeEntry"("costCodeId");

-- CreateIndex
CREATE UNIQUE INDEX "FortnightMeetingTotals_meetingId_key" ON "FortnightMeetingTotals"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "Material_name_key" ON "Material"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Material_sku_key" ON "Material"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Material_procurementProductId_key" ON "Material"("procurementProductId");

-- CreateIndex
CREATE INDEX "Material_isActive_idx" ON "Material"("isActive");

-- CreateIndex
CREATE INDEX "Material_categoryId_idx" ON "Material"("categoryId");

-- CreateIndex
CREATE INDEX "Material_name_idx" ON "Material"("name");

-- CreateIndex
CREATE INDEX "Material_productType_idx" ON "Material"("productType");

-- CreateIndex
CREATE INDEX "MaterialPrice_supplierId_materialId_idx" ON "MaterialPrice"("supplierId", "materialId");

-- CreateIndex
CREATE INDEX "MaterialPrice_baseId_idx" ON "MaterialPrice"("baseId");

-- CreateIndex
CREATE INDEX "MaterialPrice_colorVariantId_idx" ON "MaterialPrice"("colorVariantId");

-- CreateIndex
CREATE INDEX "MaterialPrice_materialId_isActive_idx" ON "MaterialPrice"("materialId", "isActive");

-- CreateIndex
CREATE INDEX "MaterialPrice_supplierId_isActive_idx" ON "MaterialPrice"("supplierId", "isActive");

-- CreateIndex
CREATE INDEX "MaterialPrice_lastSeenAt_idx" ON "MaterialPrice"("lastSeenAt");

-- CreateIndex
CREATE INDEX "MaterialBase_materialId_idx" ON "MaterialBase"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialBase_materialId_name_key" ON "MaterialBase"("materialId", "name");

-- CreateIndex
CREATE INDEX "MaterialColorVariant_materialId_idx" ON "MaterialColorVariant"("materialId");

-- CreateIndex
CREATE INDEX "MaterialColorVariant_baseId_idx" ON "MaterialColorVariant"("baseId");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialColorVariant_materialId_colorName_baseType_key" ON "MaterialColorVariant"("materialId", "colorName", "baseType");

-- CreateIndex
CREATE INDEX "MaterialPriceHistory_supplierId_materialId_idx" ON "MaterialPriceHistory"("supplierId", "materialId");

-- CreateIndex
CREATE INDEX "MaterialPriceHistory_materialPriceId_idx" ON "MaterialPriceHistory"("materialPriceId");

-- CreateIndex
CREATE INDEX "MaterialPriceHistory_baseId_idx" ON "MaterialPriceHistory"("baseId");

-- CreateIndex
CREATE INDEX "MaterialPriceHistory_colorVariantId_idx" ON "MaterialPriceHistory"("colorVariantId");

-- CreateIndex
CREATE INDEX "MaterialPriceHistory_importedAt_idx" ON "MaterialPriceHistory"("importedAt");

-- CreateIndex
CREATE INDEX "SiteMaterial_siteId_idx" ON "SiteMaterial"("siteId");

-- CreateIndex
CREATE INDEX "SiteMaterial_productId_idx" ON "SiteMaterial"("productId");

-- CreateIndex
CREATE INDEX "SiteMaterial_materialId_idx" ON "SiteMaterial"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteMaterial_siteId_productId_key" ON "SiteMaterial"("siteId", "productId");

-- CreateIndex
CREATE INDEX "SiteMaterialUsage_siteMaterialId_idx" ON "SiteMaterialUsage"("siteMaterialId");

-- CreateIndex
CREATE INDEX "FinishingVariant_isActive_sortOrder_idx" ON "FinishingVariant"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "FinishingVariant_normalizedLabel_idx" ON "FinishingVariant"("normalizedLabel");

-- CreateIndex
CREATE INDEX "SiteFinishingSchedule_siteId_idx" ON "SiteFinishingSchedule"("siteId");

-- CreateIndex
CREATE INDEX "SiteFinishingSchedule_isActive_idx" ON "SiteFinishingSchedule"("isActive");

-- CreateIndex
CREATE INDEX "SiteFinishingSchedule_contractNo_idx" ON "SiteFinishingSchedule"("contractNo");

-- CreateIndex
CREATE INDEX "SiteFinishingScheduleArea_scheduleId_idx" ON "SiteFinishingScheduleArea"("scheduleId");

-- CreateIndex
CREATE INDEX "SiteFinishingScheduleItem_areaId_idx" ON "SiteFinishingScheduleItem"("areaId");

-- CreateIndex
CREATE INDEX "SiteFinishingScheduleItem_zone_idx" ON "SiteFinishingScheduleItem"("zone");

-- CreateIndex
CREATE INDEX "SiteFinishingScheduleItem_finishingVariantId_idx" ON "SiteFinishingScheduleItem"("finishingVariantId");

-- CreateIndex
CREATE INDEX "SiteFinishingScheduleItem_siteMaterialId_idx" ON "SiteFinishingScheduleItem"("siteMaterialId");

-- CreateIndex
CREATE INDEX "SiteFinishingScheduleItem_procurementProductId_idx" ON "SiteFinishingScheduleItem"("procurementProductId");

-- CreateIndex
CREATE INDEX "SiteFinishingScheduleItem_supplierId_idx" ON "SiteFinishingScheduleItem"("supplierId");

-- CreateIndex
CREATE INDEX "EarlySignOutReason_isActive_sortOrder_idx" ON "EarlySignOutReason"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "EarlySignOutReason_normalizedLabel_idx" ON "EarlySignOutReason"("normalizedLabel");

-- CreateIndex
CREATE INDEX "SiteCostCode_siteId_idx" ON "SiteCostCode"("siteId");

-- CreateIndex
CREATE INDEX "SiteCostCode_isActive_idx" ON "SiteCostCode"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SiteCostCode_siteId_code_key" ON "SiteCostCode"("siteId", "code");

-- CreateIndex
CREATE INDEX "SiteClaim_siteId_claimDate_idx" ON "SiteClaim"("siteId", "claimDate");

-- CreateIndex
CREATE INDEX "SiteClaim_status_idx" ON "SiteClaim"("status");

-- CreateIndex
CREATE INDEX "SiteClaim_claimNo_idx" ON "SiteClaim"("claimNo");

-- CreateIndex
CREATE INDEX "ProcurementProductCoverage_productId_idx" ON "ProcurementProductCoverage"("productId");

-- CreateIndex
CREATE INDEX "ProcurementProductCoverage_productId_isActive_idx" ON "ProcurementProductCoverage"("productId", "isActive");

-- CreateIndex
CREATE INDEX "ProcurementProductCoverage_productId_isDefault_idx" ON "ProcurementProductCoverage"("productId", "isDefault");

-- CreateIndex
CREATE INDEX "ProcurementProductCoverage_rateMode_idx" ON "ProcurementProductCoverage"("rateMode");

-- CreateIndex
CREATE INDEX "ProcurementProductCoverage_rateUnit_idx" ON "ProcurementProductCoverage"("rateUnit");

-- CreateIndex
CREATE INDEX "ProcurementProductCoverage_preferredPackSizeId_idx" ON "ProcurementProductCoverage"("preferredPackSizeId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcurementProductCoverage_productId_name_key" ON "ProcurementProductCoverage"("productId", "name");

-- CreateIndex
CREATE INDEX "ProcurementProductPackSize_productId_isActive_idx" ON "ProcurementProductPackSize"("productId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ProcurementProductPackSize_productId_quantity_uom_key" ON "ProcurementProductPackSize"("productId", "quantity", "uom");

-- CreateIndex
CREATE INDEX "ProcurementProductCoverageStep_profileId_idx" ON "ProcurementProductCoverageStep"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcurementProductCoverageStep_profileId_stepNumber_key" ON "ProcurementProductCoverageStep"("profileId", "stepNumber");

-- CreateIndex
CREATE INDEX "ImportJob_type_idx" ON "ImportJob"("type");

-- CreateIndex
CREATE INDEX "ImportJob_status_idx" ON "ImportJob"("status");

-- CreateIndex
CREATE INDEX "ImportJob_createdAt_idx" ON "ImportJob"("createdAt");

-- CreateIndex
CREATE INDEX "ImportJob_createdById_idx" ON "ImportJob"("createdById");

-- CreateIndex
CREATE INDEX "SitePaintPlan_siteId_createdAt_idx" ON "SitePaintPlan"("siteId", "createdAt");

-- CreateIndex
CREATE INDEX "SitePaintPlan_productId_idx" ON "SitePaintPlan"("productId");

-- CreateIndex
CREATE INDEX "LabourPlan_siteId_startDate_endDate_idx" ON "LabourPlan"("siteId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "LabourPlan_status_startDate_idx" ON "LabourPlan"("status", "startDate");

-- CreateIndex
CREATE INDEX "LabourPlan_createdByUserId_idx" ON "LabourPlan"("createdByUserId");

-- CreateIndex
CREATE INDEX "LabourPlanTeam_planId_idx" ON "LabourPlanTeam"("planId");

-- CreateIndex
CREATE INDEX "LabourPlanTeam_teamCode_idx" ON "LabourPlanTeam"("teamCode");

-- CreateIndex
CREATE INDEX "LabourPlanTeam_foremanId_idx" ON "LabourPlanTeam"("foremanId");

-- CreateIndex
CREATE INDEX "LabourPlanTeam_suggestedSupervisorId_idx" ON "LabourPlanTeam"("suggestedSupervisorId");

-- CreateIndex
CREATE INDEX "LabourPlanTeam_overrideSupervisorId_idx" ON "LabourPlanTeam"("overrideSupervisorId");

-- CreateIndex
CREATE INDEX "LabourPlanDay_workDate_idx" ON "LabourPlanDay"("workDate");

-- CreateIndex
CREATE UNIQUE INDEX "LabourPlanDay_teamId_workDate_key" ON "LabourPlanDay"("teamId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "LabourPlanApprovalSnapshot_planId_key" ON "LabourPlanApprovalSnapshot"("planId");

-- CreateIndex
CREATE INDEX "LabourChangeRequest_planId_status_idx" ON "LabourChangeRequest"("planId", "status");

-- CreateIndex
CREATE INDEX "LabourChangeRequest_teamId_startDate_endDate_idx" ON "LabourChangeRequest"("teamId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "LabourChangeRequest_status_startDate_idx" ON "LabourChangeRequest"("status", "startDate");

-- CreateIndex
CREATE INDEX "PaintTdsImport_supplierId_idx" ON "PaintTdsImport"("supplierId");

-- CreateIndex
CREATE INDEX "PaintTdsImport_manufacturerDetected_idx" ON "PaintTdsImport"("manufacturerDetected");

-- CreateIndex
CREATE INDEX "PaintTdsImport_status_idx" ON "PaintTdsImport"("status");

-- CreateIndex
CREATE INDEX "PaintTdsImport_productCodeDetected_idx" ON "PaintTdsImport"("productCodeDetected");

-- CreateIndex
CREATE INDEX "PaintTdsImportProfile_importId_idx" ON "PaintTdsImportProfile"("importId");

-- CreateIndex
CREATE INDEX "SitePaintUsage_planId_usedOn_idx" ON "SitePaintUsage"("planId", "usedOn");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_siteId_idx" ON "Notification"("siteId");

-- CreateIndex
CREATE INDEX "SchedulerTask_userId_column_idx" ON "SchedulerTask"("userId", "column");

-- CreateIndex
CREATE INDEX "SchedulerTask_userId_date_idx" ON "SchedulerTask"("userId", "date");

-- CreateIndex
CREATE INDEX "UserNote_userId_isPinned_updatedAt_idx" ON "UserNote"("userId", "isPinned", "updatedAt");

-- CreateIndex
CREATE INDEX "UserNote_isRoomNote_updatedAt_idx" ON "UserNote"("isRoomNote", "updatedAt");

-- CreateIndex
CREATE INDEX "NoteMember_userId_idx" ON "NoteMember"("userId");

-- CreateIndex
CREATE INDEX "NoteMember_noteId_idx" ON "NoteMember"("noteId");

-- CreateIndex
CREATE UNIQUE INDEX "NoteMember_noteId_userId_key" ON "NoteMember"("noteId", "userId");

-- CreateIndex
CREATE INDEX "NoteInvite_invitedUserId_status_idx" ON "NoteInvite"("invitedUserId", "status");

-- CreateIndex
CREATE INDEX "NoteInvite_noteId_status_idx" ON "NoteInvite"("noteId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "NoteInvite_noteId_invitedUserId_key" ON "NoteInvite"("noteId", "invitedUserId");

-- CreateIndex
CREATE INDEX "NoteAttachment_noteId_idx" ON "NoteAttachment"("noteId");

-- CreateIndex
CREATE INDEX "NoteComment_noteId_idx" ON "NoteComment"("noteId");

-- CreateIndex
CREATE INDEX "NoteComment_userId_idx" ON "NoteComment"("userId");

-- CreateIndex
CREATE INDEX "SiteProgressNote_siteId_createdAt_idx" ON "SiteProgressNote"("siteId", "createdAt");

-- CreateIndex
CREATE INDEX "SitePlantAssignment_reference_idx" ON "SitePlantAssignment"("reference");

-- CreateIndex
CREATE INDEX "SitePlantAssignment_siteId_idx" ON "SitePlantAssignment"("siteId");

-- CreateIndex
CREATE INDEX "SitePlantAssignment_productId_idx" ON "SitePlantAssignment"("productId");

-- CreateIndex
CREATE INDEX "SitePlantAssignment_status_idx" ON "SitePlantAssignment"("status");

-- CreateIndex
CREATE INDEX "SitePlantAssignment_assignedByUserId_idx" ON "SitePlantAssignment"("assignedByUserId");

-- CreateIndex
CREATE INDEX "PlantTransfer_productId_idx" ON "PlantTransfer"("productId");

-- CreateIndex
CREATE INDEX "PlantTransfer_fromSiteId_idx" ON "PlantTransfer"("fromSiteId");

-- CreateIndex
CREATE INDEX "PlantTransfer_toSiteId_idx" ON "PlantTransfer"("toSiteId");

-- CreateIndex
CREATE INDEX "PlantTransfer_fromAssignmentId_idx" ON "PlantTransfer"("fromAssignmentId");

-- CreateIndex
CREATE INDEX "PlantTransfer_toAssignmentId_idx" ON "PlantTransfer"("toAssignmentId");

-- CreateIndex
CREATE INDEX "PlantTransfer_transferredOn_idx" ON "PlantTransfer"("transferredOn");

-- CreateIndex
CREATE INDEX "ForemanPpeOrder_foremanId_idx" ON "ForemanPpeOrder"("foremanId");

-- CreateIndex
CREATE INDEX "ForemanPpeOrder_siteId_idx" ON "ForemanPpeOrder"("siteId");

-- CreateIndex
CREATE INDEX "ForemanPpeOrder_status_idx" ON "ForemanPpeOrder"("status");

-- CreateIndex
CREATE INDEX "ForemanPpeOrderItem_orderId_idx" ON "ForemanPpeOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "ForemanPpeOrderItem_productId_idx" ON "ForemanPpeOrderItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentHolder_name_key" ON "EquipmentHolder"("name");

-- CreateIndex
CREATE INDEX "EquipmentItem_holderId_idx" ON "EquipmentItem"("holderId");

-- CreateIndex
CREATE INDEX "EquipmentItem_category_idx" ON "EquipmentItem"("category");

-- CreateIndex
CREATE INDEX "EquipmentItem_condition_idx" ON "EquipmentItem"("condition");

-- CreateIndex
CREATE INDEX "CapeTownStockItem_category_idx" ON "CapeTownStockItem"("category");

-- CreateIndex
CREATE INDEX "CapeTownStockItem_isActive_idx" ON "CapeTownStockItem"("isActive");

-- CreateIndex
CREATE INDEX "CapeTownStockVariant_itemId_idx" ON "CapeTownStockVariant"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "CapeTownStockVariant_itemId_size_color_key" ON "CapeTownStockVariant"("itemId", "size", "color");

-- CreateIndex
CREATE INDEX "CapeTownDeployment_itemId_idx" ON "CapeTownDeployment"("itemId");

-- CreateIndex
CREATE INDEX "CapeTownDeployment_deployedAt_idx" ON "CapeTownDeployment"("deployedAt");

-- CreateIndex
CREATE INDEX "CapeTownStockOrder_itemId_idx" ON "CapeTownStockOrder"("itemId");

-- CreateIndex
CREATE INDEX "CapeTownStockOrder_status_idx" ON "CapeTownStockOrder"("status");

-- CreateIndex
CREATE INDEX "NotePresence_noteId_isActive_idx" ON "NotePresence"("noteId", "isActive");

-- CreateIndex
CREATE INDEX "NotePresence_userId_idx" ON "NotePresence"("userId");

-- CreateIndex
CREATE INDEX "NotePresence_lastActivityAt_idx" ON "NotePresence"("lastActivityAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotePresence_noteId_userId_key" ON "NotePresence"("noteId", "userId");

-- CreateIndex
CREATE INDEX "NoteEditHistory_noteId_createdAt_idx" ON "NoteEditHistory"("noteId", "createdAt");

-- CreateIndex
CREATE INDEX "NoteEditHistory_userId_idx" ON "NoteEditHistory"("userId");

-- CreateIndex
CREATE INDEX "SiteProgramme_siteId_idx" ON "SiteProgramme"("siteId");

-- CreateIndex
CREATE INDEX "SiteProgramme_status_idx" ON "SiteProgramme"("status");

-- CreateIndex
CREATE INDEX "SiteProgramme_plannedStartDate_idx" ON "SiteProgramme"("plannedStartDate");

-- CreateIndex
CREATE INDEX "SiteProgramme_plannedFinishDate_idx" ON "SiteProgramme"("plannedFinishDate");

-- CreateIndex
CREATE INDEX "SiteProgrammeItem_programmeId_idx" ON "SiteProgrammeItem"("programmeId");

-- CreateIndex
CREATE INDEX "SiteProgrammeItem_plannedStartDate_idx" ON "SiteProgrammeItem"("plannedStartDate");

-- CreateIndex
CREATE INDEX "SiteProgrammeItem_plannedFinishDate_idx" ON "SiteProgrammeItem"("plannedFinishDate");

-- CreateIndex
CREATE INDEX "SiteProgrammeItem_actualFinishDate_idx" ON "SiteProgrammeItem"("actualFinishDate");

-- CreateIndex
CREATE INDEX "SiteProgrammeItem_status_idx" ON "SiteProgrammeItem"("status");

-- CreateIndex
CREATE INDEX "MasterCatalogueProduct_supplierId_idx" ON "MasterCatalogueProduct"("supplierId");

-- CreateIndex
CREATE INDEX "MasterCatalogueProduct_categoryId_idx" ON "MasterCatalogueProduct"("categoryId");

-- CreateIndex
CREATE INDEX "MasterCatalogueProduct_name_idx" ON "MasterCatalogueProduct"("name");

-- CreateIndex
CREATE INDEX "MasterCatalogueProduct_normalizedName_idx" ON "MasterCatalogueProduct"("normalizedName");

-- CreateIndex
CREATE INDEX "MasterCatalogueProduct_category_idx" ON "MasterCatalogueProduct"("category");

-- CreateIndex
CREATE INDEX "MasterCatalogueProduct_sku_idx" ON "MasterCatalogueProduct"("sku");

-- CreateIndex
CREATE INDEX "MasterCatalogueProduct_productType_idx" ON "MasterCatalogueProduct"("productType");

-- CreateIndex
CREATE INDEX "MasterCatalogueProduct_usage_idx" ON "MasterCatalogueProduct"("usage");

-- CreateIndex
CREATE INDEX "MasterCatalogueProduct_isActive_idx" ON "MasterCatalogueProduct"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "MasterCatalogueProduct_supplierId_normalizedName_key" ON "MasterCatalogueProduct"("supplierId", "normalizedName");

-- CreateIndex
CREATE INDEX "MasterProductFinish_productId_idx" ON "MasterProductFinish"("productId");

-- CreateIndex
CREATE INDEX "MasterProductFinish_normalizedName_idx" ON "MasterProductFinish"("normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "MasterProductFinish_productId_normalizedName_key" ON "MasterProductFinish"("productId", "normalizedName");

-- CreateIndex
CREATE INDEX "MasterProductBase_productId_idx" ON "MasterProductBase"("productId");

-- CreateIndex
CREATE INDEX "MasterProductBase_normalizedName_idx" ON "MasterProductBase"("normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "MasterProductBase_productId_normalizedName_key" ON "MasterProductBase"("productId", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "MasterProductPrice_lookupKey_key" ON "MasterProductPrice"("lookupKey");

-- CreateIndex
CREATE INDEX "MasterProductPrice_productId_idx" ON "MasterProductPrice"("productId");

-- CreateIndex
CREATE INDEX "MasterProductPrice_finishId_idx" ON "MasterProductPrice"("finishId");

-- CreateIndex
CREATE INDEX "MasterProductPrice_baseId_idx" ON "MasterProductPrice"("baseId");

-- CreateIndex
CREATE INDEX "MasterProductPrice_productId_baseId_unitSize_uom_idx" ON "MasterProductPrice"("productId", "baseId", "unitSize", "uom");

-- CreateIndex
CREATE INDEX "MasterProductPrice_effectiveFrom_idx" ON "MasterProductPrice"("effectiveFrom");

-- CreateIndex
CREATE INDEX "MasterProductPrice_isActive_idx" ON "MasterProductPrice"("isActive");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushToken" ADD CONSTRAINT "PushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supervisor" ADD CONSTRAINT "Supervisor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Foreman" ADD CONSTRAINT "Foreman_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForemanAssistant" ADD CONSTRAINT "ForemanAssistant_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForemanAssistant" ADD CONSTRAINT "ForemanAssistant_foremanId_fkey" FOREIGN KEY ("foremanId") REFERENCES "Foreman"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForemanEmployee" ADD CONSTRAINT "ForemanEmployee_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForemanEmployee" ADD CONSTRAINT "ForemanEmployee_foremanId_fkey" FOREIGN KEY ("foremanId") REFERENCES "Foreman"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisorForeman" ADD CONSTRAINT "SupervisorForeman_foremanId_fkey" FOREIGN KEY ("foremanId") REFERENCES "Foreman"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisorForeman" ADD CONSTRAINT "SupervisorForeman_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Supervisor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteDocument" ADD CONSTRAINT "SiteDocument_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteDocument" ADD CONSTRAINT "SiteDocument_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricalSiteCost" ADD CONSTRAINT "HistoricalSiteCost_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisorSiteAssignment" ADD CONSTRAINT "SupervisorSiteAssignment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisorSiteAssignment" ADD CONSTRAINT "SupervisorSiteAssignment_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Supervisor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDayRateOverride" ADD CONSTRAINT "EmployeeDayRateOverride_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDayRateOverride" ADD CONSTRAINT "EmployeeDayRateOverride_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDayRateOverride" ADD CONSTRAINT "EmployeeDayRateOverride_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteForemanDayRateOverride" ADD CONSTRAINT "SiteForemanDayRateOverride_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteForemanDayRateOverride" ADD CONSTRAINT "SiteForemanDayRateOverride_foremanId_fkey" FOREIGN KEY ("foremanId") REFERENCES "Foreman"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteForemanDayRateOverride" ADD CONSTRAINT "SiteForemanDayRateOverride_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForemanSiteAssignment" ADD CONSTRAINT "ForemanSiteAssignment_foremanId_fkey" FOREIGN KEY ("foremanId") REFERENCES "Foreman"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForemanSiteAssignment" ADD CONSTRAINT "ForemanSiteAssignment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminSiteAssignment" ADD CONSTRAINT "AdminSiteAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminSiteAssignment" ADD CONSTRAINT "AdminSiteAssignment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteDay" ADD CONSTRAINT "SiteDay_foremanId_fkey" FOREIGN KEY ("foremanId") REFERENCES "Foreman"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteDay" ADD CONSTRAINT "SiteDay_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceScan" ADD CONSTRAINT "AttendanceScan_supervisorAuthByUserId_fkey" FOREIGN KEY ("supervisorAuthByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceScan" ADD CONSTRAINT "AttendanceScan_earlySignOutReasonId_fkey" FOREIGN KEY ("earlySignOutReasonId") REFERENCES "EarlySignOutReason"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceScan" ADD CONSTRAINT "AttendanceScan_earlySignOutCapturedByUserId_fkey" FOREIGN KEY ("earlySignOutCapturedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceScan" ADD CONSTRAINT "AttendanceScan_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceScan" ADD CONSTRAINT "AttendanceScan_siteDayId_fkey" FOREIGN KEY ("siteDayId") REFERENCES "SiteDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceScan" ADD CONSTRAINT "AttendanceScan_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceScan" ADD CONSTRAINT "AttendanceScan_scanOutPhotoId_fkey" FOREIGN KEY ("scanOutPhotoId") REFERENCES "SiteDayPhoto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceScan" ADD CONSTRAINT "AttendanceScan_transferredByUserId_fkey" FOREIGN KEY ("transferredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FingerprintEnrollment" ADD CONSTRAINT "FingerprintEnrollment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FingerprintEnrollment" ADD CONSTRAINT "FingerprintEnrollment_enrolledByForemanId_fkey" FOREIGN KEY ("enrolledByForemanId") REFERENCES "Foreman"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FingerprintEnrollment" ADD CONSTRAINT "FingerprintEnrollment_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "AttendanceScanReview" ADD CONSTRAINT "AttendanceScanReview_attendanceScanId_fkey" FOREIGN KEY ("attendanceScanId") REFERENCES "AttendanceScan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceScanReview" ADD CONSTRAINT "AttendanceScanReview_byUserId_fkey" FOREIGN KEY ("byUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCardScan" ADD CONSTRAINT "AttendanceCardScan_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCardScan" ADD CONSTRAINT "AttendanceCardScan_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteDayPhotoRequest" ADD CONSTRAINT "SiteDayPhotoRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteDayPhotoRequest" ADD CONSTRAINT "SiteDayPhotoRequest_siteDayId_fkey" FOREIGN KEY ("siteDayId") REFERENCES "SiteDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteDayPhoto" ADD CONSTRAINT "SiteDayPhoto_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SiteDayPhotoRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteDayPhoto" ADD CONSTRAINT "SiteDayPhoto_siteDayId_fkey" FOREIGN KEY ("siteDayId") REFERENCES "SiteDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteDayPhoto" ADD CONSTRAINT "SiteDayPhoto_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoVerification" ADD CONSTRAINT "PhotoVerification_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "SiteDayPhoto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoVerification" ADD CONSTRAINT "PhotoVerification_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoDetection" ADD CONSTRAINT "PhotoDetection_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoDetection" ADD CONSTRAINT "PhotoDetection_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "SiteDayPhoto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_approvedBySupervisorId_fkey" FOREIGN KEY ("approvedBySupervisorId") REFERENCES "Supervisor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_foremanId_fkey" FOREIGN KEY ("foremanId") REFERENCES "Foreman"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "TimesheetPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetDayAcceptance" ADD CONSTRAINT "TimesheetDayAcceptance_acceptedBySupervisorId_fkey" FOREIGN KEY ("acceptedBySupervisorId") REFERENCES "Supervisor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetDayAcceptance" ADD CONSTRAINT "TimesheetDayAcceptance_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockItemVariant" ADD CONSTRAINT "StockItemVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReceiptItem" ADD CONSTRAINT "StockReceiptItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "StockReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReceiptItem" ADD CONSTRAINT "StockReceiptItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deduction" ADD CONSTRAINT "Deduction_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deduction" ADD CONSTRAINT "Deduction_foremanId_fkey" FOREIGN KEY ("foremanId") REFERENCES "Foreman"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deduction" ADD CONSTRAINT "Deduction_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deduction" ADD CONSTRAINT "Deduction_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deduction" ADD CONSTRAINT "Deduction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deduction" ADD CONSTRAINT "Deduction_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "ProductOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deduction" ADD CONSTRAINT "Deduction_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOrder" ADD CONSTRAINT "ProductOrder_foremanId_fkey" FOREIGN KEY ("foremanId") REFERENCES "Foreman"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOrder" ADD CONSTRAINT "ProductOrder_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOrder" ADD CONSTRAINT "ProductOrder_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOrderItem" ADD CONSTRAINT "ProductOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOrderItem" ADD CONSTRAINT "ProductOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_parentSupplierId_fkey" FOREIGN KEY ("parentSupplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementProduct" ADD CONSTRAINT "ProcurementProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementProduct" ADD CONSTRAINT "ProcurementProduct_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementProduct" ADD CONSTRAINT "ProcurementProduct_masterCatalogueProductId_fkey" FOREIGN KEY ("masterCatalogueProductId") REFERENCES "MasterCatalogueProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductColorVariant" ADD CONSTRAINT "ProductColorVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ProcurementProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePaintColor" ADD CONSTRAINT "SitePaintColor_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePaintColor" ADD CONSTRAINT "SitePaintColor_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ProcurementProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePaintColor" ADD CONSTRAINT "SitePaintColor_colorVariantId_fkey" FOREIGN KEY ("colorVariantId") REFERENCES "ProductColorVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePaintColor" ADD CONSTRAINT "SitePaintColor_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePaintColor" ADD CONSTRAINT "SitePaintColor_sourceOrderId_fkey" FOREIGN KEY ("sourceOrderId") REFERENCES "SiteProductOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePaintColor" ADD CONSTRAINT "SitePaintColor_sourceOrderItemId_fkey" FOREIGN KEY ("sourceOrderItemId") REFERENCES "SiteProductOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariantStock" ADD CONSTRAINT "ProductVariantStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ProcurementProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierProductPrice" ADD CONSTRAINT "SupplierProductPrice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierProductPrice" ADD CONSTRAINT "SupplierProductPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ProcurementProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierProductPrice" ADD CONSTRAINT "SupplierProductPrice_colorVariantId_fkey" FOREIGN KEY ("colorVariantId") REFERENCES "ProductColorVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteProductOrder" ADD CONSTRAINT "SiteProductOrder_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteProductOrder" ADD CONSTRAINT "SiteProductOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteProductOrder" ADD CONSTRAINT "SiteProductOrder_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteProductOrder" ADD CONSTRAINT "SiteProductOrder_foremanId_fkey" FOREIGN KEY ("foremanId") REFERENCES "Foreman"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteProductOrderItem" ADD CONSTRAINT "SiteProductOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SiteProductOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteProductOrderItem" ADD CONSTRAINT "SiteProductOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ProcurementProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteProductOrderItem" ADD CONSTRAINT "SiteProductOrderItem_costCodeId_fkey" FOREIGN KEY ("costCodeId") REFERENCES "SiteCostCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FortnightMeeting" ADD CONSTRAINT "FortnightMeeting_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FortnightMeeting" ADD CONSTRAINT "FortnightMeeting_finalizedByUserId_fkey" FOREIGN KEY ("finalizedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FortnightMeeting" ADD CONSTRAINT "FortnightMeeting_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "TimesheetPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FortnightMeetingRow" ADD CONSTRAINT "FortnightMeetingRow_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "FortnightMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FortnightMeetingRow" ADD CONSTRAINT "FortnightMeetingRow_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeEntry" ADD CONSTRAINT "OvertimeEntry_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeEntry" ADD CONSTRAINT "OvertimeEntry_foremanId_fkey" FOREIGN KEY ("foremanId") REFERENCES "Foreman"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeEntry" ADD CONSTRAINT "OvertimeEntry_overtimePriceId_fkey" FOREIGN KEY ("overtimePriceId") REFERENCES "OvertimePrice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeEntry" ADD CONSTRAINT "OvertimeEntry_paidByUserId_fkey" FOREIGN KEY ("paidByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeEntry" ADD CONSTRAINT "OvertimeEntry_costCodeId_fkey" FOREIGN KEY ("costCodeId") REFERENCES "SiteCostCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeEntry" ADD CONSTRAINT "OvertimeEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FortnightMeetingTotals" ADD CONSTRAINT "FortnightMeetingTotals_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "FortnightMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialPrice" ADD CONSTRAINT "MaterialPrice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialPrice" ADD CONSTRAINT "MaterialPrice_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialPrice" ADD CONSTRAINT "MaterialPrice_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES "MaterialBase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialPrice" ADD CONSTRAINT "MaterialPrice_colorVariantId_fkey" FOREIGN KEY ("colorVariantId") REFERENCES "MaterialColorVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialBase" ADD CONSTRAINT "MaterialBase_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialColorVariant" ADD CONSTRAINT "MaterialColorVariant_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialColorVariant" ADD CONSTRAINT "MaterialColorVariant_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES "MaterialBase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialPriceHistory" ADD CONSTRAINT "MaterialPriceHistory_materialPriceId_fkey" FOREIGN KEY ("materialPriceId") REFERENCES "MaterialPrice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialPriceHistory" ADD CONSTRAINT "MaterialPriceHistory_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialPriceHistory" ADD CONSTRAINT "MaterialPriceHistory_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialPriceHistory" ADD CONSTRAINT "MaterialPriceHistory_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES "MaterialBase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialPriceHistory" ADD CONSTRAINT "MaterialPriceHistory_colorVariantId_fkey" FOREIGN KEY ("colorVariantId") REFERENCES "MaterialColorVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteMaterial" ADD CONSTRAINT "SiteMaterial_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteMaterial" ADD CONSTRAINT "SiteMaterial_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ProcurementProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteMaterial" ADD CONSTRAINT "SiteMaterial_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteMaterialUsage" ADD CONSTRAINT "SiteMaterialUsage_siteMaterialId_fkey" FOREIGN KEY ("siteMaterialId") REFERENCES "SiteMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteFinishingSchedule" ADD CONSTRAINT "SiteFinishingSchedule_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteFinishingSchedule" ADD CONSTRAINT "SiteFinishingSchedule_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteFinishingSchedule" ADD CONSTRAINT "SiteFinishingSchedule_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "SiteFinishingSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteFinishingScheduleArea" ADD CONSTRAINT "SiteFinishingScheduleArea_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "SiteFinishingSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteFinishingScheduleItem" ADD CONSTRAINT "SiteFinishingScheduleItem_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "SiteFinishingScheduleArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteFinishingScheduleItem" ADD CONSTRAINT "SiteFinishingScheduleItem_finishingVariantId_fkey" FOREIGN KEY ("finishingVariantId") REFERENCES "FinishingVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteFinishingScheduleItem" ADD CONSTRAINT "SiteFinishingScheduleItem_siteMaterialId_fkey" FOREIGN KEY ("siteMaterialId") REFERENCES "SiteMaterial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteFinishingScheduleItem" ADD CONSTRAINT "SiteFinishingScheduleItem_procurementProductId_fkey" FOREIGN KEY ("procurementProductId") REFERENCES "ProcurementProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteFinishingScheduleItem" ADD CONSTRAINT "SiteFinishingScheduleItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteCostCode" ADD CONSTRAINT "SiteCostCode_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteClaim" ADD CONSTRAINT "SiteClaim_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteClaim" ADD CONSTRAINT "SiteClaim_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementProductCoverage" ADD CONSTRAINT "ProcurementProductCoverage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ProcurementProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementProductCoverage" ADD CONSTRAINT "ProcurementProductCoverage_preferredPackSizeId_fkey" FOREIGN KEY ("preferredPackSizeId") REFERENCES "ProcurementProductPackSize"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementProductPackSize" ADD CONSTRAINT "ProcurementProductPackSize_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ProcurementProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementProductCoverageStep" ADD CONSTRAINT "ProcurementProductCoverageStep_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ProcurementProductCoverage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePaintPlan" ADD CONSTRAINT "SitePaintPlan_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePaintPlan" ADD CONSTRAINT "SitePaintPlan_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ProcurementProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePaintPlan" ADD CONSTRAINT "SitePaintPlan_coverageId_fkey" FOREIGN KEY ("coverageId") REFERENCES "ProcurementProductCoverage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePaintPlan" ADD CONSTRAINT "SitePaintPlan_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourPlan" ADD CONSTRAINT "LabourPlan_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourPlan" ADD CONSTRAINT "LabourPlan_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourPlan" ADD CONSTRAINT "LabourPlan_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourPlan" ADD CONSTRAINT "LabourPlan_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourPlan" ADD CONSTRAINT "LabourPlan_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourPlan" ADD CONSTRAINT "LabourPlan_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourPlanTeam" ADD CONSTRAINT "LabourPlanTeam_planId_fkey" FOREIGN KEY ("planId") REFERENCES "LabourPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourPlanTeam" ADD CONSTRAINT "LabourPlanTeam_foremanId_fkey" FOREIGN KEY ("foremanId") REFERENCES "Foreman"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourPlanTeam" ADD CONSTRAINT "LabourPlanTeam_suggestedSupervisorId_fkey" FOREIGN KEY ("suggestedSupervisorId") REFERENCES "Supervisor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourPlanTeam" ADD CONSTRAINT "LabourPlanTeam_overrideSupervisorId_fkey" FOREIGN KEY ("overrideSupervisorId") REFERENCES "Supervisor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourPlanDay" ADD CONSTRAINT "LabourPlanDay_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "LabourPlanTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourPlanApprovalSnapshot" ADD CONSTRAINT "LabourPlanApprovalSnapshot_planId_fkey" FOREIGN KEY ("planId") REFERENCES "LabourPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourChangeRequest" ADD CONSTRAINT "LabourChangeRequest_planId_fkey" FOREIGN KEY ("planId") REFERENCES "LabourPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourChangeRequest" ADD CONSTRAINT "LabourChangeRequest_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "LabourPlanTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourChangeRequest" ADD CONSTRAINT "LabourChangeRequest_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourChangeRequest" ADD CONSTRAINT "LabourChangeRequest_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourChangeRequest" ADD CONSTRAINT "LabourChangeRequest_rejectedByUserId_fkey" FOREIGN KEY ("rejectedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaintTdsImport" ADD CONSTRAINT "PaintTdsImport_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaintTdsImport" ADD CONSTRAINT "PaintTdsImport_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaintTdsImportProfile" ADD CONSTRAINT "PaintTdsImportProfile_importId_fkey" FOREIGN KEY ("importId") REFERENCES "PaintTdsImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePaintUsage" ADD CONSTRAINT "SitePaintUsage_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SitePaintPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePaintUsage" ADD CONSTRAINT "SitePaintUsage_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulerTask" ADD CONSTRAINT "SchedulerTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNote" ADD CONSTRAINT "UserNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteMember" ADD CONSTRAINT "NoteMember_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "UserNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteMember" ADD CONSTRAINT "NoteMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteInvite" ADD CONSTRAINT "NoteInvite_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "UserNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteInvite" ADD CONSTRAINT "NoteInvite_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteInvite" ADD CONSTRAINT "NoteInvite_invitedUserId_fkey" FOREIGN KEY ("invitedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteAttachment" ADD CONSTRAINT "NoteAttachment_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "UserNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteComment" ADD CONSTRAINT "NoteComment_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "UserNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteComment" ADD CONSTRAINT "NoteComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteProgressNote" ADD CONSTRAINT "SiteProgressNote_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteProgressNote" ADD CONSTRAINT "SiteProgressNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePlantAssignment" ADD CONSTRAINT "SitePlantAssignment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePlantAssignment" ADD CONSTRAINT "SitePlantAssignment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ProcurementProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePlantAssignment" ADD CONSTRAINT "SitePlantAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantTransfer" ADD CONSTRAINT "PlantTransfer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ProcurementProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantTransfer" ADD CONSTRAINT "PlantTransfer_fromSiteId_fkey" FOREIGN KEY ("fromSiteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantTransfer" ADD CONSTRAINT "PlantTransfer_toSiteId_fkey" FOREIGN KEY ("toSiteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantTransfer" ADD CONSTRAINT "PlantTransfer_fromAssignmentId_fkey" FOREIGN KEY ("fromAssignmentId") REFERENCES "SitePlantAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantTransfer" ADD CONSTRAINT "PlantTransfer_toAssignmentId_fkey" FOREIGN KEY ("toAssignmentId") REFERENCES "SitePlantAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantTransfer" ADD CONSTRAINT "PlantTransfer_transferredByUserId_fkey" FOREIGN KEY ("transferredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForemanPpeOrder" ADD CONSTRAINT "ForemanPpeOrder_foremanId_fkey" FOREIGN KEY ("foremanId") REFERENCES "Foreman"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForemanPpeOrder" ADD CONSTRAINT "ForemanPpeOrder_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForemanPpeOrder" ADD CONSTRAINT "ForemanPpeOrder_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForemanPpeOrderItem" ADD CONSTRAINT "ForemanPpeOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ForemanPpeOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForemanPpeOrderItem" ADD CONSTRAINT "ForemanPpeOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ProcurementProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentItem" ADD CONSTRAINT "EquipmentItem_holderId_fkey" FOREIGN KEY ("holderId") REFERENCES "EquipmentHolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapeTownStockVariant" ADD CONSTRAINT "CapeTownStockVariant_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CapeTownStockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapeTownDeployment" ADD CONSTRAINT "CapeTownDeployment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CapeTownStockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapeTownStockOrder" ADD CONSTRAINT "CapeTownStockOrder_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CapeTownStockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotePresence" ADD CONSTRAINT "NotePresence_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "UserNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotePresence" ADD CONSTRAINT "NotePresence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteEditHistory" ADD CONSTRAINT "NoteEditHistory_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "UserNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteEditHistory" ADD CONSTRAINT "NoteEditHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteProgramme" ADD CONSTRAINT "SiteProgramme_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteProgramme" ADD CONSTRAINT "SiteProgramme_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteProgrammeItem" ADD CONSTRAINT "SiteProgrammeItem_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "SiteProgramme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterCatalogueProduct" ADD CONSTRAINT "MasterCatalogueProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterCatalogueProduct" ADD CONSTRAINT "MasterCatalogueProduct_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterProductFinish" ADD CONSTRAINT "MasterProductFinish_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MasterCatalogueProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterProductBase" ADD CONSTRAINT "MasterProductBase_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MasterCatalogueProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterProductPrice" ADD CONSTRAINT "MasterProductPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MasterCatalogueProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterProductPrice" ADD CONSTRAINT "MasterProductPrice_finishId_fkey" FOREIGN KEY ("finishId") REFERENCES "MasterProductFinish"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterProductPrice" ADD CONSTRAINT "MasterProductPrice_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES "MasterProductBase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

