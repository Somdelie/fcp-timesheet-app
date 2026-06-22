import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeDayRateAtScan } from "@/lib/employeeDayRate";
import { startOfDayUTC } from "@/lib/dateUtc";
import { writeAuditEvent } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    return NextResponse.json({
      scannedEmployeeIds: scans.map((scan) => scan.employeeId),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 },
    );
  }
}

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

  const { siteId, foremanId, reason } = body;
  const employeeIds: string[] = Array.isArray(body.employeeIds)
    ? body.employeeIds.map(String).filter(Boolean)
    : body.employeeId
      ? [String(body.employeeId)]
      : [];
  const workDateStrings: string[] = Array.isArray(body.workDates)
    ? body.workDates.map(String).filter(Boolean)
    : body.workDate
      ? [String(body.workDate)]
      : [];

  if (
    !siteId ||
    !foremanId ||
    employeeIds.length === 0 ||
    workDateStrings.length === 0
  ) {
    return NextResponse.json(
      { error: "siteId, foremanId, employeeIds, and workDates are required" },
      { status: 400 },
    );
  }

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const parsedWorkDates: Array<{ label: string; date: Date }> = [];
  for (const workDateStr of Array.from(new Set(workDateStrings))) {
    try {
      const date = startOfDayUTC(workDateStr);
      if (date > today) {
        return NextResponse.json(
          { error: "Cannot create scans for future dates." },
          { status: 400 },
        );
      }
      parsedWorkDates.push({ label: workDateStr, date });
    } catch {
      return NextResponse.json(
        { error: "Invalid workDate format. Use YYYY-MM-DD." },
        { status: 400 },
      );
    }
  }

  try {
    const site = await prisma.site.findUnique({
      where: { id: String(siteId) },
      select: { id: true, name: true },
    });
    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    const foreman = await prisma.foreman.findUnique({
      where: { id: String(foremanId) },
      select: {
        id: true,
        user: { select: { id: true, name: true } },
      },
    });
    if (!foreman) {
      return NextResponse.json({ error: "Foreman not found" }, { status: 404 });
    }

    const uniqueEmployeeIds: string[] = Array.from(new Set(employeeIds));
    const employees = await prisma.employee.findMany({
      where: { id: { in: uniqueEmployeeIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        isActive: true,
        qrCodeValue: true,
        userId: true,
      },
    });

    if (employees.length !== uniqueEmployeeIds.length) {
      return NextResponse.json(
        { error: "One or more employees were not found." },
        { status: 404 },
      );
    }

    const inactiveEmployee = employees.find((employee) => !employee.isActive);
    if (inactiveEmployee) {
      return NextResponse.json(
        {
          error: `Employee ${inactiveEmployee.firstName} ${inactiveEmployee.lastName} is deactivated.`,
        },
        { status: 409 },
      );
    }

    const createdScans: any[] = [];
    const skipped: Array<{
      employeeId: string;
      employeeName: string;
      workDate: string;
      reason: string;
    }> = [];
    const siteDayByDate = new Map<string, { id: string }>();

    for (const workDateInfo of parsedWorkDates) {
      for (const employee of employees) {
        const employeeName = `${employee.firstName} ${employee.lastName}`.trim();
        const existingScan = await prisma.attendanceScan.findFirst({
          where: { employeeId: employee.id, workDate: workDateInfo.date },
          select: { id: true },
        });

        if (existingScan) {
          skipped.push({
            employeeId: employee.id,
            employeeName,
            workDate: workDateInfo.label,
            reason: "Already scanned for this date",
          });
          continue;
        }

        const rateResult = await computeDayRateAtScan({
          employeeId: employee.id,
          foremanId: String(foremanId),
          siteId: String(siteId),
          workDate: workDateInfo.date,
        });

        let siteDay: { id: string } | undefined = siteDayByDate.get(
          workDateInfo.label,
        );
        if (!siteDay) {
          const existingSiteDay = await prisma.siteDay.findFirst({
            where: {
              siteId: String(siteId),
              foremanId: String(foremanId),
              workDate: workDateInfo.date,
            },
            select: { id: true },
          });
          siteDay = existingSiteDay ?? undefined;

          if (!siteDay) {
            try {
              siteDay = await prisma.siteDay.create({
                data: {
                  site: { connect: { id: String(siteId) } },
                  foreman: { connect: { id: String(foremanId) } },
                  workDate: workDateInfo.date,
                },
                select: { id: true },
              });
            } catch (e: any) {
              if (e?.code === "P2002") {
                const racedSiteDay = await prisma.siteDay.findFirst({
                  where: {
                    siteId: String(siteId),
                    foremanId: String(foremanId),
                    workDate: workDateInfo.date,
                  },
                  select: { id: true },
                });
                siteDay = racedSiteDay ?? undefined;
                if (!siteDay) throw new Error("Failed to create site day.");
              } else {
                throw e;
              }
            }
          }

          siteDayByDate.set(workDateInfo.label, siteDay);
        }

        const scan = await prisma.attendanceScan.create({
          data: {
            siteDay: { connect: { id: siteDay.id } },
            employee: { connect: { id: employee.id } },
            workDate: workDateInfo.date,
            site: { connect: { id: String(siteId) } },
            dayRateAtScan: rateResult.dayRate as any,
            team: rateResult.team,
            qrPayload: employee.qrCodeValue ?? null,
            scanType: "MANUAL",
            manualReason:
              reason || `Admin manual scan by ${user.name || user.email}`,
          },
          select: { id: true, scannedAt: true },
        });

        await writeAuditEvent({
          actorUserId: user.id,
          action: "MANUAL_SCAN",
          entity: "AttendanceScan",
          entityId: scan.id,
          metadata: {
            title: "Manual scan created",
            description: `${employeeName} scanned at ${site.name} (${foreman.user.name}) for ${workDateInfo.label}`,
            employeeId: employee.id,
            employeeName,
            siteId: site.id,
            siteName: site.name,
            foremanId: foreman.id,
            foremanName: foreman.user.name,
            workDate: workDateInfo.label,
            reason: reason || null,
            href: "/admin/attendance-scans",
          },
        });

        createdScans.push({
          id: scan.id,
          scannedAt: scan.scannedAt.toISOString(),
          employee: { id: employee.id, fullName: employeeName },
          site: site.name,
          foreman: foreman.user.name,
          workDate: workDateInfo.label,
        });
      }
    }

    if (createdScans.length === 0) {
      return NextResponse.json(
        {
          error:
            skipped.length > 0
              ? "No scans created. Selected employees are already scanned for the selected dates."
              : "No scans were created.",
          skipped,
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      ok: true,
      scan: createdScans[0],
      scans: createdScans,
      skipped,
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
