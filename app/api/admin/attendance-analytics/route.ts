import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import {
  addDaysUTC,
  decimalToNumber,
  isoFromDateUTC,
  startOfDayUTC,
} from "@/lib/dateUtc";
import { currentFortnightSatFri } from "@/lib/fortnight";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

type DayRow = {
  date: string;
  total: number;
  overtimeTotal: number;
  wageTotal: number;
  overtimeWageTotal: number;
  percentChange: number | null;
};

type SiteDayRow = DayRow & {
  siteId: string;
  siteName: string;
  siteCode: string | null;
  supervisorName: string | null;
};

type SessionUser = {
  id?: string;
  role?: string;
};

type OvertimeType = "NONE" | "HALF_DAY" | "FULL_DAY";

function overtimeDays(type: OvertimeType) {
  if (type === "HALF_DAY") return 0.5;
  if (type === "FULL_DAY") return 1;
  return 0;
}

function pctChange(current: number, previous: number | null) {
  if (previous === null) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

function labelForPeriod(startISO: string, endISO: string) {
  return `${startISO} - ${endISO}`;
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;

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
  const requestedStartISO = url.searchParams.get("start");
  const siteId = url.searchParams.get("siteId") || null;
  const current = currentFortnightSatFri();
  const startISO = requestedStartISO || current.startISO;
  let start: Date;

  try {
    start = startOfDayUTC(startISO);
  } catch {
    return NextResponse.json(
      { error: "Invalid start date" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const end = addDaysUTC(start, 13);
  const endISO = isoFromDateUTC(end);
  const endExclusive = addDaysUTC(end, 1);

  const where = {
    workDate: { gte: start, lt: endExclusive },
    ...(siteId ? { siteId } : {}),
  };

  const [
    dailyGroups,
    dailyOvertimeGroups,
    siteGroups,
    siteOvertimeGroups,
    siteOptions,
    unpaidOvertimeEntries,
  ] = await Promise.all([
    prisma.attendanceScan.groupBy({
      by: ["workDate"],
      where,
      _count: { _all: true },
      _sum: { dayRateAtScan: true },
      orderBy: { workDate: "asc" },
    }),
    prisma.attendanceScan.groupBy({
      by: ["workDate", "overtimeType"],
      where,
      _count: { _all: true },
      _sum: { dayRateAtScan: true },
      orderBy: { workDate: "asc" },
    }),
    prisma.attendanceScan.groupBy({
      by: ["siteId", "workDate"],
      where,
      _count: { _all: true },
      _sum: { dayRateAtScan: true },
      orderBy: [{ siteId: "asc" }, { workDate: "asc" }],
    }),
    prisma.attendanceScan.groupBy({
      by: ["siteId", "workDate", "overtimeType"],
      where,
      _count: { _all: true },
      _sum: { dayRateAtScan: true },
      orderBy: [{ siteId: "asc" }, { workDate: "asc" }],
    }),
    prisma.site.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        supervisorAssignments: {
          where: { endsOn: null },
          select: {
            supervisor: {
              select: {
                user: { select: { name: true, email: true } },
              },
            },
          },
          orderBy: { startsOn: "desc" },
        },
      },
      orderBy: [{ code: "asc" }, { name: "asc" }],
    }),
    prisma.overtimeEntry.findMany({
      where: {
        workDate: { gte: start, lt: endExclusive },
        paidAt: null,
        ...(siteId ? { siteId } : {}),
      },
      select: {
        hoursWorked: true,
        numberOfEmployees: true,
        totalCost: true,
      },
    }),
  ]);

  const siteIds = Array.from(new Set(siteGroups.map((row) => row.siteId)));
  const sites =
    siteIds.length > 0
      ? await prisma.site.findMany({
          where: { id: { in: siteIds } },
          select: {
            id: true,
            name: true,
            code: true,
            supervisorAssignments: {
              where: { endsOn: null },
              select: {
                supervisor: {
                  select: {
                    user: { select: { name: true, email: true } },
                  },
                },
              },
              orderBy: { startsOn: "desc" },
            },
          },
        })
      : [];
  const siteById = new Map(sites.map((site) => [site.id, site]));

  const dates = Array.from({ length: 14 }, (_, index) =>
    isoFromDateUTC(addDaysUTC(start, index)),
  );

  const totalByDate = new Map(
    dailyGroups.map((row) => [isoFromDateUTC(row.workDate), row._count._all]),
  );
  const wagesByDate = new Map(
    dailyGroups.map((row) => [
      isoFromDateUTC(row.workDate),
      decimalToNumber(row._sum.dayRateAtScan),
    ]),
  );
  const overtimeByDate = new Map<string, number>();
  const overtimeWagesByDate = new Map<string, number>();
  for (const row of dailyOvertimeGroups) {
    const date = isoFromDateUTC(row.workDate);
    const multiplier = overtimeDays(row.overtimeType as OvertimeType);
    if (multiplier === 0) continue;
    overtimeByDate.set(
      date,
      (overtimeByDate.get(date) ?? 0) + row._count._all * multiplier,
    );
    overtimeWagesByDate.set(
      date,
      (overtimeWagesByDate.get(date) ?? 0) +
        decimalToNumber(row._sum.dayRateAtScan) * multiplier,
    );
  }

  let previousTotal: number | null = null;
  const days: DayRow[] = dates.map((date) => {
    const total = totalByDate.get(date) ?? 0;
    const row = {
      date,
      total,
      overtimeTotal: overtimeByDate.get(date) ?? 0,
      wageTotal: wagesByDate.get(date) ?? 0,
      overtimeWageTotal: overtimeWagesByDate.get(date) ?? 0,
      percentChange: pctChange(total, previousTotal),
    };
    previousTotal = total;
    return row;
  });

  const siteDateTotals = new Map<string, number>();
  const siteDateWages = new Map<string, number>();
  const siteDateOvertimeTotals = new Map<string, number>();
  const siteDateOvertimeWages = new Map<string, number>();
  for (const row of siteGroups) {
    const key = `${row.siteId}:${isoFromDateUTC(row.workDate)}`;
    siteDateTotals.set(
      key,
      row._count._all,
    );
    siteDateWages.set(key, decimalToNumber(row._sum.dayRateAtScan));
  }
  for (const row of siteOvertimeGroups) {
    const multiplier = overtimeDays(row.overtimeType as OvertimeType);
    if (multiplier === 0) continue;
    const key = `${row.siteId}:${isoFromDateUTC(row.workDate)}`;
    siteDateOvertimeTotals.set(
      key,
      (siteDateOvertimeTotals.get(key) ?? 0) + row._count._all * multiplier,
    );
    siteDateOvertimeWages.set(
      key,
      (siteDateOvertimeWages.get(key) ?? 0) +
        decimalToNumber(row._sum.dayRateAtScan) * multiplier,
    );
  }

  const perSite: SiteDayRow[] = [];
  for (const id of siteIds) {
    const site = siteById.get(id);
    const supervisorName =
      site?.supervisorAssignments
        .map(
          (assignment) =>
            assignment.supervisor.user?.name ??
            assignment.supervisor.user?.email ??
            null,
        )
        .filter((name): name is string => Boolean(name))
        .join(", ") || null;
    let previousSiteTotal: number | null = null;

    for (const date of dates) {
      const total = siteDateTotals.get(`${id}:${date}`) ?? 0;
      perSite.push({
        date,
        total,
        overtimeTotal: siteDateOvertimeTotals.get(`${id}:${date}`) ?? 0,
        wageTotal: siteDateWages.get(`${id}:${date}`) ?? 0,
        overtimeWageTotal: siteDateOvertimeWages.get(`${id}:${date}`) ?? 0,
        percentChange: pctChange(total, previousSiteTotal),
        siteId: id,
        siteName: site?.name ?? "Unknown site",
        siteCode: site?.code ?? null,
        supervisorName,
      });
      previousSiteTotal = total;
    }
  }

  const totalAttendance = days.reduce((sum, day) => sum + day.total, 0);
  const totalWages = days.reduce((sum, day) => sum + day.wageTotal, 0);
  const totalOvertime = days.reduce((sum, day) => sum + day.overtimeTotal, 0);
  const totalOvertimeWages = days.reduce(
    (sum, day) => sum + day.overtimeWageTotal,
    0,
  );
  const unpaidOvertimeHours = unpaidOvertimeEntries.reduce(
    (sum, entry) =>
      sum + decimalToNumber(entry.hoursWorked) * entry.numberOfEmployees,
    0,
  );
  const unpaidOvertimeDays = unpaidOvertimeHours / 8;
  const unpaidOvertimeCost = unpaidOvertimeEntries.reduce(
    (sum, entry) => sum + decimalToNumber(entry.totalCost),
    0,
  );
  const averagePerDay = totalAttendance / dates.length;
  const bestDay = days.reduce<DayRow | null>(
    (best, day) => (!best || day.total > best.total ? day : best),
    null,
  );

  return NextResponse.json(
    {
      period: {
        startISO,
        endISO,
        label: labelForPeriod(startISO, endISO),
      },
      summary: {
        totalAttendance,
        totalOvertime,
        unpaidOvertimeDays,
        unpaidOvertimeHours,
        unpaidOvertimeCost,
        totalWithOvertime: totalAttendance + totalOvertime,
        totalWages,
        totalOvertimeWages,
        totalWagesWithOvertime: totalWages + totalOvertimeWages,
        averagePerDay,
        averageDayRate:
          totalAttendance > 0 ? totalWages / totalAttendance : 0,
        bestDay,
        activeSiteCount: siteIds.length,
      },
      days,
      perSite,
      sites: siteOptions.map((site) => ({
        id: site.id,
        name: site.name,
        code: site.code,
        supervisorName:
          site.supervisorAssignments
            .map(
              (assignment) =>
                assignment.supervisor.user?.name ??
                assignment.supervisor.user?.email ??
                null,
            )
            .filter((name): name is string => Boolean(name))
            .join(", ") || null,
      })),
    },
    {
      headers: {
        ...CORS_HEADERS,
        "Cache-Control": "no-store",
      },
    },
  );
}
