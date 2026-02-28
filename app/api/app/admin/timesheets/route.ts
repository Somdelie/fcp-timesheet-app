import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFortnightForDateUTC } from "@/lib/timesheetPeriods";
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

/**
 * GET /api/app/admin/timesheets
 * List timesheets with filters (ADMIN/SUPERVISOR only, JWT auth for mobile)
 */
export async function GET(req: NextRequest) {
  try {
    const actor = await getAdminOrSupervisorFromRequest(req);
    if (!actor) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS },
      );
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
        siteDay: {
          select: { foremanId: true, workDate: true, siteId: true },
        },
        siteId: true,
        employeeId: true,
        dayRateAtScan: true,
        employee: { select: { defaultDayRate: true } },
      },
    });

    if (siteDays.length === 0 && scans.length === 0) {
      return NextResponse.json(
        {
          timesheets: [],
          period: { id: `${startISO}_${endISO}`, startISO, endISO },
        },
        { headers: CORS_HEADERS },
      );
    }

    // Group sites by foreman (per-site, not aggregated)
    type SiteLite = { id: string; code: string | null; name: string };

    const sitesByForeman = new Map<string, Map<string, SiteLite>>();

    for (const sd of siteDays) {
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

    const foremanIds = Array.from(new Set(siteDays.map((sd) => sd.foremanId)));

    // Resolve each Foreman's Employee ID (Foreman.id ≠ Employee.id; they share the same User)
    const foremanRecords = foremanIds.length
      ? await prisma.foreman.findMany({
          where: { id: { in: foremanIds } },
          select: {
            id: true,
            user: { select: { employee: { select: { id: true } } } },
          },
        })
      : [];
    const foremanIdToEmployeeId = new Map<string, string>();
    for (const f of foremanRecords) {
      if (f.user?.employee?.id) {
        foremanIdToEmployeeId.set(f.id, f.user.employee.id);
      }
    }

    // Compute totals per (foreman, site) - separate foreman vs team
    const scansByForemanSite = new Map<
      string,
      Array<{
        date: string;
        wage: number;
        employeeId: string;
        isForeman: boolean;
      }>
    >();

    for (const scan of scans) {
      const foremanId = scan.siteDay.foremanId;
      const siteId = scan.siteId;

      if (!siteId) continue;

      const dateISO = toISODateUTC(scan.siteDay.workDate);

      const rate =
        decimalToNumber(scan.dayRateAtScan) ||
        decimalToNumber(scan.employee?.defaultDayRate);

      const key = `${foremanId}__${siteId}`;
      const list = scansByForemanSite.get(key) ?? [];
      list.push({
        date: dateISO,
        wage: rate,
        employeeId: scan.employeeId,
        isForeman:
          scan.employeeId ===
          (foremanIdToEmployeeId.get(foremanId) ?? foremanId),
      });
      scansByForemanSite.set(key, list);
    }

    const totalsByForemanSite = new Map<
      string,
      {
        days: number;
        wages: number;
        foremanDays: number;
        foremanWages: number;
        teamDays: number;
        teamWages: number;
      }
    >();

    for (const [key, list] of scansByForemanSite.entries()) {
      const uniquePairs = new Set<string>();
      const foremanPairs = new Set<string>();
      const teamPairs = new Set<string>();
      let totalWages = 0;
      let foremanWages = 0;
      let teamWages = 0;

      for (const s of list) {
        const pairKey = `${s.employeeId}-${s.date}`;
        if (!uniquePairs.has(pairKey)) {
          uniquePairs.add(pairKey);
          totalWages += s.wage;

          if (s.isForeman) {
            foremanPairs.add(pairKey);
            foremanWages += s.wage;
          } else {
            teamPairs.add(pairKey);
            teamWages += s.wage;
          }
        }
      }

      totalsByForemanSite.set(key, {
        days: uniquePairs.size,
        wages: totalWages,
        foremanDays: foremanPairs.size,
        foremanWages,
        teamDays: teamPairs.size,
        teamWages,
      });
    }

    // ✅ REAL STATUS: pull from Timesheet table (per foreman + site)
    const timesheetRows = await prisma.timesheet.findMany({
      where: { periodId, foremanId: { in: foremanIds } },
      select: {
        foremanId: true,
        siteId: true,
        status: true,
      },
    });

    const statusByForemanSite = new Map(
      timesheetRows
        .filter((t) => t.siteId)
        .map((t) => [`${t.foremanId}__${t.siteId}`, t.status]),
    );

    // Supervisor derived from site assignments (per site)
    const siteIdsInPeriod = Array.from(
      new Set(siteDays.map((sd) => sd.site.id)),
    );

    const supervisorSiteAssignments =
      await prisma.supervisorSiteAssignment.findMany({
        where: { siteId: { in: siteIdsInPeriod } },
        select: {
          supervisor: {
            select: {
              id: true,
              userId: true,
              user: { select: { name: true } },
            },
          },
          siteId: true,
        },
      });

    const supervisorsBySite = new Map<string, { id: string; name: string }>();
    for (const a of supervisorSiteAssignments) {
      supervisorsBySite.set(a.siteId, {
        // Use userId (User table ID) so it matches the supervisor dropdown values
        id: a.supervisor.userId,
        name: a.supervisor.user?.name ?? "Supervisor",
      });
    }

    // ✅ DEDUCTIONS: batch-query all deductions for foremen in this period
    // Same logic as detail API:
    //   applyTo=CURRENT => createdAt inside this period
    //   applyTo=NEXT    => createdAt inside the PREVIOUS 14-day period
    const prevPeriodStart = addDaysUTC(startDate, -14);
    const prevPeriodEnd = addDaysUTC(startDate, -1);

    const allDeductions =
      foremanIds.length > 0
        ? await prisma.deduction.findMany({
            where: {
              foremanId: { in: foremanIds },
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
              foremanId: true,
              type: true,
              amount: true,
              quantity: true,
              product: { select: { price: true } },
            },
          })
        : [];

    // Sum deductions per foreman
    const deductionsByForeman = new Map<string, number>();
    for (const d of allDeductions) {
      let amt = 0;
      if (d.type === "CASH") {
        amt = decimalToNumber(d.amount);
      } else if (d.type === "PRODUCT") {
        const qty = Number(d.quantity ?? 0);
        const price = decimalToNumber(d.product?.price ?? 0);
        if (qty > 0 && price > 0) amt = qty * price;
      }
      if (amt > 0) {
        deductionsByForeman.set(
          d.foremanId,
          (deductionsByForeman.get(d.foremanId) ?? 0) + amt,
        );
      }
    }

    // Build response - one row per (foreman, site)
    const siteDaysByForeman = new Map<string, typeof siteDays>();
    for (const sd of siteDays) {
      if (!siteDaysByForeman.has(sd.foremanId)) {
        siteDaysByForeman.set(sd.foremanId, []);
      }
      siteDaysByForeman.get(sd.foremanId)!.push(sd);
    }

    const rows: Array<{
      id: string;
      startISO: string;
      endISO: string;
      status: string;
      foreman: { id: string; name: string };
      supervisor: { id: string; name: string } | null;
      totalWorkerDays: number;
      totalWorkerWages: number;
      foremanDays: number;
      foremanWages: number;
      teamDays: number;
      teamWages: number;
      totalDeductions: number;
      sites: SiteLite[];
    }> = [];

    for (const foremanId of foremanIds) {
      const siteDaysForForeman = siteDaysByForeman.get(foremanId) || [];
      const foremanName =
        siteDaysForForeman[0]?.foreman.user?.name ?? "Foreman";

      const siteMap = sitesByForeman.get(foremanId);
      const sites = siteMap ? Array.from(siteMap.values()) : [];

      for (const site of sites) {
        const key = `${foremanId}__${site.id}`;
        const totals =
          totalsByForemanSite.get(key) ||
          ({
            days: 0,
            wages: 0,
            foremanDays: 0,
            foremanWages: 0,
            teamDays: 0,
            teamWages: 0,
          } as const);

        // Skip sites that have no attendance scans in this period
        if (!totals.days) continue;

        const supervisor = supervisorsBySite.get(site.id) ?? null;
        const timesheetStatus = statusByForemanSite.get(key) ?? "SUBMITTED";

        rows.push({
          id: `${startISO}_${endISO}_${foremanId}_${site.id}`,
          startISO,
          endISO,
          status: timesheetStatus,
          foreman: { id: foremanId, name: foremanName },
          supervisor,
          totalWorkerDays: totals.days,
          totalWorkerWages: totals.wages,
          foremanDays: totals.foremanDays,
          foremanWages: totals.foremanWages,
          teamDays: totals.teamDays,
          teamWages: totals.teamWages,
          totalDeductions: deductionsByForeman.get(foremanId) ?? 0,
          sites: [site],
        });
      }
    }

    const timesheets = rows
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
        ) {
          return false;
        }

        // supervisor filter
        if (supervisorId && supervisorId !== "ALL") {
          if (!row.supervisor || row.supervisor.id !== supervisorId) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => a.foreman.name.localeCompare(b.foreman.name));

    return NextResponse.json(
      {
        timesheets,
        period: { id: `${startISO}_${endISO}`, startISO, endISO },
      },
      { headers: CORS_HEADERS },
    );
  } catch (e: any) {
    console.error("Error fetching timesheets:", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
