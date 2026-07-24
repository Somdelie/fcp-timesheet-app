import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { toISODate } from "@/lib/workdate";
import { addDaysUTC, isoFromDateUTC } from "@/lib/dateUtc";
import {
  getCurrentFortnightRange,
  getCurrentWeekStart,
} from "@/lib/timesheetPeriods";
import { logApiRequest } from "@/lib/apiRequestLogger";

export const runtime = "nodejs";
export const revalidate = 60;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

async function getAuthFromRequest(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice(7);
  try {
    return await verifyApiToken(token);
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const auth = await getAuthFromRequest(req);
  if (!auth) {
    const res = NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: corsHeaders },
    );
    logApiRequest("/api/dashboard", req.method, res.status);
    return res;
  }

  const url = new URL(req.url);
  const dataType = url.searchParams.get("type") || "metrics";

  try {
    switch (dataType) {
      case "metrics":
        return withLog(
          req,
          NextResponse.json(await getDashboardMetrics(auth), {
            headers: {
              ...corsHeaders,
              "Cache-Control":
                "private, max-age=60",
            },
          }),
        );
      case "weekly-attendance":
        return withLog(
          req,
          NextResponse.json(await getWeeklyAttendanceData(auth), {
            headers: {
              ...corsHeaders,
              "Cache-Control":
                "private, max-age=60",
            },
          }),
        );
      case "timesheet-status":
        return withLog(
          req,
          NextResponse.json(await getTopSiteWages(auth), {
            headers: {
              ...corsHeaders,
              "Cache-Control":
                "private, max-age=60",
            },
          }),
        );
      case "site-activity":
        return withLog(
          req,
          NextResponse.json(await getSiteActivityData(auth), {
            headers: {
              ...corsHeaders,
              "Cache-Control":
                "private, max-age=60",
            },
          }),
        );
      case "photo-verification":
        return withLog(
          req,
          NextResponse.json(await getPhotoVerificationData(auth), {
            headers: {
              ...corsHeaders,
              "Cache-Control":
                "private, max-age=60",
            },
          }),
        );
      case "all":
        const [
          metrics,
          weeklyAttendance,
          topSiteWages,
          siteActivity,
          photoVerification,
        ] = await Promise.all([
          getDashboardMetrics(auth),
          getWeeklyAttendanceData(auth),
          getTopSiteWages(auth),
          getSiteActivityData(auth),
          getPhotoVerificationData(auth),
        ]);
        return withLog(
          req,
          NextResponse.json(
            {
              metrics,
              weeklyAttendance,
              topSiteWages,
              siteActivity,
              photoVerification,
            },
            {
              headers: {
                ...corsHeaders,
                "Cache-Control":
                  "private, max-age=60",
              },
            },
          ),
        );
      default:
        return withLog(
          req,
          NextResponse.json(
            { error: "Invalid type parameter" },
            { status: 400, headers: corsHeaders },
          ),
        );
    }
  } catch (error) {
    console.error("Dashboard API error:", error);
    return withLog(
      req,
      NextResponse.json(
        { error: "Internal server error" },
        { status: 500, headers: corsHeaders },
      ),
    );
  }
}

function withLog(req: Request, res: NextResponse) {
  logApiRequest("/api/dashboard", req.method, res.status);
  return res;
}

async function getDashboardMetrics(auth: { sub: string; role: string }) {
  const [totalEmployees, activeSites, totalForemen, totalSupervisors] =
    await Promise.all([
      prisma.employee.count({ where: { isActive: true } }),
      prisma.site.count({ where: { isActive: true } }),
      prisma.foreman.count(),
      prisma.supervisor.count(),
    ]);

  return {
    totalEmployees,
    activeSites,
    totalForemen,
    totalSupervisors,
  };
}

async function getWeeklyAttendanceData(auth: { sub: string; role: string }) {
  let supervisorSiteIds: string[] | null = null;
  if (auth.role === "SUPERVISOR") {
    const supervisor = await prisma.supervisor.findUnique({
      where: { userId: auth.sub },
      include: {
        siteAssignments: {
          where: {
            OR: [{ endsOn: null }, { endsOn: { gt: new Date() } }],
          },
          select: { siteId: true },
        },
      },
    });
    supervisorSiteIds = supervisor?.siteAssignments.map((a) => a.siteId) ?? [];
  }

  function weekdayShortUTC(d: Date) {
    const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return names[d.getUTCDay()] ?? "";
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const year = today.getUTCFullYear();
  const yearRow = await prisma.timesheetYear.findUnique({
    where: { year },
    select: { anchorSat: true },
  });

  const weekStart = getCurrentWeekStart(today, yearRow?.anchorSat);
  const weekEndExclusive = addDaysUTC(weekStart, 7);

  if (
    auth.role === "SUPERVISOR" &&
    (!supervisorSiteIds || supervisorSiteIds.length === 0)
  ) {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = addDaysUTC(weekStart, i);
      return { day: weekdayShortUTC(d), scans: 0, sites: 0 };
    });
  }

  const siteFilter =
    supervisorSiteIds && supervisorSiteIds.length > 0
      ? { siteId: { in: supervisorSiteIds } }
      : {};

  const [scanGroups, siteDayGroups] = await Promise.all([
    prisma.attendanceScan.groupBy({
      by: ["workDate"],
      where: {
        workDate: { gte: weekStart, lt: weekEndExclusive },
        ...siteFilter,
      },
      _count: { _all: true },
    }),
    prisma.siteDay.groupBy({
      by: ["workDate"],
      where: {
        workDate: { gte: weekStart, lt: weekEndExclusive },
        ...siteFilter,
      },
      _count: { _all: true },
    }),
  ]);

  const scansByIso = new Map<string, number>();
  for (const g of scanGroups) {
    const iso = isoFromDateUTC(g.workDate);
    scansByIso.set(iso, g._count._all);
  }

  const sitesByIso = new Map<string, number>();
  for (const g of siteDayGroups) {
    const iso = isoFromDateUTC(g.workDate);
    sitesByIso.set(iso, g._count._all);
  }

  return Array.from({ length: 7 }).map((_, i) => {
    const d = addDaysUTC(weekStart, i);
    const iso = toISODate(d);
    return {
      day: weekdayShortUTC(d),
      scans: scansByIso.get(iso) ?? 0,
      sites: sitesByIso.get(iso) ?? 0,
    };
  });
}

