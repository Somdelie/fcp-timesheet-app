import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminOrSupervisorFromRequest } from "@/lib/adminOrSupervisorAuth";
import { startOfDayUTC, addDaysUTC, isoFromDateUTC } from "@/lib/dateUtc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/app/admin/daily-exceptions?date=YYYY-MM-DD
 *
 * Backs the Daily Exception Dashboard. Defaults to yesterday, since the
 * operational routine is "every morning Admin reviews yesterday". All
 * sections are computed on read from existing AttendanceScan /
 * FingerprintEnrollment data — nothing new is persisted here.
 */
export async function GET(req: NextRequest) {
  const actor = await getAdminOrSupervisorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");

  const targetDate = dateParam
    ? startOfDayUTC(dateParam)
    : addDaysUTC(startOfDayUTC(isoFromDateUTC(new Date())), -1);
  const nextDay = addDaysUTC(targetDate, 1);

  const dayWhere = { workDate: { gte: targetDate, lt: nextDay } };

  const scanSelect = {
    id: true,
    scannedAt: true,
    scannedOutAt: true,
    scanType: true,
    manualReason: true,
    verificationStatus: true,
    hasEarlySignOut: true,
    earlySignOutReasonLabel: true,
    employee: {
      select: { id: true, firstName: true, lastName: true, qrCodeValue: true },
    },
    site: { select: { id: true, name: true, code: true } },
    siteDay: {
      select: { foreman: { select: { id: true, user: { select: { name: true } } } } },
    },
  } as const;

  const [
    missingScanOuts,
    manualAttendance,
    earlySignOuts,
    pendingApprovals,
    rejectedEnrollments,
    pendingFaceApprovals,
  ] = await Promise.all([
      prisma.attendanceScan.findMany({
        where: { ...dayWhere, direction: "IN", scannedOutAt: null },
        select: scanSelect,
        orderBy: { scannedAt: "asc" },
      }),
      prisma.attendanceScan.findMany({
        where: { ...dayWhere, scanType: "MANUAL" },
        select: scanSelect,
        orderBy: { scannedAt: "asc" },
      }),
      prisma.attendanceScan.findMany({
        where: { ...dayWhere, hasEarlySignOut: true },
        select: scanSelect,
        orderBy: { scannedAt: "asc" },
      }),
      prisma.fingerprintEnrollment.findMany({
        where: { status: "PENDING_APPROVAL" },
        orderBy: { enrolledAt: "asc" },
        take: 200,
        select: {
          id: true,
          enrolledAt: true,
          employee: { select: { id: true, firstName: true, lastName: true } },
          enrolledByForeman: { select: { id: true, user: { select: { name: true } } } },
        },
      }),
      prisma.fingerprintEnrollment.findMany({
        where: { status: "REJECTED" },
        orderBy: { approvedAt: "desc" },
        take: 100,
        select: {
          id: true,
          approvedAt: true,
          rejectedReason: true,
          employee: { select: { id: true, firstName: true, lastName: true } },
          enrolledByForeman: { select: { id: true, user: { select: { name: true } } } },
        },
      }),
      prisma.faceEnrollment.findMany({
        where: { status: "PENDING_APPROVAL" },
        orderBy: { enrolledAt: "asc" },
        take: 200,
        select: {
          id: true,
          pose: true,
          imageUrl: true,
          qualityScore: true,
          enrolledAt: true,
          employee: { select: { id: true, firstName: true, lastName: true } },
          enrolledByForeman: { select: { id: true, user: { select: { name: true } } } },
        },
      }),
    ]);

  const mapScan = (s: (typeof missingScanOuts)[number]) => ({
    id: s.id,
    employeeName: `${s.employee.firstName} ${s.employee.lastName}`.trim(),
    employeeCode: s.employee.qrCodeValue,
    siteId: s.site.id,
    siteName: s.site.name,
    siteCode: s.site.code,
    foremanName: s.siteDay.foreman.user.name ?? "Unknown",
    scannedAtISO: s.scannedAt.toISOString(),
    scannedOutAtISO: s.scannedOutAt?.toISOString() ?? null,
    scanType: s.scanType,
    manualReason: s.manualReason,
    verificationStatus: s.verificationStatus,
    earlySignOutReasonLabel: s.earlySignOutReasonLabel,
  });

  return NextResponse.json({
    dateISO: isoFromDateUTC(targetDate),
    missingScanOuts: missingScanOuts.map(mapScan),
    manualAttendance: manualAttendance.map(mapScan),
    earlySignOuts: earlySignOuts.map(mapScan),
    pendingFingerprintApproval: pendingApprovals.map((e) => ({
      id: e.id,
      employeeId: e.employee.id,
      employeeName: `${e.employee.firstName} ${e.employee.lastName}`.trim(),
      foremanName: e.enrolledByForeman.user.name ?? "Unknown",
      enrolledAtISO: e.enrolledAt.toISOString(),
    })),
    rejectedFingerprints: rejectedEnrollments.map((e) => ({
      id: e.id,
      employeeId: e.employee.id,
      employeeName: `${e.employee.firstName} ${e.employee.lastName}`.trim(),
      foremanName: e.enrolledByForeman.user.name ?? "Unknown",
      rejectedReason: e.rejectedReason,
      rejectedAtISO: e.approvedAt?.toISOString() ?? null,
    })),
    pendingFaceApproval: pendingFaceApprovals.map((e) => ({
      id: e.id,
      employeeId: e.employee.id,
      employeeName: `${e.employee.firstName} ${e.employee.lastName}`.trim(),
      pose: e.pose,
      imageUrl: e.imageUrl,
      qualityScore: e.qualityScore,
      foremanName: e.enrolledByForeman.user.name ?? "Unknown",
      enrolledAtISO: e.enrolledAt.toISOString(),
    })),
  });
}
