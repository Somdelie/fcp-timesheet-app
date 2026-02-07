import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import {
  addDaysUTC,
  isoFromDateUTC,
  startOfDayUTC,
  decimalToNumber,
} from "@/lib/dateUtc";
import { makeSupervisorTimesheetId } from "@/lib/timesheetId";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

function safeUpper(s: string) {
  return (s ?? "").trim().toUpperCase();
}

function safeLower(s: string) {
  return (s ?? "").trim().toLowerCase();
}

/**
 * Fortnight rules:
 * - weeks run Sat -> Fri
 * - fortnight = 14 days (Sat->Fri, Sat->Fri)
 *
 * Given any date, find the Saturday that starts its week (UTC).
 * JS: getUTCDay(): Sun=0..Sat=6
 * We want: Sat as start.
 */
function startOfWeekSatUTC(date: Date) {
  const js = date.getUTCDay(); // 0..6
  const back = (js + 1) % 7; // Sat(6)->0, Sun(0)->1, Mon(1)->2 ...
  const start = addDaysUTC(date, -back);
  return startOfDayUTC(isoFromDateUTC(start));
}

function fortnightForWorkDateISO(workDateISO: string) {
  const d = startOfDayUTC(workDateISO);
  const start = startOfWeekSatUTC(d);
  const end = addDaysUTC(start, 13);
  return { startISO: isoFromDateUTC(start), endISO: isoFromDateUTC(end) };
}

function fullName(name?: string | null) {
  const x = String(name ?? "").trim();
  return x.length ? x : "—";
}

