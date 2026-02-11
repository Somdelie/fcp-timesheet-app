"use server";

import { requireServerAuth } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { toISODate } from "@/lib/workdate";

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
  const today = new Date();
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const data = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - (today.getDay() - (i + 1)));
    const dateISO = toISODate(date);

    const baseDateFilter = { workDate: new Date(`${dateISO}T00:00:00Z`) };

    const scansCount = await prisma.attendanceScan.count({
      where: {
        ...baseDateFilter,
        ...(supervisorSiteIds && supervisorSiteIds.length > 0
          ? { siteId: { in: supervisorSiteIds } }
          : {}),
      },
    });

    const sitesCount = await prisma.siteDay.count({
      where: {
        ...baseDateFilter,
        ...(supervisorSiteIds && supervisorSiteIds.length > 0
          ? { siteId: { in: supervisorSiteIds } }
          : {}),
      },
    });

    data.push({
      day: dayLabels[i],
      scans: scansCount,
      sites: sitesCount,
    });
  }

  return data;
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

  // Get last 6 months of photo verification data
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
