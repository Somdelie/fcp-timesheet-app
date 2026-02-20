import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { currentFortnightSatFri } from "@/lib/fortnight";
import { startOfDayUTC, addDaysUTC, decimalToNumber } from "@/lib/dateUtc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

async function getAuthFromRequest(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (token) {
    const payload = await verifyApiToken(token);
    if (
      payload &&
      (payload.role === "ADMIN" || payload.role === "SUPERVISOR")
    ) {
      return { id: payload.sub, role: payload.role as "ADMIN" | "SUPERVISOR" };
    }
  }

  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;

  if (session?.user && (role === "ADMIN" || role === "SUPERVISOR")) {
    return {
      id: (session.user as any).id as string,
      role: role as "ADMIN" | "SUPERVISOR",
    };
  }

  return null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthFromRequest(req);
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS },
      );
    }

    const { id: siteId } = await params;
    const url = new URL(req.url);

    // Get date range from query params, default to current fortnight
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    let start: Date;
    let end: Date;
    let startISO: string;
    let endISO: string;

    if (fromParam && toParam) {
      start = startOfDayUTC(fromParam);
      end = startOfDayUTC(toParam);
      startISO = fromParam;
      endISO = toParam;
    } else {
      const ft = currentFortnightSatFri(new Date());
      start = startOfDayUTC(ft.startISO);
      end = startOfDayUTC(ft.endISO);
      startISO = ft.startISO;
      endISO = ft.endISO;
    }

    const endExclusive = addDaysUTC(end, 1);

    // Check if site exists
    const site = await prisma.site.findUnique({
      where: { id: siteId },
      select: { id: true, name: true },
    });

    if (!site) {
      return NextResponse.json(
        { error: "Site not found" },
        { status: 404, headers: CORS_HEADERS },
      );
    }

    // Get attendance scans for the period
    const scans = await prisma.attendanceScan.findMany({
      where: {
        siteId,
        workDate: { gte: start, lt: endExclusive },
      },
      select: {
        dayRateAtScan: true,
        employeeId: true,
        workDate: true,
        siteDay: {
          select: { foremanId: true },
        },
      },
    });

    const totalDays = scans.length;
    const totalWages = scans.reduce(
      (sum: number, scan) => sum + decimalToNumber(scan.dayRateAtScan),
      0,
    );

    // Count unique employees
    const totalWorkers = new Set(scans.map((s) => s.employeeId)).size;

    // Group by foreman for breakdown
    const foremanMap = new Map<
      string,
      { wages: number; days: number; workers: Set<string> }
    >();
    for (const scan of scans) {
      const foremanId = scan.siteDay.foremanId;
      if (!foremanId) continue;
      const existing = foremanMap.get(foremanId) || {
        wages: 0,
        days: 0,
        workers: new Set<string>(),
      };
      existing.wages += decimalToNumber(scan.dayRateAtScan);
      existing.days += 1;
      existing.workers.add(scan.employeeId);
      foremanMap.set(foremanId, existing);
    }

    // Get foreman names
    const foremanIds = Array.from(foremanMap.keys());
    const foremenData = await prisma.foreman.findMany({
      where: { id: { in: foremanIds } },
      select: { id: true, user: { select: { name: true } } },
    });
    const foremanNameMap = new Map(foremenData.map((f) => [f.id, f.user.name]));

    const foremen = foremanIds.map((foremanId) => {
      const data = foremanMap.get(foremanId)!;
      return {
        foremanId,
        name: foremanNameMap.get(foremanId) || "Unknown",
        wages: data.wages,
        days: data.days,
        workers: data.workers.size,
      };
    });

    return NextResponse.json(
      {
        ok: true,
        siteId,
        siteName: site.name,
        startISO,
        endISO,
        totals: {
          totalDays,
          totalWorkers,
          totalWages,
        },
        foremen,
      },
      { headers: CORS_HEADERS },
    );
  } catch (e: any) {
    console.error("Error getting site wages:", e);
    return NextResponse.json(
      { error: "Failed to get site wages" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
