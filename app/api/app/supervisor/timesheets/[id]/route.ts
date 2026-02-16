import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseSupervisorTimesheetId } from "@/lib/timesheetId";
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
    return { userId: payload.sub, role: payload.role } as {
      userId: string;
      role: string;
    };
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

function weekdayShortUTC(iso: string) {
  const d = new Date(`${iso}T00:00:00.000Z`);
  // keep consistent locale output (don’t rely on server locale)
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
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = auth.role;
    const userId = auth.userId;
    if (role !== "ADMIN" && role !== "SUPERVISOR") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;

    // Parse composite ID: YYYY-MM-DD_YYYY-MM-DD__FOREMANID
    const parsed = parseSupervisorTimesheetId(id);
    if (!parsed) {
      return NextResponse.json(
        {
          error: "Invalid id format. Expected YYYY-MM-DD_YYYY-MM-DD__FOREMANID",
        },
        { status: 400 },
      );
    }

    const startDate = startOfDayUTC(
      new Date(`${parsed.startISO}T00:00:00.000Z`),
    );
    const endDate = startOfDayUTC(new Date(`${parsed.endISO}T00:00:00.000Z`));
    const endExclusive = addDaysUTC(endDate, 1);

    const url = new URL(req.url);
    const siteIdFilter = url.searchParams.get("siteId");

    // Find or create the period
    const period = await prisma.timesheetPeriod.upsert({
      where: { startDate_endDate: { startDate, endDate } },
      create: { startDate, endDate },
      update: {},
      select: { id: true, startDate: true, endDate: true, label: true },
    });

    // Find or create the timesheet using the actual database relationship
    // Use findFirst + create pattern since siteId can be null
    let timesheet = await prisma.timesheet.findFirst({
      where: {
        periodId: period.id,
        foremanId: parsed.foremanId,
        siteId: siteIdFilter ?? null,
      },
      select: {
        id: true,
        status: true,
        submittedAt: true,
        foremanId: true,
        period: {
          select: { id: true, startDate: true, endDate: true, label: true },
        },
        foreman: { select: { id: true, user: { select: { name: true } } } },
        approvedBySupervisor: {
          select: { id: true, user: { select: { name: true } } },
        },
      },
    });

    if (!timesheet) {
      timesheet = await prisma.timesheet.create({
        data: {
          periodId: period.id,
          foremanId: parsed.foremanId,
          siteId: siteIdFilter ?? null,
        },
        select: {
          id: true,
          status: true,
          submittedAt: true,
          foremanId: true,
          period: {
            select: { id: true, startDate: true, endDate: true, label: true },
          },
          foreman: { select: { id: true, user: { select: { name: true } } } },
          approvedBySupervisor: {
            select: { id: true, user: { select: { name: true } } },
          },
        },
      });
    }

    if (!timesheet) {
      return NextResponse.json(
        { error: "Timesheet not found" },
        { status: 404 },
      );
    }

    // For supervisors: verify they supervise this foreman through site assignments
    if (role === "SUPERVISOR") {
      const supervisor = await prisma.supervisor.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!supervisor) {
        return NextResponse.json(
          { error: "Supervisor profile not found" },
          { status: 404 },
        );
      }

      // Check: does supervisor have active site assignments?
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

      if (siteIds.length === 0) {
        return NextResponse.json(
          { error: "You have no assigned sites" },
          { status: 403 },
        );
      }

      // Check: does this foreman have any work on any of the supervisor's sites
      // (and, if provided, on the requested site)?
      const foremansWork = await prisma.siteDay.findFirst({
        where: {
          foremanId: parsed.foremanId,
          siteId: siteIdFilter ? siteIdFilter : { in: siteIds },
          workDate: { gte: startDate, lt: endExclusive },
        },
        select: { id: true },
      });

      if (!foremansWork) {
        return NextResponse.json(
          { error: "This foreman did not work on your assigned sites" },
          { status: 403 },
        );
      }
    }

    const startISO = toISODateUTC(startDate);
    const endISO = toISODateUTC(endDate);

    // Build 14 day columns
    const columns = Array.from({ length: 14 }).map((_, i) => {
      const d = addDaysUTC(startDate, i);
      const iso = toISODateUTC(d);
      return { iso, day: weekdayShortUTC(iso) };
    });
    const colIndex = new Map(columns.map((c, idx) => [c.iso, idx]));

    // Sites worked in this period by this foreman (optionally filter by site)
    const siteRows = await prisma.siteDay.findMany({
      where: {
        foremanId: timesheet.foreman.id,
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

    // Scans in this period for this foreman (via SiteDay), optionally filtered by site
    const scans = await prisma.attendanceScan.findMany({
      where: {
        siteDay: {
          foremanId: timesheet.foreman.id,
          ...(siteIdFilter ? { siteId: siteIdFilter } : {}),
          workDate: { gte: startDate, lt: endExclusive },
        },
      },
      select: {
        employeeId: true,
        workDate: true,
        dayRateAtScan: true,
        employee: {
          select: {
            firstName: true,
            lastName: true,
            defaultDayRate: true,
          },
        },
      },
    });

    // Aggregate per employee
    type RowAgg = {
      employeeId: string;
      fullName: string;
      dayRate: number;
      present: boolean[];
      // unique day tracking to prevent duplicates
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

      // only count this employee+day once
      if (!agg.seenDay.has(iso)) {
        agg.seenDay.add(iso);
        agg.present[idx] = true;
      } else {
        // still mark presence
        agg.present[idx] = true;
      }

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

    const supervisorNameFromToken =
      role === "SUPERVISOR" ? undefined : undefined;

    const supervisor =
      role === "SUPERVISOR"
        ? { name: supervisorNameFromToken ?? "Supervisor" }
        : timesheet.approvedBySupervisor
          ? {
              id: timesheet.approvedBySupervisor.id,
              name: timesheet.approvedBySupervisor.user?.name ?? "Supervisor",
            }
          : null;

    return NextResponse.json({
      timesheet: {
        id: timesheet.id, // ✅ real Timesheet.id
        startISO,
        endISO,
        sitesLabel,
        foremanName: timesheet.foreman.user?.name ?? "Foreman",
        foreman: {
          id: timesheet.foreman.id,
          name: timesheet.foreman.user?.name ?? "Foreman",
        },
        supervisor,
        sites,
        status: timesheet.status,
        submittedAt: timesheet.submittedAt?.toISOString() ?? null,
        columns,
        rows,
        totals,
      },
    });
  } catch (e: any) {
    console.error("Error fetching timesheet detail:", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 },
    );
  }
}
