import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { currentFortnightSatFri } from "@/lib/fortnight";
import { addDaysUTC } from "@/lib/dateUtc";

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

async function getAdminFromRequest(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (token) {
    const payload = await verifyApiToken(token);
    if (payload && payload.role === "ADMIN") {
      return { id: payload.sub, role: "ADMIN" as const };
    }
  }

  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (session?.user && role === "ADMIN") {
    return { id: (session.user as any).id as string, role: "ADMIN" as const };
  }

  return null;
}

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS },
      );
    }

    // Determine current fortnight date range
    const fn = currentFortnightSatFri(new Date());
    const fnStart = new Date(`${fn.startISO}T00:00:00.000Z`);
    const fnEndExclusive = addDaysUTC(
      new Date(`${fn.endISO}T00:00:00.000Z`),
      1,
    );

    // Sum dayRateAtScan from attendance scans grouped by site
    const rows = await prisma.attendanceScan.groupBy({
      by: ["siteId"],
      where: {
        workDate: { gte: fnStart, lt: fnEndExclusive },
      },
      _sum: { dayRateAtScan: true },
      _count: { _all: true },
      orderBy: { _sum: { dayRateAtScan: "desc" } },
      take: 5,
    });

    let topSites: { site: string; wages: number; workers: number }[] = [];

    if (rows.length > 0) {
      const siteIds = rows.map((r) => r.siteId);
      const sites = await prisma.site.findMany({
        where: { id: { in: siteIds } },
        select: { id: true, name: true },
      });
      const nameMap = new Map(sites.map((s) => [s.id, s.name]));

      topSites = rows.map((r) => ({
        site: nameMap.get(r.siteId) ?? "Unknown",
        wages: Number(r._sum.dayRateAtScan ?? 0),
        workers: r._count._all,
      }));
    }

    return NextResponse.json(
      {
        topSites,
        fortnight: { startISO: fn.startISO, endISO: fn.endISO },
      },
      { headers: CORS_HEADERS },
    );
  } catch (error: any) {
    console.error("Error fetching top site wages:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
