import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireServerAuth } from "@/lib/auth-server";
import { toISODate } from "@/lib/workdate";
import { addDaysUTC, isoFromDateUTC } from "@/lib/dateUtc";
import { getFortnightForDateUTC } from "@/lib/timesheetPeriods";
import { logApiRequest } from "@/lib/apiRequestLogger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 1800;

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
};

export async function GET(req: Request) {
  try {
    const auth = await requireServerAuth();
    if (auth.role !== "ADMIN") {
      const res = NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: CACHE_HEADERS },
      );
      logApiRequest("/api/app/admin/dashboard", req.method, res.status);
      return res;
    }

    const [
      metrics,
      weeklyAttendance,
      fortnightSiteWages,
      siteActivity,
      photoVerification,
      recent,
    ] = await Promise.all([
      getDashboardMetrics(),
      getWeeklyAttendanceData(),
      getFortnightSiteWages(),
      getSiteActivityData(),
      getPhotoVerificationData(),
      getRecentActivity(),
    ]);

    const res = NextResponse.json(
      {
        metrics,
        weeklyAttendance,
        topSiteWages: fortnightSiteWages.sites.slice(0, 5),
        fortnightSiteWages,
        siteActivity,
        photoVerification,
        recentActivity: recent,
      },
      { headers: CACHE_HEADERS },
    );
    logApiRequest("/api/app/admin/dashboard", req.method, res.status);
    return res;
  } catch (error) {
    console.error("Admin dashboard aggregate API error:", error);
    const res = NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
    logApiRequest("/api/app/admin/dashboard", req.method, res.status);
    return res;
  }
}