export async function GET(req: Request) {
  let userId: string | null = null;
  let role: string | null = null;

  const token = getBearer(req);

  if (token) {
    const payload = await verifyApiToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
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

  const url = new URL(req.url);
  const q = safeLower(url.searchParams.get("q") ?? "");
  const status = safeUpper(url.searchParams.get("status") ?? "ALL") as
    | "ALL"
    | "SUBMITTED"
    | "APPROVED"
    | "REJECTED"
    | "PAID";

  const limitRaw = Number(url.searchParams.get("limit") ?? "30");
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 200
      ? limitRaw
      : 30;

  const supervisor = await prisma.supervisor.findUnique({
    where: { userId },
    select: { id: true, user: { select: { name: true } } },
  });
  if (!supervisor) {
    return NextResponse.json(
      { error: "Supervisor not found" },
      { status: 404 },
    );
  }

  // Sites this supervisor manages
  const siteAssignments = await prisma.supervisorSiteAssignment.findMany({
    where: { supervisorId: supervisor.id },
    select: { siteId: true },
  });

  const siteIds = Array.from(new Set(siteAssignments.map((a) => a.siteId)));
  if (siteIds.length === 0) return NextResponse.json({ timesheets: [] });

  // Pull recent SiteDays (this is what defines which fortnights exist).
  // Default window: last 180 days (adjust anytime).
  const now = new Date();
  const windowStart = addDaysUTC(now, -180);
  const windowEnd = addDaysUTC(now, 1); // include today

  const siteDays = await prisma.siteDay.findMany({
    where: {
      siteId: { in: siteIds },
      workDate: { gte: windowStart, lt: windowEnd },
    },
    select: {
      foremanId: true,
      workDate: true,
      site: { select: { id: true, name: true, code: true } },
      foreman: { select: { user: { select: { name: true } } } },
    },
    orderBy: { workDate: "desc" },
  });

  if (siteDays.length === 0) return NextResponse.json({ timesheets: [] });

  // Preload scans for these sites/foremen in the same window so we can
  // compute worker-day counts and wages per fortnight/foreman.
  const scans = await prisma.attendanceScan.findMany({
    where: {
      siteDay: {
        siteId: { in: siteIds },
        workDate: { gte: windowStart, lt: windowEnd },
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

  // Group by (fortnightStart, foremanId)
  type Group = {
    startISO: string;
    endISO: string;
    foremanId: string;
    foremanName: string;

    // representative site (most recent in that fortnight)
    siteId: string;
    siteName: string;
    siteCode?: string | null;

    // filled later from actual Timesheet row
    status: "SUBMITTED" | "APPROVED" | "REJECTED" | "PAID";

    // filled later from scans
    totalWorkerDays?: number;
    totalWorkerWages?: number;
  };

  const groups = new Map<string, Group>(); // key = `${startISO}__${foremanId}`

  for (const sd of siteDays) {
    if (!sd.foremanId) continue;

    const workISO = isoFromDateUTC(sd.workDate);
    const { startISO, endISO } = fortnightForWorkDateISO(workISO);

    const key = `${startISO}__${sd.foremanId}`;

    if (!groups.has(key)) {
      groups.set(key, {
        startISO,
        endISO,
        foremanId: sd.foremanId,
        foremanName: fullName(sd.foreman?.user?.name),
        siteId: sd.site.id,
        siteName: sd.site.name,
        siteCode: sd.site.code ?? null,
        status: "SUBMITTED",
      });
    }
  }

  // Aggregate scans into worker-day + wage totals per (fortnight, foreman).
  const scansByGroup = new Map<
    string,
    Array<{ date: string; employeeId: string; wage: number }>
  >();

  for (const scan of scans) {
    const foremanId = scan.siteDay.foremanId;
    if (!foremanId) continue;

    const workISO = isoFromDateUTC(scan.siteDay.workDate);
    const { startISO, endISO } = fortnightForWorkDateISO(workISO);
    const key = `${startISO}__${foremanId}`;

    const rate =
      decimalToNumber(scan.dayRateAtScan) ||
      decimalToNumber(scan.employee?.defaultDayRate);

    if (!scansByGroup.has(key)) scansByGroup.set(key, []);
    scansByGroup.get(key)!.push({
      date: workISO,
      employeeId: scan.employeeId,
      wage: rate,
    });
  }

  for (const [key, arr] of scansByGroup.entries()) {
    const uniquePairs = new Set<string>();
    let totalWages = 0;

    for (const s of arr) {
      const pairKey = `${s.employeeId}-${s.date}`;
      if (!uniquePairs.has(pairKey)) {
        uniquePairs.add(pairKey);
        totalWages += s.wage;
      }
    }

    const g = groups.get(key);
    if (g) {
      g.totalWorkerDays = uniquePairs.size;
      g.totalWorkerWages = totalWages;
    }
  }

  // Convert to array, newest first, then limit
  let list = Array.from(groups.values()).sort((a, b) =>
    a.startISO < b.startISO ? 1 : a.startISO > b.startISO ? -1 : 0,
  );

  // optional search filter (foreman or site)
  if (q.length) {
    list = list.filter((x) => {
      const s =
        `${x.foremanName} ${x.siteName} ${x.siteCode ?? ""}`.toLowerCase();
      return s.includes(q);
    });
  }

  // Hard cap before expensive lookups
  list = list.slice(0, limit);

  // Load statuses (ensure period + timesheet row exists)
  // We do small upserts per item — OK at this scale.
  for (const item of list) {
    const startDate = startOfDayUTC(item.startISO);
    const endDate = startOfDayUTC(item.endISO);

    const period = await prisma.timesheetPeriod.upsert({
      where: { startDate_endDate: { startDate, endDate } },
      create: { startDate, endDate },
      update: {},
      select: { id: true },
    });

    const ts = await prisma.timesheet.upsert({
      where: {
        periodId_foremanId: { periodId: period.id, foremanId: item.foremanId },
      },
      // Prisma schema default for Timesheet.status is SUBMITTED
      create: { periodId: period.id, foremanId: item.foremanId },
      update: {},
      select: { status: true },
    });

    item.status = ts.status;
  }

  if (status !== "ALL") {
    list = list.filter((x) => x.status === status);
  }

  return NextResponse.json({
    timesheets: list.map((t) => ({
      id: makeSupervisorTimesheetId(t.startISO, t.endISO, t.foremanId),
      startISO: t.startISO,
      endISO: t.endISO,

      foremanName: t.foremanName,
      siteCode: t.siteCode ?? null,
      siteName: t.siteName,

      status: t.status,
      totalWorkerDays: t.totalWorkerDays ?? 0,
      totalWorkerWages: t.totalWorkerWages ?? 0,
    })),
  });
}
