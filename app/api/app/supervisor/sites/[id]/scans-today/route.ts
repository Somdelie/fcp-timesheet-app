import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isoFromDateUTC, startOfDayUTC } from "@/lib/dateUtc";

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

/**
 * GET /api/app/supervisor/sites/[id]/scans-today
 *
 * Returns today's attendance scans for a site, including employee details.
 * Used by supervisors to see who is on site and enable employee transfers.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { userId, role } = await getAuth(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Allow SUPERVISOR and ADMIN
  if (role !== "SUPERVISOR" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: siteId } = await ctx.params;

  // If supervisor, verify access to this site
  if (role === "SUPERVISOR") {
    const sup = await prisma.supervisor.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!sup)
      return NextResponse.json(
        { error: "Supervisor not found" },
        { status: 404 },
      );

    const now = new Date();
    const access = await prisma.supervisorSiteAssignment.findFirst({
      where: {
        supervisorId: sup.id,
        siteId,
        startsOn: { lte: now },
        OR: [{ endsOn: null }, { endsOn: { gt: now } }],
      },
      select: { id: true },
    });
    if (!access)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const todayISO = isoFromDateUTC(new Date());
  const today = startOfDayUTC(todayISO);
  const now = new Date();

  // Fetch foremen currently assigned to this site
  const foremanAssignments = await prisma.foremanSiteAssignment.findMany({
    where: {
      siteId,
      startsOn: { lte: now },
      OR: [{ endsOn: null }, { endsOn: { gt: now } }],
    },
    select: {
      foremanId: true,
      foreman: {
        select: {
          id: true,
          user: { select: { name: true } },
        },
      },
    },
  });

  // Fetch today's attendance scans for this site
  const scans = await prisma.attendanceScan.findMany({
    where: {
      siteId,
      workDate: today,
    },
    select: {
      id: true,
      employeeId: true,
      scannedAt: true,
      scannedOutAt: true,
      direction: true,
      dayRateAtScan: true,
      scanType: true,
      transferredFromSiteId: true,
      transferredAt: true,
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          qrCodeValue: true,
          faceImageUrl: true,
        },
      },
    },
    orderBy: { scannedAt: "asc" },
  });

  return NextResponse.json({
    ok: true,
    dateISO: todayISO,
    siteId,
    foremen: foremanAssignments.map((fa) => ({
      id: fa.foreman.id,
      name: fa.foreman.user?.name ?? "Unknown",
    })),
    scans: scans.map((s) => ({
      id: s.id,
      employeeId: s.employeeId,
      employeeName: `${s.employee.firstName} ${s.employee.lastName}`.trim(),
      employeeCode: s.employee.qrCodeValue,
      employeePhotoUrl: s.employee.faceImageUrl,
      scannedAt: s.scannedAt.toISOString(),
      scannedOutAt: s.scannedOutAt?.toISOString() ?? null,
      isScannedOut: !!s.scannedOutAt,
      direction: s.direction,
      dayRate: s.dayRateAtScan.toString(),
      scanType: s.scanType,
      isTransferred: !!s.transferredFromSiteId,
      transferredFromSiteId: s.transferredFromSiteId,
      transferredAt: s.transferredAt?.toISOString() ?? null,
    })),
    totalScans: scans.length,
    scannedInCount: scans.filter((s) => !s.scannedOutAt).length,
    scannedOutCount: scans.filter((s) => !!s.scannedOutAt).length,
  });
}
