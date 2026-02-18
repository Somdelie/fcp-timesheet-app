import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { toISODate } from "@/lib/workdate";
import { addDaysUTC, isoFromDateUTC } from "@/lib/dateUtc";
import { getFortnightForDateUTC } from "@/lib/timesheetPeriods";
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
                "public, s-maxage=60, stale-while-revalidate=300",
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
                "public, s-maxage=60, stale-while-revalidate=300",
            },
          }),
        );
      case "timesheet-status":
        return withLog(
          req,
          NextResponse.json(await getTimesheetStatusData(auth), {
            headers: {
              ...corsHeaders,
              "Cache-Control":
                "public, s-maxage=60, stale-while-revalidate=300",
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
                "public, s-maxage=60, stale-while-revalidate=300",
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
                "public, s-maxage=60, stale-while-revalidate=300",
            },
          }),
        );
      case "all":
        const [
          metrics,
          weeklyAttendance,
          timesheetStatus,
          siteActivity,
          photoVerification,
        ] = await Promise.all([
          getDashboardMetrics(auth),
          getWeeklyAttendanceData(auth),
          getTimesheetStatusData(auth),
          getSiteActivityData(auth),
          getPhotoVerificationData(auth),
        ]);
        return withLog(
          req,
          NextResponse.json(
            {
              metrics,
              weeklyAttendance,
              timesheetStatus,
              siteActivity,
              photoVerification,
            },
            {
              headers: {
                ...corsHeaders,
                "Cache-Control":
                  "public, s-maxage=60, stale-while-revalidate=300",
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

  let weekStart: Date;
  if (yearRow?.anchorSat) {
    const fortnight = getFortnightForDateUTC(today, yearRow.anchorSat);
    const week2Start = addDaysUTC(fortnight.startDate, 7);
    weekStart =
      today.getTime() >= week2Start.getTime()
        ? week2Start
        : fortnight.startDate;
  } else {
    const backToSat = (today.getUTCDay() + 1) % 7;
    weekStart = addDaysUTC(today, -backToSat);
  }

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

async function getTimesheetStatusData(auth: { sub: string; role: string }) {
  let foremanFilter: any = {};
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

    if (foremanIds.length > 0) {
      foremanFilter = { foremanId: { in: foremanIds } };
    } else {
      return [
        { status: "Submitted", count: 0 },
        { status: "Approved", count: 0 },
        { status: "Rejected", count: 0 },
        { status: "Paid", count: 0 },
      ];
    }
  }

  const [submitted, approved, rejected, paid] = await Promise.all([
    prisma.timesheet.count({
      where: { status: "SUBMITTED", ...foremanFilter },
    }),
    prisma.timesheet.count({ where: { status: "APPROVED", ...foremanFilter } }),
    prisma.timesheet.count({ where: { status: "REJECTED", ...foremanFilter } }),
    prisma.timesheet.count({ where: { status: "PAID", ...foremanFilter } }),
  ]);

  return [
    { status: "Submitted", count: submitted },
    { status: "Approved", count: approved },
    { status: "Rejected", count: rejected },
    { status: "Paid", count: paid },
  ];
}

async function getSiteActivityData(auth: { sub: string; role: string }) {
  let siteFilter: any = { isActive: true };
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
    if (siteIds.length > 0) {
      siteFilter = { ...siteFilter, id: { in: siteIds } };
    } else {
      return [];
    }
  }

  const sites = await prisma.site.findMany({
    where: siteFilter,
    take: 5,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          siteDays: true,
          attendanceScans: true,
        },
      },
    },
  });

  return sites.map((site) => ({
    site: site.name,
    workers: site._count.attendanceScans,
    photos: 0,
  }));
}

async function getPhotoVerificationData(auth: { sub: string; role: string }) {
  const data = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const month = date.toLocaleDateString("en-US", { month: "short" });
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

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
