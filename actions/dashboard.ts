"use server";

import { requireServerAuth } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { toISODate } from "@/lib/workdate";
import { addDaysUTC, isoFromDateUTC } from "@/lib/dateUtc";
import { getFortnightForDateUTC } from "@/lib/timesheetPeriods";

export async function getDashboardMetrics() {
  const auth = await requireServerAuth();

  // Get counts
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

export async function getWeeklyAttendanceData() {
  const auth = await requireServerAuth();

  // If supervisor, limit to their assigned sites only.
  let supervisorSiteIds: string[] | null = null;
  if (auth.role === "SUPERVISOR") {
    const supervisor = await prisma.supervisor.findUnique({
      where: { userId: auth.userId },
      include: {
        siteAssignments: {
          where: {
            OR: [{ endsOn: null }, { endsOn: { gt: new Date() } }],
          },
          select: { siteId: true },
        },
      },
    });

    supervisorSiteIds =
      supervisor?.siteAssignments.map((a) => a.siteId) ?? ([] as string[]);
  }
  function weekdayShortUTC(d: Date) {
    const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return names[d.getUTCDay()] ?? "";
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Resolve the week window from the timesheet anchor (Sat->Fri).
  // If TimesheetYear is not configured, fall back to the most recent Saturday.
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
    // Most recent Saturday (UTC midnight)
    const backToSat = (today.getUTCDay() + 1) % 7; // Sat->0, Sun->1, Mon->2 ... Fri->6
    weekStart = addDaysUTC(today, -backToSat);
  }

  const weekEndExclusive = addDaysUTC(weekStart, 7);

  // If supervisor has no assigned sites, return the week window with zeros.
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

export async function getTimesheetStatusData() {
  const auth = await requireServerAuth();

  // For supervisors, only count timesheets for foremen they are linked to.
  let foremanFilter: any = {};
  if (auth.role === "SUPERVISOR") {
    const supervisor = await prisma.supervisor.findUnique({
      where: { userId: auth.userId },
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
      // No linked foremen: all counts are 0 for this supervisor.
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
    prisma.timesheet.count({
      where: { status: "APPROVED", ...foremanFilter },
    }),
    prisma.timesheet.count({
      where: { status: "REJECTED", ...foremanFilter },
    }),
    prisma.timesheet.count({
      where: { status: "PAID", ...foremanFilter },
    }),
  ]);

  return [
    { status: "Submitted", count: submitted },
    { status: "Approved", count: approved },
    { status: "Rejected", count: rejected },
    { status: "Paid", count: paid },
  ];
}

export async function getSiteActivityData() {
  const auth = await requireServerAuth();

  // Supervisors only see activity for sites they are assigned to.
  let siteFilter: any = { isActive: true };
  if (auth.role === "SUPERVISOR") {
    const supervisor = await prisma.supervisor.findUnique({
      where: { userId: auth.userId },
      include: {
        siteAssignments: {
          where: {
            OR: [{ endsOn: null }, { endsOn: { gt: new Date() } }],
          },
          select: { siteId: true },
        },
      },
    });

    const siteIds =
      supervisor?.siteAssignments.map((assignment) => assignment.siteId) ?? [];
    if (siteIds.length > 0) {
      siteFilter = { ...siteFilter, id: { in: siteIds } };
    } else {
      // No sites for this supervisor.
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
    photos: 0, // Adjust if you have photo counts
  }));
}

export async function getPhotoVerificationData() {
  const auth = await requireServerAuth();

  // Get all months of the current year starting from January
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
