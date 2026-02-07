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
  const today = new Date();
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const data = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - (today.getDay() - (i + 1)));
    const dateISO = toISODate(date);

    const scansCount = await prisma.attendanceScan.count({
      where: {
        workDate: new Date(`${dateISO}T00:00:00Z`),
      },
    });

    const sitesCount = await prisma.siteDay.count({
      where: {
        workDate: new Date(`${dateISO}T00:00:00Z`),
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

  const [submitted, approved, rejected, paid] = await Promise.all([
    prisma.timesheet.count({ where: { status: "SUBMITTED" } }),
    prisma.timesheet.count({ where: { status: "APPROVED" } }),
    prisma.timesheet.count({ where: { status: "REJECTED" } }),
    prisma.timesheet.count({ where: { status: "PAID" } }),
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

  const sites = await prisma.site.findMany({
    where: { isActive: true },
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
