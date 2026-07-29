import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { currentFortnightSatFri } from "@/lib/fortnight";
import { startOfDayUTC, addDaysUTC, decimalToNumber } from "@/lib/dateUtc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

async function getAuth(req: Request) {
  let userId: string | null = null;
  let role: string | null = null;

  const token = getBearer(req);
  if (token) {
    const payload = await verifyApiToken(token);
    if (!payload) return { userId: null, role: null };
    userId = payload.sub;
    role = payload.role;
  } else {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    userId = user?.id ?? null;
    role = user?.role ?? null;
  }

  return { userId, role };
}

export async function GET(req: Request) {
  const { userId, role } = await getAuth(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "SUPERVISOR")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supervisor = await prisma.supervisor.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!supervisor)
    return NextResponse.json(
      { error: "Supervisor not found" },
      { status: 404 },
    );

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const show = (url.searchParams.get("show") ?? "active").trim().toLowerCase(); // active | all
  const dateISO = url.searchParams.get("dateISO");
  const now = new Date();

  // Active assignments for this supervisor
  const assignments = await prisma.supervisorSiteAssignment.findMany({
    where: {
      supervisorId: supervisor.id,
      startsOn: { lte: now },
      OR: [{ endsOn: null }, { endsOn: { gt: now } }],
    },
    select: { siteId: true },
  });

  const siteIds = Array.from(new Set(assignments.map((a) => a.siteId)));
  if (siteIds.length === 0) return NextResponse.json({ sites: [] });

  const sites = await prisma.site.findMany({
    where: {
      id: { in: siteIds },
      ...(show === "active" ? { isActive: true } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { code: { contains: q, mode: "insensitive" } },
              { location: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      code: true,
      location: true,
      isActive: true,
      foremanAssignments: {
        where: {
          startsOn: { lte: now },
          OR: [{ endsOn: null }, { endsOn: { gt: now } }],
        },
        select: { id: true },
      },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  // Calculate total wages for each site for the current fortnight
  const ft = currentFortnightSatFri(new Date());
  const start = startOfDayUTC(ft.startISO);
  const end = startOfDayUTC(ft.endISO);
  const endExclusive = addDaysUTC(end, 1);

  const wagesBysite = await prisma.attendanceScan.groupBy({
    by: ["siteId"],
    where: {
      siteId: { in: sites.map((s) => s.id) },
      workDate: { gte: start, lt: endExclusive },
    },
    _sum: { dayRateAtScan: true },
  });

  const wagesMap = new Map(
    wagesBysite.map((w) => [w.siteId, decimalToNumber(w._sum.dayRateAtScan)]),
  );

  // Optionally compute how many attendance scans each site has on a specific
  // work date (used by the mobile app to only list sites with scans to move/delete).
  let scanCountMap: Map<string, number> | null = null;
  if (dateISO) {
    const dayStart = startOfDayUTC(dateISO);
    const dayEnd = addDaysUTC(dayStart, 1);

    const scanCountsBySite = await prisma.attendanceScan.groupBy({
      by: ["siteId"],
      where: {
        siteId: { in: sites.map((s) => s.id) },
        workDate: { gte: dayStart, lt: dayEnd },
      },
      _count: { id: true },
    });

    scanCountMap = new Map(
      scanCountsBySite.map((c) => [c.siteId, c._count.id]),
    );
  }

  return NextResponse.json({
    sites: sites.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      location: s.location,
      isActive: s.isActive,
      foremenCount: s.foremanAssignments.length,
      totalWages: wagesMap.get(s.id) ?? 0,
      ...(scanCountMap ? { scanCount: scanCountMap.get(s.id) ?? 0 } : {}),
    })),
  });
}
