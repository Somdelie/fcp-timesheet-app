import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { parseSupervisorTimesheetId } from "@/lib/timesheetId";
import {
  addDaysUTC,
  decimalToNumber,
  isoFromDateUTC,
  startOfDayUTC,
  weekdayShortLocal,
} from "@/lib/dateUtc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

function fullName(emp: { firstName: string; lastName: string }) {
  return `${emp.firstName} ${emp.lastName}`.trim();
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  let userId: string | null = null;
  let role: string | null = null;

  const token = getBearer(req);

  if (token) {
    const payload = await verifyApiToken(token);
    if (!payload)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    userId = payload.sub;
    role = payload.role;
  } else {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    userId = user?.id ?? null;
    role = user?.role ?? null;
  }

  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (role !== "SUPERVISOR")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supervisor = await prisma.supervisor.findUnique({
    where: { userId },
    select: { id: true, user: { select: { name: true } } },
  });
  if (!supervisor)
    return NextResponse.json(
      { error: "Supervisor not found" },
      { status: 404 },
    );

  const { id } = await ctx.params;
  const parsed = parseSupervisorTimesheetId(id);
  if (!parsed) {
    return NextResponse.json(
      { error: "Invalid id. Expected YYYY-MM-DD_YYYY-MM-DD__FOREMANID" },
      { status: 400 },
    );
  }

  const { startISO, endISO, foremanId } = parsed;

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

  const endExclusive = addDaysUTC(endDate, 1);

  // Access check: supervisor must have assignments to sites where this foreman worked in this window
  const siteAssignments = await prisma.supervisorSiteAssignment.findMany({
    where: { supervisorId: supervisor.id },
    select: { siteId: true },
  });

  const siteIds = Array.from(new Set(siteAssignments.map((a) => a.siteId)));
  if (siteIds.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const hasSiteDay = await prisma.siteDay.findFirst({
    where: {
      foremanId,
      siteId: { in: siteIds },
      workDate: { gte: startDate, lt: endExclusive },
    },
    select: { id: true },
  });

  if (!hasSiteDay) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const period = await prisma.timesheetPeriod.upsert({
    where: { startDate_endDate: { startDate, endDate } },
    create: { startDate, endDate },
    update: {},
    select: { id: true },
  });

  // Ensure Timesheet exists so we can show status and allow approve/reject
  const tsRow = await prisma.timesheet.upsert({
    where: { periodId_foremanId: { periodId: period.id, foremanId } },
    create: { periodId: period.id, foremanId },
    update: {},
    select: {
      status: true,
      foreman: { select: { user: { select: { name: true } } } },
      submittedAt: true,
      approvedAt: true,
      rejectedAt: true,
      paidAt: true,
    },
  });

  // 14-day columns (Sat→Fri works as long as startISO is Sat)
  const columns = Array.from({ length: 14 }).map((_, i) => {
    const d = addDaysUTC(startDate, i);
    const iso = isoFromDateUTC(d);
    return { iso, day: weekdayShortLocal(iso) };
  });
  const colIndex = new Map(columns.map((c, idx) => [c.iso, idx]));

  // Sites in this period (code + name)
  const siteDays = await prisma.siteDay.findMany({
    where: { foremanId, workDate: { gte: startDate, lt: endExclusive } },
    select: { site: { select: { id: true, name: true, code: true } } },
  });

  const sitesMap = new Map<
    string,
    { id: string; name: string; code?: string | null }
  >();
  for (const d of siteDays) sitesMap.set(d.site.id, d.site);
  const sites = Array.from(sitesMap.values());

  // Scans in range (by foreman)
  const scans = await prisma.attendanceScan.findMany({
    where: {
      siteDay: { foremanId, workDate: { gte: startDate, lt: endExclusive } },
    },
    select: {
      siteDay: { select: { workDate: true } },
      employeeId: true,
      dayRateAtScan: true,
      employee: {
        select: { firstName: true, lastName: true, defaultDayRate: true },
      },
    },
  });

  if (sites.length === 0 && scans.length === 0) {
    return NextResponse.json({ error: "Timesheet not found" }, { status: 404 });
  }

  const foremanName = tsRow.foreman?.user?.name ?? "—";
  const supervisorName = supervisor.user?.name ?? "—";
  const sitesLabel =
    sites.length === 0
      ? "—"
      : sites
          .map((s) => (s.code ? `${s.code} – ${s.name}` : s.name))
          .join(", ");

  // Aggregate per employee
  type RowAgg = {
    employeeId: string;
    fullName: string;
    dayRate: number;
    present: boolean[];
  };

  const byEmp = new Map<string, RowAgg>();

  for (const s of scans) {
    const iso = isoFromDateUTC(s.siteDay.workDate);
    const idx = colIndex.get(iso);
    if (idx === undefined) continue;

    const emp = s.employee;
    if (!emp) continue;

    const rate =
      decimalToNumber(s.dayRateAtScan) || decimalToNumber(emp.defaultDayRate);

    let agg = byEmp.get(s.employeeId);
    if (!agg) {
      agg = {
        employeeId: s.employeeId,
        fullName: fullName(emp),
        dayRate: rate,
        present: Array(14).fill(false),
      };
      byEmp.set(s.employeeId, agg);
    }

    agg.present[idx] = true;
    if (rate > 0) agg.dayRate = rate;
    const nm = fullName(emp);
    if (nm) agg.fullName = nm;
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

  const totalDays = rows.reduce((s, r) => s + (r.daysWorked ?? 0), 0);
  const totalPay = rows.reduce((s, r) => s + (r.pay ?? 0), 0);

  return NextResponse.json({
    timesheet: {
      id,
      startISO,
      endISO,

      status: tsRow.status,
      submittedAt: tsRow.submittedAt,

      // ✅ MOBILE FRIENDLY FIELDS
      foremanName,
      supervisor: { id: supervisor.id, name: supervisorName },
      supervisorName,
      sitesLabel,

      // optional richer fields
      sites,

      columns,
      rows,

      totals: { totalDays, totalPay },
    },
  });
}
