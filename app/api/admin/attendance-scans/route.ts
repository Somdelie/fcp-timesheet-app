import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDaysUTC, startOfDayUTC } from "@/lib/dateUtc";
import { currentFortnightSatFri } from "@/lib/fortnight";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: CORS_HEADERS },
    );
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: CORS_HEADERS },
    );
  }

  const url = new URL(req.url);
  const siteId = url.searchParams.get("siteId") || null;
  const foremanId = url.searchParams.get("foremanId") || null;
  const supervisorId = url.searchParams.get("supervisorId") || null;
  const q = (url.searchParams.get("q") || "").trim();
  const dateStr = url.searchParams.get("date"); // YYYY-MM-DD
  const fromStr = url.searchParams.get("from"); // YYYY-MM-DD
  const toStr = url.searchParams.get("to"); // YYYY-MM-DD

  const now = new Date();

  // Default to the current fortnight so attendance review matches timesheets.
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const currentFortnight = currentFortnightSatFri(now);
  const defaultStart = startOfDayUTC(currentFortnight.startISO);
  const defaultEnd = startOfDayUTC(currentFortnight.endISO);

  // ── Resolve supervisor → site IDs at DB level ──────────────────────
  let supervisorSiteIds: string[] | null = null;
  if (supervisorId) {
    const assignments = await prisma.supervisorSiteAssignment.findMany({
      where: {
        supervisorId,
        startsOn: { lte: now },
        OR: [{ endsOn: null }, { endsOn: { gt: now } }],
      },
      select: { siteId: true },
    });
    supervisorSiteIds = assignments.map((a) => a.siteId);
  }

  // ── Build DB where clause ───────────────────────────────────────────
  const whereClause: any = {
    workDate: { gte: defaultStart, lt: addDaysUTC(defaultEnd, 1) },
  };

  if (fromStr || toStr) {
    const from = fromStr ? startOfDayUTC(fromStr) : defaultStart;
    const to = toStr ? startOfDayUTC(toStr) : defaultEnd;
    whereClause.workDate = { gte: from, lt: addDaysUTC(to, 1) };
  } else if (dateStr) {
    const targetDate = new Date(`${dateStr}T00:00:00.000Z`);
    const nextDay = addDaysUTC(targetDate, 1);
    whereClause.workDate = { gte: targetDate, lt: nextDay };
  }

  // Site filter: if both supervisor and explicit site are set, use explicit site
  // (the supervisor check below will validate it belongs to the supervisor)
  if (siteId) {
    whereClause.siteId = siteId;
  } else if (supervisorSiteIds !== null) {
    // No explicit site filter — restrict to supervisor's sites
    whereClause.siteId = { in: supervisorSiteIds };
  }

  if (foremanId) {
    whereClause.siteDay = { foremanId };
  }

  if (q) {
    const terms = q.split(/\s+/).filter(Boolean);
    whereClause.employee = {
      AND: terms.map((term) => ({
        OR: [
          { firstName: { contains: term, mode: "insensitive" } },
          { lastName: { contains: term, mode: "insensitive" } },
          { qrCodeValue: { contains: term, mode: "insensitive" } },
        ],
      })),
    };
  }

  const scans = await prisma.attendanceScan.findMany({
    where: whereClause,
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          qrCodeValue: true,
          faceImageUrl: true,
        },
      },
      site: {
        select: {
          id: true,
          name: true,
          supervisorAssignments: {
            where: {
              startsOn: { lte: now },
              OR: [{ endsOn: null }, { endsOn: { gt: now } }],
            },
            orderBy: { startsOn: "desc" },
            include: {
              supervisor: {
                include: {
                  user: { select: { id: true, name: true } },
                },
              },
            },
            take: 1,
          },
        },
      },
      siteDay: {
        select: {
          id: true,
          workDate: true,
          foreman: {
            select: {
              id: true,
              user: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { scannedAt: "desc" },
    take: 1500,
  });

  // ── Map to response format ──────────────────────────────────────────
  let result = scans.map((scan) => {
    const supervisorAssignment = scan.site.supervisorAssignments[0];
    return {
      id: scan.id,
      employeeId: scan.employee.id,
      employeeName:
        `${scan.employee.firstName} ${scan.employee.lastName}`.trim(),
      employeeCode: scan.employee.qrCodeValue,
      employeePhotoUrl: scan.employee.faceImageUrl ?? null,
      siteId: scan.site.id,
      siteName: scan.site.name,
      foremanId: scan.siteDay.foreman.id,
      foremanName: scan.siteDay.foreman.user.name ?? "Unknown",
      supervisorId: supervisorAssignment?.supervisor.id ?? null,
      supervisorName: supervisorAssignment?.supervisor.user.name ?? null,
      workDateISO: scan.workDate.toISOString(),
      scannedAtISO: scan.scannedAt.toISOString(),
      scanType: scan.scanType,
      overtimeType: scan.overtimeType,
      latitude: scan.latitude,
      longitude: scan.longitude,
      address: scan.address,
    };
  });

  // ── If explicit siteId + supervisorId: validate the site belongs to supervisor ─
  if (
    siteId &&
    supervisorSiteIds !== null &&
    !supervisorSiteIds.includes(siteId)
  ) {
    result = [];
  }

  // ── Build dropdown options from the full filtered result ────────────
  const sitesMap = new Map<string, string>();
  const foremenMap = new Map<string, string>();
  const supervisorsMap = new Map<string, string>();

  for (const scan of result) {
    sitesMap.set(scan.siteId, scan.siteName);
    foremenMap.set(scan.foremanId, scan.foremanName);
    if (scan.supervisorId && scan.supervisorName) {
      supervisorsMap.set(scan.supervisorId, scan.supervisorName);
    }
  }

  const sites = Array.from(sitesMap.entries()).map(([id, name]) => ({
    id,
    name,
  }));
  const foremen = Array.from(foremenMap.entries()).map(([id, name]) => ({
    id,
    name,
  }));
  const supervisors = Array.from(supervisorsMap.entries()).map(
    ([id, name]) => ({ id, name }),
  );

  return NextResponse.json(
    { scans: result, sites, foremen, supervisors },
    {
      headers: {
        ...CORS_HEADERS,
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: CORS_HEADERS },
    );
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: CORS_HEADERS },
    );
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Missing id" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  try {
    await prisma.attendanceScan.delete({ where: { id } });
    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
  } catch (e: any) {
    console.error("Error deleting attendance scan", e);
    return NextResponse.json(
      { error: "Failed to delete scan" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
