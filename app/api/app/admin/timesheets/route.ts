import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MS_DAY = 24 * 60 * 60 * 1000;

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

function decimalToNumber(v: any): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v?.toNumber === "function") return v.toNumber();
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Fortnight = Sat..Fri (14 days). We compute "current fortnight" in UTC.
 * Anchor to a known Saturday so it's stable.
 */
const ANCHOR_SAT = new Date("2024-01-06T00:00:00.000Z"); // Saturday

function currentFortnightSatFriUTC(now = new Date()) {
  const today = startOfDayUTC(now);

  // get most recent Saturday
  // JS: Sun=0..Sat=6, want back to 6
  const backToSat = (today.getUTCDay() + 1) % 7; // Sat->0, Sun->1, Mon->2 ... Fri->6
  const sat = addDaysUTC(today, -backToSat);

  // align to 14-day cycle
  const diffDays = Math.floor((sat.getTime() - ANCHOR_SAT.getTime()) / MS_DAY);
  const mod14 = ((diffDays % 14) + 14) % 14;
  const start = addDaysUTC(sat, -mod14);
  const end = addDaysUTC(start, 13);

  return {
    startDate: start,
    endDate: end,
    startISO: toISODateUTC(start),
    endISO: toISODateUTC(end),
    id: `${toISODateUTC(start)}_${toISODateUTC(end)}`,
  };
}

function parsePeriodId(raw: string | null) {
  const s = String(raw ?? "").trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/);
  if (!m) return null;
  return { startISO: m[1], endISO: m[2] };
}

function startOfDayUTCFromISO(iso: string) {
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${iso}`);
  return d;
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
    const status = (url.searchParams.get("status") ?? "").trim();
    const periodRaw = url.searchParams.get("period");

    const current = currentFortnightSatFriUTC();
    const parsed = parsePeriodId(periodRaw);

    const startISO = parsed?.startISO ?? current.startISO;
    const endISO = parsed?.endISO ?? current.endISO;

    const startDate = startOfDayUTCFromISO(startISO);
    const endDate = startOfDayUTCFromISO(endISO);
    const endExclusive = addDaysUTC(endDate, 1);

    // Get all site days in this period
    const siteDays = await prisma.siteDay.findMany({
      where: {
        workDate: { gte: startDate, lt: endExclusive },
      },
      select: {
        id: true,
        foremanId: true,
        workDate: true,
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
        employee: {
          select: {
            defaultDayRate: true,
          },
        },
      },
    });

    // If no data at all, return empty list
    if (siteDays.length === 0 && scans.length === 0) {
      return NextResponse.json({ timesheets: [] });
    }

    // Group site days by foreman
    type ForemanAgg = {
      foremanId: string;
      foremanName: string;
      sites: Map<string, { id: string; code: string | null; name: string }>;
      totalWorkerDays: number;
      totalWorkerWages: number;
    };

    const byForeman = new Map<string, ForemanAgg>();

    // Process site days to build site list per foreman
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

    // Process scans to compute totals per foreman
    const scansByForeman = new Map<
      string,
      Array<{ date: string; wage: number; employeeId: string }>
    >();

    for (const scan of scans) {
      const foremanId = scan.siteDay.foremanId;

      let agg = byForeman.get(foremanId);
      if (!agg) {
        agg = {
          foremanId,
          foremanName: "Unknown",
          sites: new Map(),
          totalWorkerDays: 0,
          totalWorkerWages: 0,
        };
        byForeman.set(foremanId, agg);
      }

      const dateISO = toISODateUTC(scan.siteDay.workDate);
      if (!scansByForeman.has(foremanId)) {
        scansByForeman.set(foremanId, []);
      }

      const rate =
        decimalToNumber(scan.dayRateAtScan) ||
        decimalToNumber(scan.employee?.defaultDayRate);

      scansByForeman.get(foremanId)!.push({
        date: dateISO,
        wage: rate,
        employeeId: scan.employeeId,
      });
    }

    // Calculate total worker-days and total wages per foreman
    // A "worker-day" is a unique (employee, date) pair with at least one scan.
    for (const [foremanId, scansForForeman] of scansByForeman.entries()) {
      const uniquePairs = new Set<string>();
      let totalWages = 0;

      for (const s of scansForForeman) {
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

    // Fetch supervisor links derived from site assignments
    // Logic: If Foreman F is assigned to Site S, and Supervisor V is assigned to Site S,
    // then V supervises F for that site (many-to-many relationship through sites)

    // Get all supervisor assignments for the sites worked in this period
    const supervisorSiteAssignments =
      await prisma.supervisorSiteAssignment.findMany({
        where: {
          siteId: {
            in: Array.from(
              new Set(
                Array.from(byForeman.values()).flatMap((agg) =>
                  Array.from(agg.sites.keys()),
                ),
              ),
            ),
          },
        },
        select: {
          supervisor: {
            select: {
              id: true,
              user: { select: { name: true } },
            },
          },
          siteId: true,
        },
      });

    // Build map of supervisor per site
    const supervisorsBySite = new Map<string, { id: string; name: string }>();
    for (const assignment of supervisorSiteAssignments) {
      supervisorsBySite.set(assignment.siteId, {
        id: assignment.supervisor.id,
        name: assignment.supervisor.user?.name ?? "Supervisor",
      });
    }

    // Build map of supervisor per foreman based on their site assignments
    const supervisorByForeman = new Map<
      string,
      { id: string; name: string } | null
    >();
    for (const agg of byForeman.values()) {
      // Get the first site's supervisor (since a foreman can work multiple sites,
      // we take the supervisor from one of their assigned sites)
      for (const siteId of agg.sites.keys()) {
        const sup = supervisorsBySite.get(siteId);
        if (sup) {
          supervisorByForeman.set(agg.foremanId, sup);
          break; // Take first supervisor found
        }
      }
      // If no supervisor found for any site, set to null
      if (!supervisorByForeman.has(agg.foremanId)) {
        supervisorByForeman.set(agg.foremanId, null);
      }
    }

    // Convert to list and apply filters
    const timesheets = Array.from(byForeman.values())
      .map((agg) => {
        const sup = supervisorByForeman.get(agg.foremanId);
        return {
          id: `${startISO}_${endISO}_${agg.foremanId}`,
          startISO,
          endISO,
          status: "SUBMITTED", // Timesheets default to SUBMITTED after scanning
          foreman: {
            id: agg.foremanId,
            name: agg.foremanName,
          },
          supervisor: sup ?? null,
          totalWorkerDays: agg.totalWorkerDays,
          totalWorkerWages: agg.totalWorkerWages,
          sites: Array.from(agg.sites.values()),
        };
      })
      .filter((row) => {
        // Filter by search query
        if (q) {
          const searchLower = q.toLowerCase();
          const matchForeman = row.foreman.name
            .toLowerCase()
            .includes(searchLower);
          const matchSite = row.sites.some(
            (s) =>
              s.name.toLowerCase().includes(searchLower) ||
              (s.code && s.code.toLowerCase().includes(searchLower)),
          );
          if (!matchForeman && !matchSite) return false;
        }

        // Filter by status
        if (status && status !== "ALL" && row.status !== status) return false;

        // Filter by supervisor
        if (supervisorId && supervisorId !== "ALL") {
          if (!row.supervisor || row.supervisor.id !== supervisorId) {
            return false;
          }
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