async function getDashboardMetrics() {
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

async function getWeeklyAttendanceData() {
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

  const [scanGroups, siteDayGroups] = await Promise.all([
    prisma.attendanceScan.groupBy({
      by: ["workDate"],
      where: {
        workDate: { gte: weekStart, lt: weekEndExclusive },
      },
      _count: { _all: true },
    }),
    prisma.siteDay.groupBy({
      by: ["workDate"],
      where: {
        workDate: { gte: weekStart, lt: weekEndExclusive },
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

async function getFortnightSiteWages() {
  // Determine current fortnight range
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const year = today.getUTCFullYear();
  const yearRow = await prisma.timesheetYear.findUnique({
    where: { year },
    select: { anchorSat: true },
  });

  let fnStart: Date;
  let fnEnd: Date;
  if (yearRow?.anchorSat) {
    const fortnight = getFortnightForDateUTC(today, yearRow.anchorSat);
    fnStart = fortnight.startDate;
    fnEnd = addDaysUTC(fortnight.startDate, 14);
  } else {
    const backToSat = (today.getUTCDay() + 1) % 7;
    fnStart = addDaysUTC(today, -backToSat);
    fnEnd = addDaysUTC(fnStart, 14);
  }

  // Sum dayRateAtScan from attendance scans grouped by site for the full fortnight.
  const [rows, scans] = await Promise.all([
    prisma.attendanceScan.groupBy({
      by: ["siteId"],
      where: {
        workDate: { gte: fnStart, lt: fnEnd },
      },
      _sum: { dayRateAtScan: true },
      orderBy: { _sum: { dayRateAtScan: "desc" } },
    }),
    prisma.attendanceScan.findMany({
      where: {
        workDate: { gte: fnStart, lt: fnEnd },
      },
      select: {
        employeeId: true,
        workDate: true,
        siteDay: { select: { foremanId: true } },
      },
    }),
  ]);

  const foremanIds = Array.from(
    new Set(scans.map((scan) => scan.siteDay.foremanId)),
  );
  const foremanRecords =
    foremanIds.length > 0
      ? await prisma.foreman.findMany({
          where: { id: { in: foremanIds } },
          select: {
            id: true,
            user: { select: { employee: { select: { id: true } } } },
          },
        })
      : [];
  const foremanIdToEmployeeId = new Map<string, string>();
  for (const foreman of foremanRecords) {
    if (foreman.user?.employee?.id) {
      foremanIdToEmployeeId.set(foreman.id, foreman.user.employee.id);
    }
  }

  const foremanDayPairs = new Set<string>();
  const manDayPairs = new Set<string>();
  for (const scan of scans) {
    const foremanId = scan.siteDay.foremanId;
    const dateISO = toISODate(scan.workDate);
    const pairKey = `${scan.employeeId}-${dateISO}`;
    const foremanEmployeeId = foremanIdToEmployeeId.get(foremanId) ?? foremanId;

    if (scan.employeeId === foremanEmployeeId) {
      foremanDayPairs.add(pairKey);
    } else {
      manDayPairs.add(pairKey);
    }
  }

  if (rows.length === 0) {
    return {
      startISO: toISODate(fnStart),
      endISO: toISODate(addDaysUTC(fnEnd, -1)),
      foremanDays: foremanDayPairs.size,
      manDays: manDayPairs.size,
      sites: [],
    };
  }

  const siteIds = rows.map((r) => r.siteId).filter(Boolean);
  const sites = await prisma.site.findMany({
    where: { id: { in: siteIds } },
    select: { id: true, code: true, name: true },
  });
  const siteMap = new Map(sites.map((s) => [s.id, s]));

  return {
    startISO: toISODate(fnStart),
    endISO: toISODate(addDaysUTC(fnEnd, -1)),
    foremanDays: foremanDayPairs.size,
    manDays: manDayPairs.size,
    sites: rows
      .map((r) => ({
        code: siteMap.get(r.siteId)?.code ?? null,
        site: siteMap.get(r.siteId)?.name ?? "Unknown",
        wages: Number(r._sum.dayRateAtScan ?? 0),
      }))
      .filter((r) => r.wages > 0),
  };
}

async function getSiteActivityData() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const year = today.getUTCFullYear();
  const yearRow = await prisma.timesheetYear.findUnique({
    where: { year },
    select: { anchorSat: true },
  });

  let fnStart: Date;
  let fnEnd: Date;
  if (yearRow?.anchorSat) {
    const fortnight = getFortnightForDateUTC(today, yearRow.anchorSat);
    fnStart = fortnight.startDate;
    fnEnd = addDaysUTC(fortnight.startDate, 14);
  } else {
    const backToSat = (today.getUTCDay() + 1) % 7;
    fnStart = addDaysUTC(today, -backToSat - 7);
    fnEnd = addDaysUTC(fnStart, 14);
  }

  // Group attendance scans by site within the current fortnight
  const scanGroups = await prisma.attendanceScan.groupBy({
    by: ["siteId"],
    where: {
      workDate: { gte: fnStart, lt: fnEnd },
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

async function getPhotoVerificationData() {
  const currentYear = new Date().getFullYear();
  const data: { month: string; verified: number; flagged: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const date = new Date(currentYear, i, 1);
    const month = date.toLocaleDateString("en-US", { month: "short" });
    const monthStart = new Date(currentYear, i, 1);
    const monthEnd = new Date(currentYear, i + 1, 0);

    const [verified, flagged] = await Promise.all([
      prisma.photoVerification.count({
        where: {
          status: "VERIFIED",
          verifiedAt: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
      }),
      prisma.photoVerification.count({
        where: {
          status: "FLAGGED",
          verifiedAt: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
      }),
    ]);

    data.push({ month, verified, flagged });
  }

  return data;
}

async function getRecentActivity() {
  const limit = 8;

  const events = await prisma.auditEvent.findMany({
    where: {
      action: {
        in: [
          "TIMESHEET_SUBMITTED",
          "TIMESHEET_APPROVED",
          "TIMESHEET_REJECTED",
          "TIMESHEET_PAID",
          "EMPLOYEE_CREATED",
          "SITE_CREATED",
          "PHOTO_VERIFIED",
          "PHOTO_FLAGGED",
        ],
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      metadata: true,
      createdAt: true,
    },
  });

  return events.map((e) => {
    const kind = e.action as
      | "TIMESHEET_SUBMITTED"
      | "TIMESHEET_APPROVED"
      | "TIMESHEET_REJECTED"
      | "TIMESHEET_PAID"
      | "EMPLOYEE_CREATED"
      | "SITE_CREATED"
      | "PHOTO_VERIFIED"
      | "PHOTO_FLAGGED";
    const md = (e.metadata ?? {}) as any;

    return {
      id: `audit:${e.id}`,
      kind,
      title: String(md.title ?? "Recent activity"),
      description: String(md.description ?? ""),
      at: e.createdAt.toISOString(),
      href: md.href ?? null,
    };
  });
}
