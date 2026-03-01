import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { currentFortnightSatFri, addDays, toISODate } from "@/lib/fortnight";

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

async function sumWagesInRange(
  start: Date,
  endExclusive: Date,
): Promise<number> {
  const result = await prisma.attendanceScan.aggregate({
    where: {
      workDate: { gte: start, lt: endExclusive },
    },
    _sum: { dayRateAtScan: true },
  });
  return Number(result._sum.dayRateAtScan ?? 0);
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

    // --- Fortnight comparison ---
    const fn = currentFortnightSatFri(new Date());
    const fnStart = new Date(`${fn.startISO}T00:00:00.000Z`);
    const fnEnd = new Date(`${fn.endISO}T00:00:00.000Z`);
    const fnEndExclusive = addDays(fnEnd, 1);

    // Previous fortnight is 14 days before current
    const prevFnStart = addDays(fnStart, -14);
    const prevFnEnd = addDays(fnEnd, -14);
    const prevFnEndExclusive = addDays(prevFnEnd, 1);

    // --- Month comparison ---
    const now = new Date();
    const currentMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const currentMonthEndExclusive = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );

    const prevMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
    );
    const prevMonthEndExclusive = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );

    // Run all 4 queries in parallel
    const [fortnightCurrent, fortnightPrevious, monthCurrent, monthPrevious] =
      await Promise.all([
        sumWagesInRange(fnStart, fnEndExclusive),
        sumWagesInRange(prevFnStart, prevFnEndExclusive),
        sumWagesInRange(currentMonthStart, currentMonthEndExclusive),
        sumWagesInRange(prevMonthStart, prevMonthEndExclusive),
      ]);

    return NextResponse.json(
      {
        fortnight: {
          current: fortnightCurrent,
          previous: fortnightPrevious,
          currentLabel: `${fn.startISO} – ${fn.endISO}`,
          previousLabel: `${toISODate(prevFnStart)} – ${toISODate(prevFnEnd)}`,
        },
        month: {
          current: monthCurrent,
          previous: monthPrevious,
          currentLabel: currentMonthStart.toLocaleString("en-US", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          }),
          previousLabel: prevMonthStart.toLocaleString("en-US", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          }),
        },
      },
      { headers: CORS_HEADERS },
    );
  } catch (error: any) {
    console.error("Error fetching wage comparison:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
