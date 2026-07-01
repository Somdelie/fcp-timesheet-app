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
  wageTotal: number;
  percentChange: number | null;
};

type SiteDayRow = DayRow & {
  siteId: string;
  siteName: string;
  siteCode: string | null;
};

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

  const [dailyGroups, siteGroups, siteOptions] = await Promise.all([
    prisma.attendanceScan.groupBy({
      by: ["workDate"],
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
    prisma.site.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: [{ code: "asc" }, { name: "asc" }],
    }),
  ]);

  const siteIds = Array.from(new Set(siteGroups.map((row) => row.siteId)));
  const sites =
    siteIds.length > 0
      ? await prisma.site.findMany({
          where: { id: { in: siteIds } },
          select: { id: true, name: true, code: true },
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

  let previousTotal: number | null = null;
  const days: DayRow[] = dates.map((date) => {
    const total = totalByDate.get(date) ?? 0;
    const row = {
      date,
      total,
      wageTotal: wagesByDate.get(date) ?? 0,
      percentChange: pctChange(total, previousTotal),
    };
    previousTotal = total;
    return row;
  });

  const siteDateTotals = new Map<string, number>();
  const siteDateWages = new Map<string, number>();
  for (const row of siteGroups) {
    const key = `${row.siteId}:${isoFromDateUTC(row.workDate)}`;
    siteDateTotals.set(
      key,
      row._count._all,
    );
    siteDateWages.set(key, decimalToNumber(row._sum.dayRateAtScan));
  }

  const perSite: SiteDayRow[] = [];
  for (const id of siteIds) {
    const site = siteById.get(id);
    let previousSiteTotal: number | null = null;

    for (const date of dates) {
      const total = siteDateTotals.get(`${id}:${date}`) ?? 0;
      perSite.push({
        date,
        total,
        wageTotal: siteDateWages.get(`${id}:${date}`) ?? 0,
        percentChange: pctChange(total, previousSiteTotal),
        siteId: id,
        siteName: site?.name ?? "Unknown site",
        siteCode: site?.code ?? null,
      });
      previousSiteTotal = total;
    }
  }

  const totalAttendance = days.reduce((sum, day) => sum + day.total, 0);
  const totalWages = days.reduce((sum, day) => sum + day.wageTotal, 0);
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
        totalWages,
        averagePerDay,
        averageDayRate:
          totalAttendance > 0 ? totalWages / totalAttendance : 0,
        bestDay,
        activeSiteCount: siteIds.length,
      },
      days,
      perSite,
      sites: siteOptions,
    },
    {
      headers: {
        ...CORS_HEADERS,
        "Cache-Control": "no-store",
      },
    },
  );
}