async function getTopSiteWages(auth: { sub: string; role: string }) {
  // Determine current fortnight range
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const year = today.getUTCFullYear();
  const yearRow = await prisma.timesheetYear.findUnique({
    where: { year },
    select: { anchorSat: true },
  });

  const { startDate: fnStart, endDate: fnEnd } = getCurrentFortnightRange(
    today,
    yearRow?.anchorSat,
  );

  let siteFilter: any = {};
  if (auth.role === "SUPERVISOR") {
    const supervisor = await prisma.supervisor.findUnique({
      where: { userId: auth.sub },
      select: {
        id: true,
        foremanLinks: {
          select: { foremanId: true },
        },
      },
    });

    const foremanIds =
      supervisor?.foremanLinks.map((link) => link.foremanId) ?? [];

    if (foremanIds.length === 0) return [];

    // Get sites assigned to these foremen
    const siteAssignments = await prisma.siteDay.findMany({
      where: {
        foremanId: { in: foremanIds },
        workDate: { gte: fnStart, lt: fnEnd },
      },
      select: { siteId: true },
      distinct: ["siteId"],
    });

    const siteIds = siteAssignments.map((s) => s.siteId);
    if (siteIds.length === 0) return [];

    siteFilter = { siteId: { in: siteIds } };
  }

  // Sum dayRateAtScan from attendance scans grouped by site (top 5)
  const rows = await prisma.attendanceScan.groupBy({
    by: ["siteId"],
    where: {
      workDate: { gte: fnStart, lt: fnEnd },
      ...siteFilter,
    },
    _sum: { dayRateAtScan: true },
    orderBy: { _sum: { dayRateAtScan: "desc" } },
    take: 5,
  });

  if (rows.length === 0) return [];

  const siteIds = rows.map((r) => r.siteId).filter(Boolean);
  const sites = await prisma.site.findMany({
    where: { id: { in: siteIds } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(sites.map((s) => [s.id, s.name]));

  return rows.map((r) => ({
    site: nameMap.get(r.siteId) ?? "Unknown",
    wages: Number(r._sum.dayRateAtScan ?? 0),
  }));
}

async function getSiteActivityData(auth: { sub: string; role: string }) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const year = today.getUTCFullYear();
  const yearRow = await prisma.timesheetYear.findUnique({
    where: { year },
    select: { anchorSat: true },
  });

  const { startDate: fnStart, endDate: fnEnd } = getCurrentFortnightRange(
    today,
    yearRow?.anchorSat,
  );

  // Scope to supervisor's sites if needed
  let siteIdFilter: string[] | undefined;
  if (auth.role === "SUPERVISOR") {
    const supervisor = await prisma.supervisor.findUnique({
      where: { userId: auth.sub },
      include: {
        siteAssignments: {
          where: {
            OR: [{ endsOn: null }, { endsOn: { gt: new Date() } }],
          },
          select: { siteId: true },
        },
      },
    });

    const siteIds = supervisor?.siteAssignments.map((a) => a.siteId) ?? [];
    if (siteIds.length === 0) return [];
    siteIdFilter = siteIds;
  }

  const scanGroups = await prisma.attendanceScan.groupBy({
    by: ["siteId"],
    where: {
      workDate: { gte: fnStart, lt: fnEnd },
      ...(siteIdFilter ? { siteId: { in: siteIdFilter } } : {}),
    },
    _count: { _all: true },
    orderBy: { _count: { siteId: "desc" } },
    take: 5,
  });

  if (scanGroups.length === 0) return [];

  const siteIds = scanGroups.map((g) => g.siteId);
  const sites = await prisma.site.findMany({
    where: { id: { in: siteIds } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(sites.map((s) => [s.id, s.name]));

  return scanGroups.map((g) => ({
    site: nameMap.get(g.siteId) ?? "Unknown",
    workers: g._count._all,
    photos: 0,
  }));
}

async function getPhotoVerificationData(auth: { sub: string; role: string }) {
  const currentYear = new Date().getFullYear();
  const data = [];
  for (let i = 0; i < 12; i++) {
    const date = new Date(currentYear, i, 1);
    const month = date.toLocaleDateString("en-US", { month: "short" });
    const monthStart = new Date(currentYear, i, 1);
    const monthEnd = new Date(currentYear, i + 1, 0);

    const [verified, flagged] = await Promise.all([
      prisma.photoVerification.count({
        where: {
          status: "VERIFIED",
          verifiedAt: { gte: monthStart, lte: monthEnd },
        },
      }),
      prisma.photoVerification.count({
        where: {
          status: "FLAGGED",
          verifiedAt: { gte: monthStart, lte: monthEnd },
        },
      }),
    ]);

    data.push({ month, verified, flagged });
  }

  return data;
}
