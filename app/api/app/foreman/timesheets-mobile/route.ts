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

    // SAME resolvePeriod logic
    const period = await resolvePeriod(req);
    const { periodId, startDate, endDate, startISO, endISO } = period;

    // Optional query params (same shape as supervisor, but foreman probably won’t use them)
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
    const statusFilter = url.searchParams.get("status") ?? "ALL";

    // Foreman-only: get his siteDays in this period
    const siteDaysInPeriod = await prisma.siteDay.findMany({
      where: {
        foremanId: foreman.id,
        workDate: { gte: startDate, lt: endDate },
      },
      select: {
        workDate: true,
        site: { select: { id: true, code: true, name: true } },
      },
    });

    // If no work days, return empty but include period
    if (siteDaysInPeriod.length === 0) {
      return NextResponse.json({
        timesheets: [],
        period: { id: `${startISO}_${endISO}`, startISO, endISO },
      });
    }

    // Build a quick lookup of sites by id
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

    // Scans for this foreman in this period (same wage aggregation as supervisor)
    const scans = await prisma.attendanceScan.findMany({
      where: {
        siteDay: {
          foremanId: foreman.id,
          workDate: { gte: startDate, lt: endDate },
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

    // Pull timesheet record status (if exists)
    const ts = await prisma.timesheet.findUnique({
      where: { periodId_foremanId: { periodId, foremanId: foreman.id } },
      select: { id: true, status: true },
    });
    const id = makeSupervisorTimesheetId(startISO, endISO, foreman.id);

    // Optional: resolve a single active assistant for this foreman to label creator
    const now = new Date();
    const assistantLink = await prisma.foremanAssistant.findFirst({
      where: {
        foremanId: foreman.id,
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

    const rows = Array.from(sitesById.values())
      .map((site) => {
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

        return {
          id,
          startISO,
          endISO,
          status: ts?.status ?? "SUBMITTED",
          foremanName: foreman.user?.name ?? "Foreman",
          siteId: site.id,
          siteCode: site.code,
          siteName: site.name,
          totalWorkerDays: totals.days,
          totalWorkerWages: totals.wages,
          rowKey: `${id}__${site.id}`,
          createdByLabel,
        };
      })
      // keep only sites with at least one worker day
      .filter((row) => row.totalWorkerDays > 0);

    // Apply same filters (q/status), though foreman usually doesn’t need them
    const filtered = rows.filter((row) => {
      const matchQ =
        !q ||
        row.foremanName.toLowerCase().includes(q) ||
        (row.siteName && row.siteName.toLowerCase().includes(q)) ||
        (row.siteCode && row.siteCode.toLowerCase().includes(q));

      const matchStatus = statusFilter === "ALL" || row.status === statusFilter;
      return matchQ && matchStatus;
    });

    return NextResponse.json({
      timesheets: filtered,
      period: { id: `${startISO}_${endISO}`, startISO, endISO },
    });
  } catch (e: any) {
    console.error("Error fetching foreman timesheets (mobile):", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 },
    );
  }
}
