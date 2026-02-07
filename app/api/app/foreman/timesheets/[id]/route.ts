import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function startOfDayUTC(iso: string) {
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${iso}`);
  return d;
}

function addDaysUTC(d: Date, days: number) {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function parseId(raw: string) {
  const m = String(raw ?? "")
    .trim()
    .match(/^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/);
  if (!m) return null;
  return { startISO: m[1], endISO: m[2] };
}

function isoFromDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function weekdayShort(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "short" });
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
  // ---- auth (same pattern as your other /api/app routes) ----
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token)
    return NextResponse.json({ error: "Missing token" }, { status: 401 });

  const payload = await verifyApiToken(token);
  if (!payload)
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  if (payload.role !== "FOREMAN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const foreman = await prisma.foreman.findUnique({
    where: { userId: payload.sub },
    select: { id: true },
  });
  if (!foreman) {
    return NextResponse.json(
      { error: "Foreman profile missing" },
      { status: 403 },
    );
  }

  const { id } = await ctx.params; // ✅ FIX
  const parsed = parseId(id); // ✅ FIX
  if (!parsed) {
    return NextResponse.json(
      { error: "Invalid timesheet id. Expected YYYY-MM-DD_YYYY-MM-DD" },
      { status: 400 },
    );
  }

  const { startISO, endISO } = parsed;

  let startDate: Date;
  let endDate: Date;
  try {
    startDate = startOfDayUTC(startISO);
    endDate = startOfDayUTC(endISO);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Invalid dates" },
      { status: 400 },
    );
  }

  // We treat endISO as inclusive in UI; convert to exclusive end+1 day for querying
  const endExclusive = addDaysUTC(endDate, 1);

  // Optional: if your list route is based on TimesheetPeriod, confirm it exists:
  const period = await prisma.timesheetPeriod.findUnique({
    where: { startDate_endDate: { startDate, endDate } },
    select: { id: true },
  });

  // Not fatal if you haven’t created periods yet; we can still compute from scans.
  // But if you WANT to require it, uncomment:
  // if (!period) return NextResponse.json({ error: "Timesheet period not found" }, { status: 404 });

  // ---- build 14 day columns ----
  const columns = Array.from({ length: 14 }).map((_, i) => {
    const d = addDaysUTC(startDate, i);
    const iso = isoFromDate(d);
    const dayNum = String(d.getUTCDate()).padStart(2, "0");
    return { iso, day: weekdayShort(iso), date: dayNum };
  });
  const colIndex = new Map(columns.map((c, idx) => [c.iso, idx]));

  // ---- Load foreman SiteDays in range (for sitesLabel) ----
  const siteDays = await prisma.siteDay.findMany({
    where: {
      foremanId: foreman.id,
      workDate: { gte: startDate, lt: endExclusive },
    },
    select: {
      id: true,
      workDate: true,
      site: { select: { name: true } },
    },
    orderBy: { workDate: "asc" },
  });

  // ---- Load scans in range for foreman ----
  // This is the key: join through siteDay.foremanId so foreman only sees their own scans.
  const scans = await prisma.attendanceScan.findMany({
    where: {
      siteDay: {
        foremanId: foreman.id,
        workDate: { gte: startDate, lt: endExclusive },
      },
    },
    select: {
      siteDay: { select: { workDate: true } },
      employeeId: true,
      dayRateAtScan: true,
      employee: {
        select: {
          firstName: true,
          lastName: true,
          qrCodeValue: true, // <- this is your "code" in the app
          defaultDayRate: true,
        },
      },
    },
  });

  // If no data at all, treat as not found (matches UX)
  if (siteDays.length === 0 && scans.length === 0) {
    return NextResponse.json({ error: "Timesheet not found" }, { status: 404 });
  }

  // ---- sites label ----
  const siteNames = Array.from(
    new Set(siteDays.map((d) => d.site?.name).filter(Boolean) as string[]),
  );
  const sitesLabel = siteNames.length ? siteNames.join(", ") : "Sites";

  // ---- aggregate per employee ----
  type RowAgg = {
    employeeId: string;
    fullName: string;
    dayRate: number;
    present: boolean[]; // length 14
  };

  const byEmp = new Map<string, RowAgg>();

  for (const s of scans) {
    const iso = isoFromDate(s.siteDay.workDate);
    const idx = colIndex.get(iso);
    if (idx === undefined) continue; // outside 14 day window

    const empId = s.employeeId;
    const emp = s.employee;
    if (!emp) continue;

    const rate =
      decimalToNumber(s.dayRateAtScan) || decimalToNumber(emp.defaultDayRate);

    let agg = byEmp.get(empId);
    if (!agg) {
      agg = {
        employeeId: empId,
        fullName: fullName(emp),
        dayRate: rate,
        present: Array(14).fill(false),
      };
      byEmp.set(empId, agg);
    }

    agg.present[idx] = true;
    if (rate > 0) agg.dayRate = rate;
    const name = fullName(emp);
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

  return NextResponse.json({
    timesheet: {
      id: `${startISO}_${endISO}`,
      startISO,
      endISO,
      sitesLabel,
      columns,
      rows,
    },
  });
}
