import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { computeDayRateAtScan } from "@/lib/employeeDayRate";
import { isoFromDateUTC, startOfDayUTC } from "@/lib/dateUtc";
import { validateSupervisorScanDate } from "@/lib/supervisorScanPeriod";
import { getAttendanceScanBlock } from "@/lib/attendanceScanBlocks";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

async function getAuth(req: Request) {
  const token = getBearer(req);
  if (token) {
    const payload = await verifyApiToken(token);
    if (!payload) return { userId: null, role: null };
    return { userId: payload.sub as string, role: payload.role as string };
  }
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  return { userId: user?.id ?? null, role: user?.role ?? null };
}

const BodySchema = z.object({
  employeeId: z.string().min(1),
  fromSiteId: z.string().min(1),
  toSiteId: z.string().min(1),
  toForemanId: z.string().min(1),
  workDateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reason: z.string().optional(),
});

/**
 * POST /api/app/supervisor/transfer-employee
 *
 * Transfer an employee from one site to another.
 * This is used by supervisors when they need to move a scanned-in employee
 * to a different site. The employee will be:
 * 1. Scanned out of the source site
 * 2. Scanned in at the destination site
 * 3. Can then be scanned out at the destination site at end of day
 *
 * Body: { employeeId, fromSiteId, toSiteId, reason? }
 * Returns: { ok: true, transfer: { ... } }
 */
