import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFortnightForDateUTC } from "@/lib/timesheetPeriods";
import { makeSupervisorTimesheetId } from "@/lib/timesheetId";
import { verifyApiToken } from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

async function getAuth(req: Request) {
  const token = getBearer(req);
  if (token) {
    const payload = await verifyApiToken(token);
    if (!payload) return null;
    return { userId: payload.sub, role: payload.role };
  }
  const session = await getServerSession(authOptions);
  const u = session?.user as any;
  if (!u?.id) return null;
  return { userId: u.id as string, role: u.role as string };
}

function startOfDayUTC(d: Date) {
  const x = new Date(d.getTime());
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function addDaysUTC(d: Date, days: number) {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function toISODateUTC(d: Date) {
  return d.toISOString().slice(0, 10);
}

function startOfDayUTCFromISO(iso: string) {
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${iso}`);
  d.setUTCHours(0, 0, 0, 0);
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

  if (parsed) {
    const startDate = startOfDayUTCFromISO(parsed.startISO);
    const endDate = startOfDayUTCFromISO(parsed.endISO);

    const existing = await prisma.timesheetPeriod.findUnique({
      where: { startDate_endDate: { startDate, endDate } },
      select: { id: true, startDate: true, endDate: true },
    });

    if (!existing) {
      throw new Error(
        `Timesheet period ${parsed.startISO}_${parsed.endISO} not found.`,
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

  // Default: compute current period from TimesheetYear anchor
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

  const period = await prisma.timesheetPeriod.upsert({
    where: {
      startDate_endDate: { startDate: ft.startDate, endDate: ft.endDate },
    },
    create: {
      startDate: ft.startDate,
      endDate: ft.endDate,
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
    const auth = await getAuth(req);
    if (!auth || auth.role !== "SUPERVISOR") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const userId = auth.userId;

    const supervisor = await prisma.supervisor.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!supervisor) {
      return NextResponse.json(
        { error: "Supervisor not found" },
        { status: 404 },
      );
    }

    // Resolve period (same logic as admin - from DB)
    const period = await resolvePeriod(req);
    const { periodId, startDate, endDate, startISO, endISO } = period;

    // ✅ INCLUDE WHOLE END DAY (Sat→Fri style period ends at 00:00 of endDate)
    const endExclusive = addDaysUTC(endDate, 1);

    // Get URL params
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
    const statusFilter = url.searchParams.get("status") ?? "ALL";

    // Find sites this supervisor is assigned to (active assignments only)
    const now = new Date();
    const supervisorSites = await prisma.supervisorSiteAssignment.findMany({
      where: {
        supervisorId: supervisor.id,
        startsOn: { lte: now },
        OR: [{ endsOn: null }, { endsOn: { gt: now } }],
      },
      select: { siteId: true },
    });

    const siteIds = supervisorSites.map((a) => a.siteId);

    // If supervisor has no sites, return empty
    if (siteIds.length === 0) {
      return NextResponse.json({
        timesheets: [],
        period: { id: `${startISO}_${endISO}`, startISO, endISO },
      });
    }

    // ✅ Get all siteDays in this period for supervisor's sites (inclusive end day)
    const siteDaysInPeriod = await prisma.siteDay.findMany({
      where: {
        workDate: { gte: startDate, lt: endExclusive },
        siteId: { in: siteIds },
      },
      select: {
        foremanId: true,
        workDate: true,
        site: { select: { id: true, code: true, name: true } },
        foreman: {
          select: {
            id: true,
            user: { select: { name: true } },
          },
        },
      },
    });

    const foremanIds = Array.from(
      new Set(siteDaysInPeriod.map((sd) => sd.foremanId)),
    );

    if (foremanIds.length === 0) {
      return NextResponse.json({
        timesheets: [],
        period: { id: `${startISO}_${endISO}`, startISO, endISO },
      });
    }

    // ✅ Get attendance scans for these foremen in this period (inclusive end day)
    const scans = await prisma.attendanceScan.findMany({
      where: {
        siteDay: {
          workDate: { gte: startDate, lt: endExclusive },
          foremanId: { in: foremanIds },
          siteId: { in: siteIds },
        },
      },
      select: {
        siteDay: { select: { foremanId: true, workDate: true, siteId: true } },
        siteId: true,
        employeeId: true,
        dayRateAtScan: true,
        employee: { select: { defaultDayRate: true } },
      },
    });

    // Group sites by foreman
    const sitesByForeman = new Map<
      string,
      Map<string, { id: string; code: string | null; name: string }>
    >();

    for (const sd of siteDaysInPeriod) {
      if (!sitesByForeman.has(sd.foremanId)) {
        sitesByForeman.set(sd.foremanId, new Map());
      }
      const siteMap = sitesByForeman.get(sd.foremanId)!;
      siteMap.set(sd.site.id, {
        id: sd.site.id,
        code: sd.site.code,
        name: sd.site.name,
      });
    }

    // Compute totals per (foreman, site)
    const scansByForemanSite = new Map<
      string,
      Array<{ date: string; wage: number; employeeId: string }>
    >();

    for (const scan of scans) {
      const foremanId = scan.siteDay.foremanId;
      const siteId = scan.siteId;
      const dateISO = toISODateUTC(scan.siteDay.workDate);
      const rate =
        decimalToNumber(scan.dayRateAtScan) ||
        decimalToNumber(scan.employee?.defaultDayRate);

      const key = `${foremanId}__${siteId}`;
      const list = scansByForemanSite.get(key) ?? [];
      list.push({ date: dateISO, wage: rate, employeeId: scan.employeeId });
      scansByForemanSite.set(key, list);
    }

    const totalsByForemanSite = new Map<
      string,
      { days: number; wages: number }
    >();

    for (const [key, list] of scansByForemanSite.entries()) {
      const uniquePairs = new Set<string>();
      let totalWages = 0;

      for (const s of list) {
        const pairKey = `${s.employeeId}-${s.date}`;
        if (!uniquePairs.has(pairKey)) {
          uniquePairs.add(pairKey);
          totalWages += s.wage;
        }
      }

      totalsByForemanSite.set(key, {
        days: uniquePairs.size,
        wages: totalWages,
      });
    }

    // Get timesheets for these foremen in this period
    const timesheetRows = await prisma.timesheet.findMany({
      where: {
        periodId,
        foremanId: { in: foremanIds },
      },
      select: {
        id: true,
        foremanId: true,
        siteId: true,
        status: true,
      },
    });

    // Map by foreman+site key since each foreman can have multiple sites
    const statusByForemanSite = new Map(
      timesheetRows.map((t) => [
        `${t.foremanId}__${t.siteId ?? ""}`,
        { id: t.id, status: t.status },
      ]),
    );

    // Build response - one row per (foreman, site)
    const siteDaysByForeman = new Map<string, typeof siteDaysInPeriod>();
    for (const sd of siteDaysInPeriod) {
      if (!siteDaysByForeman.has(sd.foremanId)) {
        siteDaysByForeman.set(sd.foremanId, []);
      }
      siteDaysByForeman.get(sd.foremanId)!.push(sd);
    }

    const result: Array<{
      id: string;
      startISO: string;
      endISO: string;
      status: string;
      foremanName: string;
      siteId: string | null;
      siteCode: string | null;
      siteName: string | null;
      totalWorkerDays: number;
      totalWorkerWages: number;
      rowKey: string;
    }> = [];

    for (const foremanId of foremanIds) {
      const siteDays = siteDaysByForeman.get(foremanId) || [];
      const sites = sitesByForeman.get(foremanId)
        ? Array.from(sitesByForeman.get(foremanId)!.values())
        : [];

      const foreman = siteDays[0]?.foreman;
      const foremanName = foreman?.user?.name ?? "Foreman";

      for (const site of sites) {
        const key = `${foremanId}__${site.id}`;
        const totals =
          totalsByForemanSite.get(key) || ({ days: 0, wages: 0 } as const);

        // Skip sites that have no attendance scans in this period
        if (!totals.days) continue;

        // Get timesheet status for this specific foreman+site combination
        const timesheet = statusByForemanSite.get(key);

        const id = makeSupervisorTimesheetId(startISO, endISO, foremanId);

        result.push({
          id,
          startISO,
          endISO,
          status: timesheet?.status ?? "SUBMITTED",
          foremanName,
          siteId: site.id,
          siteCode: site.code ?? null,
          siteName: site.name ?? null,
          totalWorkerDays: totals.days,
          totalWorkerWages: totals.wages,
          // unique per (foreman, site) row for UI keys
          rowKey: `${id}__${site.id}`,
        });
      }
    }

    // Apply filters
    const filtered = result
      .filter((row) => {
        if (q) {
          const matchForeman = row.foremanName.toLowerCase().includes(q);
          const matchSite =
            (row.siteName && row.siteName.toLowerCase().includes(q)) ||
            (row.siteCode && row.siteCode.toLowerCase().includes(q));
          if (!matchForeman && !matchSite) return false;
        }

        if (statusFilter !== "ALL" && row.status !== statusFilter) {
          return false;
        }

        return true;
      })
      .sort((a, b) => a.foremanName.localeCompare(b.foremanName));

    return NextResponse.json({
      timesheets: filtered,
      period: { id: `${startISO}_${endISO}`, startISO, endISO },
    });
  } catch (e: any) {
    console.error("Error fetching supervisor timesheets:", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 },
    );
  }
}
