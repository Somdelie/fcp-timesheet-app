import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}

async function getAdminOrSupervisorFromRequest(req: NextRequest) {
  // 1) Prefer API Bearer token (mobile/third-party clients)
  const apiCtx = await requireApiAuth(req, ["ADMIN", "SUPERVISOR"]);
  if (apiCtx) {
    return { id: apiCtx.user.sub, role: apiCtx.user.role } as const;
  }

  // 2) Fallback to NextAuth web session (admin dashboard)
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;

  if (session?.user && (role === "ADMIN" || role === "SUPERVISOR")) {
    return { id: (session.user as any).id as string, role } as const;
  }

  return null;
}

function addDaysUTC(d: Date, days: number) {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function toISODateUTC(d: Date) {
  return d.toISOString().slice(0, 10);
}

function parseId(raw: string) {
  // Format: YYYY-MM-DD_YYYY-MM-DD_FOREMANID_SITEID
  const m = String(raw ?? "")
    .trim()
    .match(
      /^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})_([a-z0-9]+)_([a-z0-9]+)$/i,
    );
  if (!m) return null;
  return { startISO: m[1], endISO: m[2], foremanId: m[3], siteId: m[4] };
}

function startOfDayUTCFromISO(iso: string) {
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${iso}`);
  return d;
}

function weekdayShort(iso: string) {
  const d = new Date(`${iso}T00:00:00.000Z`);
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

/**
 * GET /api/app/admin/timesheets/:id
 * Get single timesheet detail (ADMIN/SUPERVISOR only, JWT auth for mobile)
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await getAdminOrSupervisorFromRequest(req);
    if (!actor) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS },
      );
    }

    const url = new URL(req.url);
    // siteId is now part of the ID, not a query param
    // const siteIdFilter = url.searchParams.get("siteId");

    const { id } = await ctx.params;
    const parsed = parseId(id);

    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid timesheet id format" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const { startISO, endISO, foremanId, siteId } = parsed;

    let startDate: Date;
    let endDate: Date;
    try {
      startDate = startOfDayUTCFromISO(startISO);
      endDate = startOfDayUTCFromISO(endISO);
    } catch (e: any) {
      return NextResponse.json(
        { error: e?.message ?? "Invalid dates" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const endExclusive = addDaysUTC(endDate, 1);

    // Get actual timesheet status from database (per foreman + site)
    const period = await prisma.timesheetPeriod.findUnique({
      where: { startDate_endDate: { startDate, endDate } },
      select: { id: true },
    });

    let timesheetStatus = "SUBMITTED";
    if (period) {
      const timesheet = await prisma.timesheet.findUnique({
        where: {
          periodId_foremanId_siteId: { periodId: period.id, foremanId, siteId },
        },
        select: { status: true },
      });
      if (timesheet) {
        timesheetStatus = timesheet.status;
      }
    }

    // Get foreman info
    const foreman = await prisma.foreman.findUnique({
      where: { id: foremanId },
      select: { id: true, user: { select: { name: true, employee: { select: { id: true } } } } },
    });

    if (!foreman) {
      return NextResponse.json(
        { error: "Foreman not found" },
        { status: 404, headers: CORS_HEADERS },
      );
    }

    // Build 14 day columns
    const columns = Array.from({ length: 14 }).map((_, i) => {
      const d = addDaysUTC(startDate, i);
      const iso = toISODateUTC(d);
      const dayNum = String(d.getUTCDate()).padStart(2, "0");
      return { iso, day: weekdayShort(iso), date: dayNum };
    });
    const colIndex = new Map(columns.map((c, idx) => [c.iso, idx]));

    // Get sites for this foreman in this period (filtered by siteId from ID)
    const siteIds = await prisma.siteDay.findMany({
      where: {
        foremanId,
        siteId: siteId,
        workDate: { gte: startDate, lt: endExclusive },
      },
      distinct: ["siteId"],
      select: { siteId: true },
    });

    const sites =
      siteIds.length === 0
        ? []
        : await prisma.site.findMany({
            where: { id: { in: siteIds.map((x) => x.siteId) } },
            select: { id: true, code: true, name: true },
            orderBy: [{ code: "asc" }, { name: "asc" }],
          });

    // Get scans for this foreman in this period (filtered by siteId)
    const scans = await prisma.attendanceScan.findMany({
      where: {
        siteDay: {
          foremanId,
          siteId: siteId,
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
            defaultDayRate: true,
          },
        },
      },
    });

    // If no data, treat as not found
    if (siteIds.length === 0 && scans.length === 0) {
      return NextResponse.json(
        { error: "Timesheet not found" },
        { status: 404, headers: CORS_HEADERS },
      );
    }

    // Aggregate per employee
    type RowAgg = {
      employeeId: string;
      fullName: string;
      dayRate: number;
      present: boolean[];
    };

    const byEmp = new Map<string, RowAgg>();

    for (const s of scans) {
      const iso = toISODateUTC(s.siteDay.workDate);
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
        };
        byEmp.set(s.employeeId, agg);
      }

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

    // Compute gross totals from rows
    const grossTotals = rows.reduce(
      (acc, r) => {
        acc.totalDays += r.daysWorked;
        acc.totalPay += r.pay;
        return acc;
      },
      { totalDays: 0, totalPay: 0 },
    );

    // DEDUCTIONS
    // For this timesheet period (startDate..endDate) for this foreman/site,
    // we apply deductions as follows:
    // - applyTo = CURRENT  => createdAt inside this period
    // - applyTo = NEXT     => createdAt inside the PREVIOUS 14-day period

    const prevPeriodStart = addDaysUTC(startDate, -14);
    const prevPeriodEnd = addDaysUTC(startDate, -1);

    const employeeIds = rows.map((r) => r.employeeId);

    let cashDeductions = 0;
    let productDeductions = 0;
    let deductionItems: {
      id: string;
      type: string;
      applyTo: string;
      amount: number;
      quantity: number | null;
      productName: string | null;
      employeeName: string;
      note: string | null;
      createdAt: string;
    }[] = [];

    if (employeeIds.length > 0) {
      const deductions = await prisma.deduction.findMany({
        where: {
          foremanId,
          employeeId: { in: employeeIds },
          OR: [
            {
              applyTo: "CURRENT",
              createdAt: { gte: startDate, lt: endExclusive },
            },
            {
              applyTo: "NEXT",
              createdAt: { gte: prevPeriodStart, lte: prevPeriodEnd },
            },
          ],
        },
        select: {
          id: true,
          type: true,
          applyTo: true,
          amount: true,
          quantity: true,
          note: true,
          createdAt: true,
          employee: {
            select: { firstName: true, lastName: true },
          },
          product: {
            select: { name: true, price: true },
          },
        },
      });

      deductionItems = deductions.map((d) => {
        let computedAmount = 0;
        if (d.type === "CASH") {
          computedAmount = decimalToNumber(d.amount);
        } else if (d.type === "PRODUCT") {
          if (d.amount != null && decimalToNumber(d.amount) > 0) {
            computedAmount = decimalToNumber(d.amount);
          } else {
            const qty = Number(d.quantity ?? 0);
            const price = decimalToNumber(d.product?.price ?? 0);
            computedAmount = qty > 0 && price > 0 ? qty * price : 0;
          }
        }
        return {
          id: d.id,
          type: d.type,
          applyTo: d.applyTo,
          amount: computedAmount,
          quantity: d.quantity,
          productName: d.product?.name ?? null,
          employeeName: `${d.employee.firstName} ${d.employee.lastName}`.trim(),
          note: d.note ?? null,
          createdAt: d.createdAt.toISOString(),
        };
      });

      for (const d of deductionItems) {
        if (d.type === "CASH") {
          cashDeductions += d.amount;
        } else {
          // PRODUCT (PPE/tools) — reduce foreman net pay but NOT site wages cost
          productDeductions += d.amount;
        }
      }
    }

    const totalDeductions = cashDeductions + productDeductions;

    // OVERTIME: sum overtime entries for this foreman/site in the period
    const overtimeEntries = await prisma.overtimeEntry.findMany({
      where: {
        foremanId,
        siteId,
        workDate: { gte: startDate, lt: endExclusive },
      },
      select: { totalCost: true },
    });

    let overtimeTotal = 0;
    for (const ot of overtimeEntries) {
      overtimeTotal += decimalToNumber(ot.totalCost);
    }

    // wagesCost = what the site pays — only reduced by CASH deductions
    // netPay    = what the foreman actually receives — reduced by ALL deductions
    const wagesCost = grossTotals.totalPay + overtimeTotal - cashDeductions;
    const netPay = grossTotals.totalPay + overtimeTotal - totalDeductions;

    // Get supervisor for this foreman (derived from site assignments)
    // If foreman is assigned to a site, and supervisor is assigned to that same site,
    // then they supervise the foreman for that site
    let supervisor: { id: string; name: string } | null = null;

    if (sites.length > 0) {
      // Get supervisor assignment for the first site
      const supAssignment = await prisma.supervisorSiteAssignment.findFirst({
        where: {
          siteId: { in: sites.map((s) => s.id) },
        },
        select: {
          supervisor: {
            select: { id: true, user: { select: { name: true } } },
          },
        },
      });

      if (supAssignment?.supervisor) {
        supervisor = {
          id: supAssignment.supervisor.id,
          name: supAssignment.supervisor.user?.name ?? "Supervisor",
        };
      }
    }

    return NextResponse.json(
      {
        timesheet: {
          id,
          startISO,
          endISO,
          status: timesheetStatus,
          foreman: { id: foreman.id, name: foreman.user?.name ?? "Foreman", employeeId: foreman.user?.employee?.id ?? null },
          supervisor,
          sites,
          columns,
          rows,
          totals: {
            totalDays: grossTotals.totalDays,
            totalPay: grossTotals.totalPay,
            overtimeTotal,
            cashDeductions,
            productDeductions,
            totalDeductions,
            wagesCost,
            netPay,
          },
          deductions: deductionItems,
        },
      },
      { headers: CORS_HEADERS },
    );
  } catch (e: any) {
    console.error("Error fetching timesheet:", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
