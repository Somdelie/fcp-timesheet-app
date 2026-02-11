import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { parseSupervisorTimesheetId } from "@/lib/timesheetId";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() ?? null;
}

function startOfDayUTCFromISO(iso: string) {
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${iso}`);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function addDaysUTC(d: Date, days: number) {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function toISODateUTC(d: Date) {
  return d.toISOString().slice(0, 10);
}

function weekdayShortUTC(iso: string) {
  const d = new Date(`${iso}T00:00:00.000Z`);
  return d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
}

function decimalToNumber(v: any): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v?.toNumber === "function") return v.toNumber();
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fullName(emp: { firstName: string; lastName: string }) {
  return `${emp.firstName} ${emp.lastName}`.trim();
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const token = getBearer(req);
    const payload = token ? await verifyApiToken(token) : null;

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (payload.role !== "FOREMAN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const foreman = await prisma.foreman.findUnique({
      where: { userId: payload.sub },
      select: { id: true, user: { select: { name: true } } },
    });

    if (!foreman) {
      return NextResponse.json({ error: "Foreman not found" }, { status: 404 });
    }

    const { id } = await ctx.params;

    // Expected: YYYY-MM-DD_YYYY-MM-DD__FOREMANID
    const parsed = parseSupervisorTimesheetId(id);
    if (!parsed) {
      return NextResponse.json(
        {
          error: "Invalid id format. Expected YYYY-MM-DD_YYYY-MM-DD__FOREMANID",
        },
        { status: 400 },
      );
    }

    // ✅ Foreman can ONLY access his own
    if (parsed.foremanId !== foreman.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const startDate = startOfDayUTCFromISO(parsed.startISO);
    const endDate = startOfDayUTCFromISO(parsed.endISO);
    const endExclusive = addDaysUTC(endDate, 1);

    const url = new URL(req.url);
    const siteIdFilter = url.searchParams.get("siteId");

    // Find or create the period (same as supervisor)
    const period = await prisma.timesheetPeriod.upsert({
      where: { startDate_endDate: { startDate, endDate } },
      create: { startDate, endDate },
      update: {},
      select: { id: true, startDate: true, endDate: true, label: true },
    });

    // Find or create the timesheet (same as supervisor)
    const timesheet = await prisma.timesheet.upsert({
      where: {
        periodId_foremanId: { periodId: period.id, foremanId: foreman.id },
      },
      create: { periodId: period.id, foremanId: foreman.id },
      update: {},
      select: {
        id: true,
        status: true,
        submittedAt: true,
        foreman: { select: { id: true, user: { select: { name: true } } } },
      },
    });

    const startISO = toISODateUTC(startDate);
    const endISO = toISODateUTC(endDate);

    // ✅ Always build 14 columns
    const columns = Array.from({ length: 14 }).map((_, i) => {
      const d = addDaysUTC(startDate, i);
      const iso = toISODateUTC(d);
      return { iso, day: weekdayShortUTC(iso) };
    });
    const colIndex = new Map(columns.map((c, idx) => [c.iso, idx] as const));

    // Sites worked in this period (optionally filter by site)
    const siteRows = await prisma.siteDay.findMany({
      where: {
        foremanId: foreman.id,
        ...(siteIdFilter ? { siteId: siteIdFilter } : {}),
        workDate: { gte: startDate, lt: endExclusive },
      },
      distinct: ["siteId"],
      select: { site: { select: { id: true, code: true, name: true } } },
    });

    const sites = siteRows
      .map((r) => r.site)
      .sort(
        (a, b) =>
          (a.code ?? "").localeCompare(b.code ?? "") ||
          a.name.localeCompare(b.name),
      );

    const sitesLabel =
      sites.length === 0
        ? "No sites"
        : sites.length === 1
          ? `${sites[0].code ? sites[0].code + " · " : ""}${sites[0].name}`
          : `${sites.length} sites`;

    // Scans via SiteDay (same pattern as supervisor, optionally filtered by site)
    const scans = await prisma.attendanceScan.findMany({
      where: {
        siteDay: {
          foremanId: foreman.id,
          ...(siteIdFilter ? { siteId: siteIdFilter } : {}),
          workDate: { gte: startDate, lt: endExclusive },
        },
      },
      select: {
        employeeId: true,
        workDate: true,
        dayRateAtScan: true,
        employee: {
          select: { firstName: true, lastName: true, defaultDayRate: true },
        },
      },
    });

    type RowAgg = {
      employeeId: string;
      fullName: string;
      dayRate: number;
      present: boolean[];
      seenDay: Set<string>;
    };

    const byEmp = new Map<string, RowAgg>();

    for (const s of scans) {
      const iso = toISODateUTC(s.workDate);
      const idx = colIndex.get(iso);
      if (idx === undefined) continue;

      const rate =
        decimalToNumber(s.dayRateAtScan) ||
        decimalToNumber(s.employee?.defaultDayRate);

      const name = s.employee ? fullName(s.employee) : "Employee";

      let agg = byEmp.get(s.employeeId);
      if (!agg) {
        agg = {
          employeeId: s.employeeId,
          fullName: name,
          dayRate: rate,
          present: Array(14).fill(false),
          seenDay: new Set(),
        };
        byEmp.set(s.employeeId, agg);
      }

      // mark present once per day
      if (!agg.seenDay.has(iso)) agg.seenDay.add(iso);
      agg.present[idx] = true;

      if (rate > 0) agg.dayRate = rate;
      if (name) agg.fullName = name;
    }

    const rows = Array.from(byEmp.values())
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
      .map((r) => {
        const daysWorked = r.present.reduce((sum, p) => sum + (p ? 1 : 0), 0);
        const pay = daysWorked * (r.dayRate || 0);
        return {
          employeeId: r.employeeId,
          fullName: r.fullName,
          dayRate: r.dayRate || 0,
          present: r.present,
          daysWorked,
          pay,
        };
      });

    const totals = rows.reduce(
      (acc, r) => {
        acc.totalDays += r.daysWorked;
        acc.totalPay += r.pay;
        return acc;
      },
      { totalDays: 0, totalPay: 0 },
    );

    return NextResponse.json({
      timesheet: {
        id: timesheet.id,
        startISO,
        endISO,
        sitesLabel,
        foremanName:
          timesheet.foreman.user?.name ?? foreman.user?.name ?? "Foreman",
        foreman: { id: foreman.id, name: foreman.user?.name ?? "Foreman" },
        supervisor: null,
        sites,
        status: timesheet.status,
        submittedAt: timesheet.submittedAt?.toISOString() ?? null,
        columns,
        rows,
        totals,
      },
    });
  } catch (e: any) {
    console.error("Error fetching foreman timesheet detail (mobile):", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 },
    );
  }
}
