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
  const u = session?.user as
    | { id?: unknown; role?: unknown }
    | null
    | undefined;
  if (!u?.id) return null;
  return { userId: String(u.id), role: String(u.role) };
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
  const decimalLike = v as { toNumber?: () => number };
  if (typeof decimalLike.toNumber === "function") return decimalLike.toNumber();
  const n = Number(v as number | string);
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

  // Default: compute current period from TimesheetYear anchor (SAME AS SUPERVISOR)
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
    if (!auth || auth.role !== "FOREMAN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const foreman = await prisma.foreman.findUnique({
      where: { userId: auth.userId },
      select: { id: true, user: { select: { name: true } } },
    });

    if (!foreman) {
      return NextResponse.json({ error: "Foreman not found" }, { status: 404 });
    }

    const foremanId = foreman.id;
    const foremanName = foreman.user?.name ?? "Foreman";

    // SAME resolvePeriod logic (current period)
    const period = await resolvePeriod(req);
    const { periodId, startDate, endDate, startISO, endISO } = period;

    // Optional query params (same shape as supervisor, but foreman probably won’t use them)
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
    const statusFilter = url.searchParams.get("status") ?? "ALL";
    const explicitPeriod = url.searchParams.get("period");

    // Optional: resolve a single active assistant for this foreman to label creator
    const now = new Date();
    const assistantLink = await prisma.foremanAssistant.findFirst({
      where: {
        foremanId,
        startsOn: { lte: now },
        OR: [{ endsOn: null }, { endsOn: { gt: now } }],
      },
      include: {
        employee: { select: { firstName: true, lastName: true } },
      },
    });

    const assistantName = assistantLink
      ? `${assistantLink.employee.firstName} ${assistantLink.employee.lastName}`.trim()
      : null;

    type PeriodInfo = {
      periodId: string;
      startDate: Date;
      endDate: Date;
      startISO: string;
      endISO: string;
      isCurrent: boolean;
    };

    type TimesheetSummary = {
      status: string | null;
      site: { id: string; code: string | null; name: string | null } | null;
    };

    type Row = {
      id: string;
      startISO: string;
      endISO: string;
      isCurrent: boolean;
      status: string;
      foremanName: string | null;
      siteId: string;
      siteCode: string | null;
      siteName: string | null;
      totalWorkerDays: number;
      totalWorkerWages: number;
      rowKey: string;
      createdByLabel: string;
    };

    const allRows: Row[] = [];

    // Load this foreman's timesheets (recent first) to discover periods with
    // explicit timesheet records. This is more robust than relying only
    // on siteDays, especially for historical data.
    const timesheetRows = await prisma.timesheet.findMany({
      where: { foremanId },
      select: {
        status: true,
        site: { select: { id: true, code: true, name: true } },
        period: { select: { id: true, startDate: true, endDate: true } },
      },
      orderBy: { period: { startDate: "desc" } },
      take: 200,
    });

    const periodInfoByKey = new Map<string, PeriodInfo>();
    const timesheetsByKey = new Map<string, TimesheetSummary[]>();
    const periodOrder: string[] = [];

    for (const t of timesheetRows) {
      const pStartISO = toISODateUTC(t.period.startDate);
      const pEndISO = toISODateUTC(t.period.endDate);
      const key = makeSupervisorTimesheetId(pStartISO, pEndISO, foreman.id);

      if (!periodInfoByKey.has(key)) {
        periodInfoByKey.set(key, {
          periodId: t.period.id,
          startDate: t.period.startDate,
          endDate: t.period.endDate,
          startISO: pStartISO,
          endISO: pEndISO,
          isCurrent: pStartISO === startISO && pEndISO === endISO,
        });
        periodOrder.push(key);
      }

      const arr = timesheetsByKey.get(key) ?? [];
      arr.push({
        status: t.status,
        site: t.site
          ? {
              id: t.site.id,
              code: t.site.code ?? null,
              name: t.site.name ?? null,
            }
          : null,
      });
      timesheetsByKey.set(key, arr);
    }

    console.log("[foreman-timesheets-mobile] discovered periods", {
      foremanId,
      foremanName,
      timesheetCount: timesheetRows.length,
      periodKeys: Array.from(periodInfoByKey.keys()),
    });

    // Ensure the current period (based on TimesheetYear) is always present,
    // even if there is no Timesheet row for it yet.
    const currentKey = makeSupervisorTimesheetId(startISO, endISO, foremanId);

    if (!periodInfoByKey.has(currentKey)) {
      periodInfoByKey.set(currentKey, {
        periodId,
        startDate,
        endDate,
        startISO,
        endISO,
        isCurrent: true,
      });
      periodOrder.unshift(currentKey);
    } else {
      const info = periodInfoByKey.get(currentKey);
      if (info) info.isCurrent = true;
    }

    // Decide which periods we will actually build rows for.
    // - If the client specified an explicit period, we only return that one.
    // - Otherwise, we try to return current + up to 2 previous periods that
    //   have Timesheet records, so the foreman always sees at least three
    //   recent fortnights when they exist.
    let selectedKeys: string[];

    if (explicitPeriod) {
      selectedKeys = [currentKey];
    } else {
      const maxPeriods = 3;
      selectedKeys = [currentKey];

      for (const key of periodOrder) {
        if (key === currentKey) continue;
        selectedKeys.push(key);
        if (selectedKeys.length >= maxPeriods) break;
      }
    }

    console.log("[foreman-timesheets-mobile] selected period keys", {
      foremanId,
      foremanName,
      selectedKeys,
      explicitPeriod: explicitPeriod ?? null,
    });

    async function buildRowsForPeriod(
      info: PeriodInfo,
      tsForPeriod: TimesheetSummary[],
    ): Promise<Row[]> {
      const {
        periodId: pId,
        startDate: pStart,
        endDate: pEnd,
        startISO: pStartISO,
        endISO: pEndISO,
        isCurrent,
      } = info;

      const endExclusive = addDaysUTC(pEnd, 1);

      // Foreman-only: get his siteDays in this period
      const siteDaysInPeriod = await prisma.siteDay.findMany({
        where: {
          foremanId,
          workDate: { gte: pStart, lt: endExclusive },
        },
        select: {
          workDate: true,
          site: { select: { id: true, code: true, name: true } },
        },
      });

      // Build a quick lookup of sites by id for this period, from either
      // siteDays or explicit Timesheet rows.
      const sitesById = new Map<
        string,
        { id: string; code: string | null; name: string | null }
      >();

      for (const d of siteDaysInPeriod) {
        const s = d.site;
        if (!sitesById.has(s.id)) {
          sitesById.set(s.id, {
            id: s.id,
            code: s.code ?? null,
            name: s.name ?? null,
          });
        }
      }

      for (const t of tsForPeriod) {
        if (!t.site) continue;
        const s = t.site;
        if (!sitesById.has(s.id)) {
          sitesById.set(s.id, {
            id: s.id,
            code: s.code,
            name: s.name,
          });
        }
      }

      // Scans for this foreman in this period (same wage aggregation as supervisor)
      const scans = await prisma.attendanceScan.findMany({
        where: {
          siteDay: {
            foremanId,
            workDate: { gte: pStart, lt: endExclusive },
          },
        },
        select: {
          siteDay: { select: { workDate: true, siteId: true } },
          siteId: true,
          employeeId: true,
          dayRateAtScan: true,
          scanType: true,
          manualReason: true,
          employee: { select: { defaultDayRate: true } },
        },
      });

      // totals per site = unique (employeeId + date) count + sum wages
      const scansBySite = new Map<
        string,
        Array<{ date: string; wage: number; employeeId: string }>
      >();

      // Track whether scans on a site were done by assistant vs foreman
      const hasAssistantScans = new Map<string, boolean>();
      const hasForemanScans = new Map<string, boolean>();

      for (const s of scans) {
        const siteId = s.siteDay.siteId ?? s.siteId;
        if (!siteId) continue;

        const dateISO = toISODateUTC(s.siteDay.workDate);
        const rate =
          decimalToNumber(s.dayRateAtScan) ||
          decimalToNumber(s.employee?.defaultDayRate);

        const list = scansBySite.get(siteId) ?? [];
        list.push({ date: dateISO, wage: rate, employeeId: s.employeeId });
        scansBySite.set(siteId, list);

        const isAssistantScan =
          s.scanType === "MANUAL" && s.manualReason === "ASSISTANT";
        if (isAssistantScan) {
          hasAssistantScans.set(siteId, true);
        } else {
          hasForemanScans.set(siteId, true);
        }
      }

      const totalsBySite = new Map<string, { days: number; wages: number }>();

      for (const [siteId, list] of scansBySite.entries()) {
        const uniquePairs = new Set<string>();
        let totalWages = 0;

        for (const s of list) {
          const key = `${s.employeeId}-${s.date}`;
          if (!uniquePairs.has(key)) {
            uniquePairs.add(key);
            totalWages += s.wage;
          }
        }

        totalsBySite.set(siteId, {
          days: uniquePairs.size,
          wages: totalWages,
        });
      }

      const compositeId = makeSupervisorTimesheetId(
        pStartISO,
        pEndISO,
        foremanId,
      );

      // Map explicit Timesheet statuses per site, if they exist.
      const statusBySite = new Map<string, string>();
      for (const t of tsForPeriod) {
        if (!t.site) continue;
        statusBySite.set(t.site.id, t.status ?? "SUBMITTED");
      }

      const rows: Row[] = [];

      for (const site of sitesById.values()) {
        const totals = totalsBySite.get(site.id) || {
          days: 0,
          wages: 0,
        };

        const assistant = hasAssistantScans.get(site.id) ?? false;
        const foremanOwn = hasForemanScans.get(site.id) ?? false;

        let createdByLabel = "You";
        if (assistant && !foremanOwn && assistantName) {
          createdByLabel = assistantName;
        }

        const status = statusBySite.get(site.id) ?? "SUBMITTED";

        rows.push({
          id: compositeId,
          startISO: pStartISO,
          endISO: pEndISO,
          isCurrent,
          status,
          foremanName,
          siteId: site.id,
          siteCode: site.code,
          siteName: site.name,
          totalWorkerDays: totals.days,
          totalWorkerWages: totals.wages,
          rowKey: `${compositeId}__${site.id}`,
          createdByLabel,
        });
      }

      // If there were Timesheet rows but no sites (very rare / legacy data),
      // we still want at least one row for the period so it appears.
      if (rows.length === 0 && tsForPeriod.length > 0) {
        const anyStatus = tsForPeriod[0].status ?? "SUBMITTED";

        rows.push({
          id: compositeId,
          startISO: pStartISO,
          endISO: pEndISO,
          isCurrent,
          status: anyStatus,
          foremanName,
          siteId: "", // no specific site; detail view can aggregate
          siteCode: null,
          siteName: null,
          totalWorkerDays: 0,
          totalWorkerWages: 0,
          rowKey: `${compositeId}__generic`,
          createdByLabel: "You",
        });
      }

      return rows;
    }

    for (const key of selectedKeys) {
      const info = periodInfoByKey.get(key);
      if (!info) continue;
      const tsForPeriod = timesheetsByKey.get(key) ?? [];
      const rows = await buildRowsForPeriod(info, tsForPeriod);
      allRows.push(...rows);
    }

    console.log("[foreman-timesheets-mobile] built rows summary", {
      foremanId,
      foremanName,
      totalRows: allRows.length,
      periodIds: Array.from(new Set(allRows.map((r) => r.id))),
    });

    // If no work days across all considered periods, return empty but include current period
    if (allRows.length === 0) {
      return NextResponse.json({
        timesheets: [],
        period: { id: `${startISO}_${endISO}`, startISO, endISO },
      });
    }

    // Apply same filters (q/status), though foreman usually doesn’t need them
    const filtered = allRows.filter((row) => {
      const matchQ =
        !q ||
        (row.foremanName && row.foremanName.toLowerCase().includes(q)) ||
        (row.siteName && row.siteName.toLowerCase().includes(q)) ||
        (row.siteCode && row.siteCode.toLowerCase().includes(q));

      const matchStatus = statusFilter === "ALL" || row.status === statusFilter;
      return matchQ && matchStatus;
    });

    return NextResponse.json({
      timesheets: filtered,
      period: { id: `${startISO}_${endISO}`, startISO, endISO },
    });
  } catch (e: unknown) {
    console.error("Error fetching foreman timesheets (mobile):", e);
    return NextResponse.json(
      {
        error: e instanceof Error && e.message ? e.message : "Server error",
      },
      { status: 500 },
    );
  }
}
