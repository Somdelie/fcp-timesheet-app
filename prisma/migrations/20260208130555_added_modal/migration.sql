-- CreateTable
CREATE TABLE "TimesheetYear" (
    "year" INTEGER NOT NULL,
    "anchorSat" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimesheetYear_pkey" PRIMARY KEY ("year")
);
