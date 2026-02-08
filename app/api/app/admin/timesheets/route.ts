import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFortnightForDateUTC } from "@/lib/timesheetPeriods";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function addDaysUTC(d: Date, days: number) {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function startOfDayUTC(d: Date) {
  const x = new Date(d.getTime());
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function toISODateUTC(d: Date) {
  return d.toISOString().slice(0, 10);
}

function startOfDayUTCFromISO(iso: string) {
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${iso}`);
  return d;
}

function parsePeriodId(raw: string | null) {
  const s = String(raw ?? "").trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/);
  if (!m) return null;
  return { startISO: m[1], endISO: m[2] };
}

function decimalToNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const anyV = v as any;
  if (typeof anyV?.toNumber === "function") return anyV.toNumber();
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function resolvePeriod(req: Request) {
  const url = new URL(req.url);
  const parsed = parsePeriodId(url.searchParams.get("period"));

  // If client passed a period, it MUST exist (otherwise user is selecting a non-generated period)
  if (parsed) {
    const startDate = startOfDayUTCFromISO(parsed.startISO);
    const endDate = startOfDayUTCFromISO(parsed.endISO);

    const existing = await prisma.timesheetPeriod.findUnique({
      where: { startDate_endDate: { startDate, endDate } },
      select: { id: true, startDate: true, endDate: true },
    });

    if (!existing) {
      throw new Error(
        `Timesheet period ${parsed.startISO}_${parsed.endISO} not found. Generate year periods first.`,
      );
    }

    return {
      periodId: existing.id,
      startDate: existing.startDate,
      endDate: existing.endDate,
      startISO: parsed.startISO,
      endISO: parsed.endISO,
    };
  }

  // Default: compute current period from TimesheetYear anchor for the current UTC year
  const today = startOfDayUTC(new Date());
  const year = today.getUTCFullYear();

  const yearCfg = await prisma.timesheetYear.findUnique({
    where: { year },
    select: { anchorSat: true },
  });

  if (!yearCfg) {
    throw new Error(
      `TimesheetYear not configured for ${year}. Admin must generate the year with an anchor Saturday.`,
    );
  }

  const ft = getFortnightForDateUTC(today, yearCfg.anchorSat);

  // Ensure period exists (safe even if already created by generate-year)
  const period = await prisma.timesheetPeriod.upsert({
    where: {
      startDate_endDate: { startDate: ft.startDate, endDate: ft.endDate },
    },
    create: {
      startDate: ft.startDate,
      endDate: ft.endDate,
      label: ft.id,
    },
    update: {},
    select: { id: true, startDate: true, endDate: true },
  });

  return {
    periodId: period.id,
    startDate: period.startDate,
    endDate: period.endDate,
    startISO: toISODateUTC(period.startDate),
    endISO: toISODateUTC(period.endDate),
  };
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userRole = (session.user as any)?.role;
    if (userRole !== "ADMIN" && userRole !== "SUPERVISOR") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const supervisorId = (url.searchParams.get("supervisorId") ?? "").trim();
    const statusFilter = (url.searchParams.get("status") ?? "").trim();

    const { periodId, startDate, endDate, startISO, endISO } =
      await resolvePeriod(req);

    const endExclusive = addDaysUTC(startOfDayUTC(endDate), 1);

    // Get all site days in this period
    const siteDays = await prisma.siteDay.findMany({
      where: {
        workDate: { gte: startDate, lt: endExclusive },
      },
      select: {
        foremanId: true,
        site: { select: { id: true, code: true, name: true } },
        foreman: { select: { id: true, user: { select: { name: true } } } },
      },
    });

    // Get all attendance scans in this period
    const scans = await prisma.attendanceScan.findMany({
      where: {
        siteDay: {
          workDate: { gte: startDate, lt: endExclusive },
        },
      },
      select: {
        siteDay: { select: { foremanId: true, workDate: true } },
        employeeId: true,
        dayRateAtScan: true,
        employee: { select: { defaultDayRate: true } },
      },
    });

    if (siteDays.length === 0 && scans.length === 0) {
      return NextResponse.json({
        timesheets: [],
        period: { id: `${startISO}_${endISO}`, startISO, endISO },
      });
    }

    type SiteLite = { id: string; code: string | null; name: string };
    type ForemanAgg = {
      foremanId: string;
      foremanName: string;
      sites: Map<string, SiteLite>;
      totalWorkerDays: number;
      totalWorkerWages: number;
    };

    const byForeman = new Map<string, ForemanAgg>();

    // Sites per foreman
    for (const sd of siteDays) {
      let agg = byForeman.get(sd.foremanId);
      if (!agg) {
        agg = {
          foremanId: sd.foremanId,
          foremanName: sd.foreman.user?.name ?? "Foreman",
          sites: new Map(),
          totalWorkerDays: 0,
          totalWorkerWages: 0,
        };
        byForeman.set(sd.foremanId, agg);
      }

      agg.sites.set(sd.site.id, {
        id: sd.site.id,
        code: sd.site.code,
        name: sd.site.name,
      });
    }

    // Compute totals per foreman
    const scansByForeman = new Map<
      string,
      Array<{ date: string; wage: number; employeeId: string }>
    >();

    for (const scan of scans) {
      const foremanId = scan.siteDay.foremanId;

      if (!byForeman.has(foremanId)) {
        byForeman.set(foremanId, {
          foremanId,
          foremanName: "Unknown",
          sites: new Map(),
          totalWorkerDays: 0,
          totalWorkerWages: 0,
        });
      }

      const dateISO = toISODateUTC(scan.siteDay.workDate);

      const rate =
        decimalToNumber(scan.dayRateAtScan) ||
        decimalToNumber(scan.employee?.defaultDayRate);

      const list = scansByForeman.get(foremanId) ?? [];
      list.push({ date: dateISO, wage: rate, employeeId: scan.employeeId });
      scansByForeman.set(foremanId, list);
    }

    for (const [foremanId, list] of scansByForeman.entries()) {
      const uniquePairs = new Set<string>();
      let totalWages = 0;

      for (const s of list) {
        const key = `${s.employeeId}-${s.date}`;
        if (!uniquePairs.has(key)) {
          uniquePairs.add(key);
          totalWages += s.wage;
        }
      }

      const agg = byForeman.get(foremanId);
      if (agg) {
        agg.totalWorkerDays = uniquePairs.size;
        agg.totalWorkerWages = totalWages;
      }
    }

    const foremanIds = Array.from(byForeman.keys());

    // ✅ REAL STATUS: pull from Timesheet table
    const timesheetRows = await prisma.timesheet.findMany({
      where: { periodId, foremanId: { in: foremanIds } },
      select: {
        foremanId: true,
        status: true,
      },
    });
    const statusByForeman = new Map(
      timesheetRows.map((t) => [t.foremanId, t.status]),
    );

    // Supervisor derived from site assignments (your logic)
    const siteIdsInPeriod = Array.from(
      new Set(
        Array.from(byForeman.values()).flatMap((agg) =>
          Array.from(agg.sites.keys()),
        ),
      ),
    );

    const supervisorSiteAssignments =
      await prisma.supervisorSiteAssignment.findMany({
        where: { siteId: { in: siteIdsInPeriod } },
        select: {
          supervisor: {
            select: { id: true, user: { select: { name: true } } },
          },
          siteId: true,
        },
      });

    const supervisorsBySite = new Map<string, { id: string; name: string }>();
    for (const a of supervisorSiteAssignments) {
      supervisorsBySite.set(a.siteId, {
        id: a.supervisor.id,
        name: a.supervisor.user?.name ?? "Supervisor",
      });
    }

    const supervisorByForeman = new Map<
      string,
      { id: string; name: string } | null
    >();

    for (const agg of byForeman.values()) {
      let found: { id: string; name: string } | null = null;
      for (const siteId of agg.sites.keys()) {
        const sup = supervisorsBySite.get(siteId);
        if (sup) {
          found = sup;
          break;
        }
      }
      supervisorByForeman.set(agg.foremanId, found);
    }

    const timesheets = Array.from(byForeman.values())
      .map((agg) => {
        const sup = supervisorByForeman.get(agg.foremanId);
        const realStatus = statusByForeman.get(agg.foremanId) ?? "SUBMITTED";

        return {
          id: `${startISO}_${endISO}_${agg.foremanId}`, // your UI id format
          startISO,
          endISO,
          status: realStatus,
          foreman: { id: agg.foremanId, name: agg.foremanName },
          supervisor: sup ?? null,
          totalWorkerDays: agg.totalWorkerDays,
          totalWorkerWages: agg.totalWorkerWages,
          sites: Array.from(agg.sites.values()),
        };
      })
      .filter((row) => {
        // search
        if (q) {
          const s = q.toLowerCase();
          const matchForeman = row.foreman.name.toLowerCase().includes(s);
          const matchSite = row.sites.some(
            (x) =>
              x.name.toLowerCase().includes(s) ||
              (x.code && x.code.toLowerCase().includes(s)),
          );
          if (!matchForeman && !matchSite) return false;
        }

        // status filter
        if (
          statusFilter &&
          statusFilter !== "ALL" &&
          row.status !== statusFilter
        )
          return false;

        // supervisor filter
        if (supervisorId && supervisorId !== "ALL") {
          if (!row.supervisor || row.supervisor.id !== supervisorId)
            return false;
        }

        return true;
      })
      .sort((a, b) => a.foreman.name.localeCompare(b.foreman.name));

    return NextResponse.json({
      timesheets,
      period: { id: `${startISO}_${endISO}`, startISO, endISO },
    });
  } catch (e: any) {
    console.error("Error fetching timesheets:", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 },
    );
  }
}
