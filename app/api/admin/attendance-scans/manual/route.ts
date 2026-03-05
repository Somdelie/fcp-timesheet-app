import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeDayRateAtScan } from "@/lib/employeeDayRate";
import { startOfDayUTC } from "@/lib/dateUtc";
import { writeAuditEvent } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/attendance-scans/manual?date=YYYY-MM-DD
 *
 * Returns the list of employee IDs that already have an attendance scan for
 * the given date, so the UI can exclude them from the employee picker.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const dateStr = url.searchParams.get("date");

  if (!dateStr) {
    return NextResponse.json(
      { error: "date query param is required (YYYY-MM-DD)" },
      { status: 400 },
    );
  }

  let date: Date;
  try {
    date = startOfDayUTC(dateStr);
  } catch {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  try {
    const scans = await prisma.attendanceScan.findMany({
      where: { workDate: date },
      select: { employeeId: true },
    });

    const scannedEmployeeIds = scans.map((s) => s.employeeId);
    return NextResponse.json({ scannedEmployeeIds });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/attendance-scans/manual
 *
 * Admin-only endpoint to create an attendance scan for a previous (or current)
 * day on behalf of a foreman. This handles cases where an employee wasn't
 * scanned (e.g. foreman forgot).
 *
 * Body: { siteId, foremanId, employeeId, workDate (YYYY-MM-DD), reason? }
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { siteId, foremanId, employeeId, workDate: workDateStr, reason } = body;

  if (!siteId || !foremanId || !employeeId || !workDateStr) {
    return NextResponse.json(
      { error: "siteId, foremanId, employeeId, and workDate are required" },
      { status: 400 },
    );
  }

  // Parse and validate workDate (UTC midnight to match the rest of the codebase)
  let workDate: Date;
  try {
    workDate = startOfDayUTC(workDateStr);
  } catch {
    return NextResponse.json(
      { error: "Invalid workDate format. Use YYYY-MM-DD." },
      { status: 400 },
    );
  }

  // Don't allow future dates
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (workDate > today) {
    return NextResponse.json(
      { error: "Cannot create scans for future dates." },
      { status: 400 },
    );
  }

  try {
    // Verify site exists
    const site = await prisma.site.findUnique({
      where: { id: siteId },
      select: { id: true, name: true },
    });
    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    // Verify foreman exists
    const foreman = await prisma.foreman.findUnique({
      where: { id: foremanId },
      select: {
        id: true,
        user: { select: { id: true, name: true } },
      },
    });
    if (!foreman) {
      return NextResponse.json({ error: "Foreman not found" }, { status: 404 });
    }

    // Verify employee exists and is active
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        isActive: true,
        qrCodeValue: true,
        userId: true,
      },
    });
    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }
    if (!employee.isActive) {
      return NextResponse.json(
        {
          error: `Employee ${employee.firstName} ${employee.lastName} is deactivated.`,
        },
        { status: 409 },
      );
    }

    // Check if employee is already scanned for this date
    const existingScan = await prisma.attendanceScan.findFirst({
      where: { employeeId, workDate },
      select: { id: true },
    });
    if (existingScan) {
      return NextResponse.json(
        { error: "Employee already has a scan for this date." },
        { status: 409 },
      );
    }

    // Get company default day rate
    // (not needed directly — computeDayRateAtScan fetches settings internally)

    // Resolve the effective day rate using the new team-based logic
    const rateResult = await computeDayRateAtScan({
      employeeId: employee.id,
      foremanId,
      siteId,
      workDate,
    });

    const effectiveRate = rateResult.dayRate;

    // Get or create SiteDay for this foreman/site/date
    let siteDay = await prisma.siteDay.findFirst({
      where: { siteId, foremanId, workDate },
      select: { id: true },
    });

    if (!siteDay) {
      try {
        siteDay = await prisma.siteDay.create({
          data: {
            site: { connect: { id: siteId } },
            foreman: { connect: { id: foremanId } },
            workDate,
          },
          select: { id: true },
        });
      } catch (e: any) {
        if (e?.code === "P2002") {
          // Race condition - try to find again
          siteDay = await prisma.siteDay.findFirst({
            where: { siteId, foremanId, workDate },
            select: { id: true },
          });
          if (!siteDay) {
            return NextResponse.json(
              { error: "Failed to create site day." },
              { status: 500 },
            );
          }
        } else {
          throw e;
        }
      }
    }

    // Create the attendance scan
    const scan = await prisma.attendanceScan.create({
      data: {
        siteDay: { connect: { id: siteDay.id } },
        employee: { connect: { id: employee.id } },
        workDate,
        site: { connect: { id: siteId } },
        dayRateAtScan: effectiveRate as any,
        team: rateResult.team,
        qrPayload: employee.qrCodeValue ?? null,
        scanType: "MANUAL",
        manualReason:
          reason || `Admin manual scan by ${user.name || user.email}`,
      },
      select: { id: true, scannedAt: true },
    });

    // Log audit event for recent activity
    const employeeName = `${employee.firstName} ${employee.lastName}`.trim();
    await writeAuditEvent({
      actorUserId: user.id,
      action: "MANUAL_SCAN",
      entity: "AttendanceScan",
      entityId: scan.id,
      metadata: {
        title: "Manual scan created",
        description: `${employeeName} scanned at ${site.name} (${foreman.user.name}) for ${workDateStr}`,
        employeeId: employee.id,
        employeeName,
        siteId: site.id,
        siteName: site.name,
        foremanId: foreman.id,
        foremanName: foreman.user.name,
        workDate: workDateStr,
        reason: reason || null,
        href: "/admin/attendance-scans",
      },
    });

    return NextResponse.json({
      ok: true,
      scan: {
        id: scan.id,
        scannedAt: scan.scannedAt.toISOString(),
        employee: {
          id: employee.id,
          fullName: `${employee.firstName} ${employee.lastName}`.trim(),
        },
        site: site.name,
        foreman: foreman.user.name,
        workDate: workDateStr,
      },
    });
  } catch (err: any) {
    console.error("[admin-manual-scan] Error:", err);
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "Employee already has a scan for this date." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 },
    );
  }
}