export async function POST(req: Request) {
  const { userId, role } = await getAuth(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Allow SUPERVISOR and ADMIN roles to transfer employees
  if (role !== "SUPERVISOR" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = BodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const {
    employeeId,
    fromSiteId,
    toSiteId,
    toForemanId,
    workDateISO,
    reason,
  } = body.data;

  // Verify the employee exists
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, firstName: true, lastName: true, isActive: true },
  });

  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  if (!employee.isActive) {
    return NextResponse.json(
      { error: "Employee is deactivated" },
      { status: 409 },
    );
  }

  // Verify both sites exist and are active
  const [fromSite, toSite] = await Promise.all([
    prisma.site.findFirst({
      where: { id: fromSiteId, isActive: true },
      select: { id: true, name: true },
    }),
    prisma.site.findFirst({
      where: { id: toSiteId, isActive: true },
      select: { id: true, name: true },
    }),
  ]);

  if (!fromSite) {
    return NextResponse.json(
      { error: "Source site not found" },
      { status: 404 },
    );
  }
  if (!toSite) {
    return NextResponse.json(
      { error: "Destination site not found" },
      { status: 404 },
    );
  }

  const scanBlock = await getAttendanceScanBlock({
    siteId: toSiteId,
    employeeId,
  });
  if (scanBlock) {
    return NextResponse.json({ error: scanBlock.message }, { status: 409 });
  }

  // If the user is a supervisor, verify they have access to BOTH sites
  if (role === "SUPERVISOR") {
    const sup = await prisma.supervisor.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!sup) {
      return NextResponse.json(
        { error: "Supervisor profile not found" },
        { status: 404 },
      );
    }

    const now = new Date();
    const [fromAccess, toAccess] = await Promise.all([
      prisma.supervisorSiteAssignment.findFirst({
        where: {
          supervisorId: sup.id,
          siteId: fromSiteId,
          startsOn: { lte: now },
          OR: [{ endsOn: null }, { endsOn: { gt: now } }],
        },
        select: { id: true },
      }),
      prisma.supervisorSiteAssignment.findFirst({
        where: {
          supervisorId: sup.id,
          siteId: toSiteId,
          startsOn: { lte: now },
          OR: [{ endsOn: null }, { endsOn: { gt: now } }],
        },
        select: { id: true },
      }),
    ]);

    if (!fromAccess || !toAccess) {
      return NextResponse.json(
        { error: "You must be assigned to both sites to transfer employees" },
        { status: 403 },
      );
    }
  }

  const requestedDateISO = workDateISO ?? isoFromDateUTC(new Date());
  if (role === "SUPERVISOR") {
    const selectedDate = await validateSupervisorScanDate(requestedDateISO);
    if (!selectedDate.ok) {
      return NextResponse.json({ error: selectedDate.error }, { status: 400 });
    }
  }
  const workDate = startOfDayUTC(requestedDateISO);
  const now = new Date();

  // Find the existing scan at the source site for the selected work date.
  const existingScan = await prisma.attendanceScan.findFirst({
    where: {
      employeeId,
      siteId: fromSiteId,
      workDate,
    },
    select: {
      id: true,
      siteDayId: true,
      dayRateAtScan: true,
      team: true,
      scannedAt: true,
      siteDay: { select: { isLocked: true, foremanId: true } },
    },
  });

  if (!existingScan) {
    return NextResponse.json(
      {
        error: `Employee ${employee.firstName} ${employee.lastName} has not been scanned in at ${fromSite.name} on ${requestedDateISO}`,
      },
      { status: 404 },
    );
  }

  if (existingScan.siteDay.isLocked) {
    return NextResponse.json(
      { error: "This attendance day is locked and cannot be transferred." },
      { status: 409 },
    );
  }

  const isSameSiteMove = fromSiteId === toSiteId;
  if (isSameSiteMove && existingScan.siteDay.foremanId === toForemanId) {
    return NextResponse.json(
      {
        error: `Employee ${employee.firstName} ${employee.lastName} is already assigned to that foreman at ${fromSite.name}`,
      },
      { status: 409 },
    );
  }

  // Verify the selected foreman is assigned to the destination site
  const foremanAssignment = await prisma.foremanSiteAssignment.findFirst({
    where: {
      foremanId: toForemanId,
      siteId: toSiteId,
      startsOn: { lte: now },
      OR: [{ endsOn: null }, { endsOn: { gt: now } }],
    },
    select: {
      foremanId: true,
      foreman: { select: { user: { select: { name: true } } } },
    },
  });

  if (!foremanAssignment) {
    return NextResponse.json(
      { error: "Selected foreman is not assigned to the destination site" },
      { status: 409 },
    );
  }

  // Get or create a SiteDay for the destination site with the selected foreman
  let destinationSiteDay = await prisma.siteDay.findFirst({
    where: {
      siteId: toSiteId,
      foremanId: toForemanId,
      workDate,
    },
    select: { id: true, isLocked: true },
  });

  if (!destinationSiteDay) {
    try {
      destinationSiteDay = await prisma.siteDay.create({
        data: {
          site: { connect: { id: toSiteId } },
          foreman: { connect: { id: toForemanId } },
          workDate,
        },
        select: { id: true, isLocked: true },
      });
    } catch (e: any) {
      if (e?.code === "P2002") {
        destinationSiteDay = await prisma.siteDay.findFirst({
          where: {
            siteId: toSiteId,
            foremanId: toForemanId,
            workDate,
          },
          select: { id: true, isLocked: true },
        });
      }
      if (!destinationSiteDay) {
        return NextResponse.json(
          { error: "Failed to create site day at destination" },
          { status: 500 },
        );
      }
    }
  }
  if (destinationSiteDay.isLocked) {
    return NextResponse.json(
      { error: "The destination attendance day is locked." },
      { status: 409 },
    );
  }

  // Calculate day rate for the employee at the destination site
  const rateResult = await computeDayRateAtScan({
    employeeId,
    foremanId: toForemanId,
    siteId: toSiteId,
    workDate,
  });

  const toForemanName = foremanAssignment.foreman.user?.name ?? "the selected foreman";

  const outReason = isSameSiteMove
    ? `Reassigned to foreman ${toForemanName} at ${toSite.name}`
    : `Transferred to ${toSite.name}`;
  const inReason = isSameSiteMove
    ? `Reassigned from another foreman at ${fromSite.name}`
    : `Transferred from ${fromSite.name}`;

  // Perform the transfer in a transaction:
  // 1. Mark existing scan at source as scanned out
  // 2. Delete the existing scan (to free up the unique constraint on [employeeId, workDate])
  // 3. Create a new scan at the destination site
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Step 1: Mark the source scan as scanned out and record transfer info
      await tx.attendanceScan.update({
        where: { id: existingScan.id },
        data: {
          scannedOutAt: now,
          direction: "OUT",
          manualReason: reason ? `${outReason}: ${reason}` : outReason,
        },
      });

      // Step 2: Remove the unique constraint by deleting the old scan
      // We keep a record via the transfer fields on the new scan
      await tx.attendanceScan.delete({
        where: { id: existingScan.id },
      });

      // Step 3: Create scan at destination site
      const newScan = await tx.attendanceScan.create({
        data: {
          siteDay: { connect: { id: destinationSiteDay!.id } },
          employee: { connect: { id: employeeId } },
          workDate,
          site: { connect: { id: toSiteId } },
          dayRateAtScan: rateResult.dayRate,
          team: rateResult.team,
          scannedAt: now,
          scanType: "MANUAL",
          direction: "IN",
          manualReason: reason ? `${inReason}: ${reason}` : inReason,
          transferredFromSiteId: fromSiteId,
          transferredFromScanId: existingScan.id,
          transferredAt: now,
          transferredBy: { connect: { id: userId } },
        },
        select: {
          id: true,
          scannedAt: true,
          siteId: true,
          siteDayId: true,
          dayRateAtScan: true,
        },
      });

      return newScan;
    });

    const fullName = `${employee.firstName} ${employee.lastName}`.trim();

    return NextResponse.json({
      ok: true,
      transfer: {
        employeeId,
        employeeName: fullName,
        fromSiteId,
        fromSiteName: fromSite.name,
        toSiteId,
        toSiteName: toSite.name,
        newScanId: result.id,
        transferredAt: now.toISOString(),
        reason: reason ?? null,
        toForemanName,
        sameSite: isSameSiteMove,
      },
      message: isSameSiteMove
        ? `${fullName} reassigned to ${toForemanName} at ${toSite.name}`
        : `${fullName} transferred from ${fromSite.name} to ${toSite.name}`,
    });
  } catch (e: any) {
    console.error("Employee transfer error:", e);

    if (e?.code === "P2002") {
      return NextResponse.json(
        {
          error:
            "Employee already has an attendance record at the destination site today",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: e?.message ?? "Transfer failed" },
      { status: 500 },
    );
  }
}
