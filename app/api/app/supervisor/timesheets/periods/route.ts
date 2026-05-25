import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { addDaysUTC, startOfDayUTC, isoFromDateUTC } from "@/lib/dateUtc";
// Assuming a server-side PDF generation utility
import { generateSupervisorSummaryPdf } from "@/lib/generateSupervisorSummaryPdf"; // NEW UTILITY

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

async function getAuth(req: Request) {
  const token = getBearer(req);
  if (!token) {
    const session = await getServerSession(authOptions);
    const u = session?.user as any;
    if (!u?.id) return null;
    return { userId: u.id as string, role: u.role as string };
  }
  const payload = await verifyApiToken(token);
  if (!payload) return null;
  return { userId: payload.sub, role: payload.role };
}

function decimalToNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const anyV = v as any;
  if (typeof anyV?.toNumber === "function") return anyV.toNumber();
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(req: Request) {
  try {
    const auth = await getAuth(req);
    if (!auth || auth.role !== "SUPERVISOR") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const userId = auth.userId;
    const url = new URL(req.url);
    const periodId = url.searchParams.get("periodId");

    if (!periodId) {
      return NextResponse.json(
        { error: "Missing periodId parameter" },
        { status: 400 },
      );
    }

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

    let period = await prisma.timesheetPeriod.findUnique({
      where: { id: periodId },
      select: { id: true, startDate: true, endDate: true },
    });

    if (!period) {
      // Handle case where periodId might be a temporary one (e.g., "YYYY-MM-DD_YYYY-MM-DD")
      const periodParts = periodId.split("_");
      if (periodParts.length === 2) {
        const tempStartDate = startOfDayUTC(periodParts[0]);
        const tempEndDate = startOfDayUTC(periodParts[1]);
        period = {
          id: periodId,
          startDate: tempStartDate,
          endDate: tempEndDate,
        };
      } else {
        return NextResponse.json(
          { error: "Period not found" },
          { status: 404 },
        );
      }
    }

    const { startDate, endDate } = period;
    const startISO = isoFromDateUTC(startDate);
    const endISO = isoFromDateUTC(endDate);
    const endExclusive = addDaysUTC(endDate, 1);

    // Get sites this supervisor is assigned to (active assignments only)
    const now = new Date();
    const supervisorSiteAssignments =
      await prisma.supervisorSiteAssignment.findMany({
        where: {
          supervisorId: supervisor.id,
          startsOn: { lte: now },
          OR: [{ endsOn: null }, { endsOn: { gt: now } }],
        },
        select: { siteId: true },
      });

    const siteIds = supervisorSiteAssignments.map((a) => a.siteId);

    if (siteIds.length === 0) {
      return NextResponse.json(
        { error: "No sites assigned to this supervisor" },
        { status: 400 },
      );
    }

    // Fetch all relevant timesheet data for the supervisor for that period
    const timesheetRecords = await prisma.timesheet.findMany({
      where: {
        periodId: period.id,
        siteId: { in: siteIds },
        foreman: {
          siteDays: {
            some: {
              workDate: { gte: startDate, lt: endExclusive },
              siteId: { in: siteIds },
            },
          },
        },
      },
      select: {
        id: true,
        status: true,
        foremanId: true,
        siteId: true,
        foreman: { select: { id: true, user: { select: { name: true } } } },
        site: { select: { id: true, code: true, name: true } },
      },
    });

    // Fetch attendance scans for all foremen on these sites in this period
    const foremanIdsInPeriod = Array.from(
      new Set(timesheetRecords.map((tr) => tr.foremanId)),
    );

    const scans = await prisma.attendanceScan.findMany({
      where: {
        siteDay: {
          workDate: { gte: startDate, lt: endExclusive },
          foremanId: { in: foremanIdsInPeriod },
          siteId: { in: siteIds },
        },
      },
      select: {
        siteDay: { select: { foremanId: true, workDate: true, siteId: true } },
        siteId: true,
        employeeId: true,
        dayRateAtScan: true,
        employee: { select: { defaultDayRate: true } },
      },
    });

    // Aggregate scan data to calculate totalWorkerDays and totalWorkerWages per (foreman, site)
    const scansByForemanSite = new Map<
      string,
      Array<{ date: string; wage: number; employeeId: string }>
    >();

    for (const scan of scans) {
      const foremanId = scan.siteDay.foremanId;
      const siteId = scan.siteId;
      const dateISO = isoFromDateUTC(scan.siteDay.workDate);
      const rate =
        decimalToNumber(scan.dayRateAtScan) ||
        decimalToNumber(scan.employee?.defaultDayRate);

      const key = `${foremanId}__${siteId}`;
      const list = scansByForemanSite.get(key) ?? [];
      list.push({ date: dateISO, wage: rate, employeeId: scan.employeeId });
      scansByForemanSite.set(key, list);
    }

    const totalsByForemanSite = new Map<
      string,
      { days: number; wages: number }
    >();

    for (const [key, list] of scansByForemanSite.entries()) {
      const uniquePairs = new Set<string>();
      let totalWages = 0;

      for (const s of list) {
        const pairKey = `${s.employeeId}-${s.date}`;
        if (!uniquePairs.has(pairKey)) {
          uniquePairs.add(pairKey);
          totalWages += s.wage;
        }
      }

      totalsByForemanSite.set(key, {
        days: uniquePairs.size,
        wages: totalWages,
      });
    }

    // Structure data for PDF generation (similar to SupervisorSummaryGroup)
    const supervisorSummary: any = {
      // Use 'any' for now, define proper type in generateSupervisorSummaryPdf
      supervisorId: supervisor.id,
      supervisorName: supervisor.user?.name ?? "Supervisor",
      foremen: [],
      totalForemanDays: 0,
      totalForemanWages: 0,
      totalTeamDays: 0,
      totalTeamWages: 0,
      grandTotal: 0,
    };

    const foremenMap = new Map<string, any>(); // Use 'any' for now

    for (const record of timesheetRecords) {
      const foremanKey = record.foremanId;
      if (!foremenMap.has(foremanKey)) {
        foremenMap.set(foremanKey, {
          foremanId: record.foremanId,
          foremanName: record.foreman?.user?.name ?? "Unknown Foreman",
          sites: [],
          totalForemanDays: 0,
          totalForemanWages: 0,
          totalTeamDays: 0,
          totalTeamWages: 0,
          grandTotal: 0,
        });
      }
      const foremanEntry = foremenMap.get(foremanKey)!;

      const siteKey = `${record.foremanId}__${record.siteId}`;
      const siteTotals = totalsByForemanSite.get(siteKey) || {
        days: 0,
        wages: 0,
      };

      foremanEntry.sites.push({
        siteName: record.site?.name ?? "Unknown Site",
        siteCode: record.site?.code ?? null,
        foremanDays: 0, // Not directly calculated here, could be derived from timesheet detail if needed
        foremanWages: 0, // Not directly calculated here
        teamDays: siteTotals.days,
        teamWages: siteTotals.wages,
        totalWages: siteTotals.wages,
      });

      foremanEntry.totalTeamDays += siteTotals.days;
      foremanEntry.totalTeamWages += siteTotals.wages;
      foremanEntry.grandTotal += siteTotals.wages;
    }

    supervisorSummary.foremen = Array.from(foremenMap.values()).sort(
      (a: any, b: any) => a.foremanName.localeCompare(b.foremanName),
    );

    for (const foreman of supervisorSummary.foremen) {
      supervisorSummary.totalTeamDays += foreman.totalTeamDays;
      supervisorSummary.totalTeamWages += foreman.totalTeamWages;
      supervisorSummary.grandTotal += foreman.grandTotal;
    }

    // Generate PDF
    const pdfBytes = await generateSupervisorSummaryPdf(
      supervisorSummary,
      startISO,
      endISO,
    );
    const pdfBody = new Uint8Array(pdfBytes);

    return new NextResponse(pdfBody, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="supervisor-timesheet-summary-${startISO}-${endISO}.pdf"`,
      },
    });
  } catch (e: any) {
    console.error("Error generating supervisor timesheet summary PDF:", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 },
    );
  }
}
