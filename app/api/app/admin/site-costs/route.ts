import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { verifyApiToken } from "@/lib/jwt";
import { calcSiteCosts } from "@/lib/procurement";
import { startOfDayUTC, addDaysUTC } from "@/lib/dateUtc";
import { currentFortnightSatFri } from "@/lib/fortnight";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

async function getAuth(req: Request) {
  const h = req.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : null;
  if (token) {
    const p = await verifyApiToken(token);
    if (p && (p.role === "ADMIN" || p.role === "SUPERVISOR"))
      return { id: p.sub, role: p.role as "ADMIN" | "SUPERVISOR" };
  }
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (session?.user && (role === "ADMIN" || role === "SUPERVISOR"))
    return {
      id: (session.user as any).id as string,
      role: role as "ADMIN" | "SUPERVISOR",
    };
  return null;
}

/**
 * GET /api/app/admin/site-costs
 *
 * Query params:
 *  - from / to   (ISO date strings, default = current fortnight)
 *  - siteId      (optional, restrict to one site — can repeat for multiple)
 *
 * Returns per-site rows with materialCost, wagesCost, projectCost
 * and a totals summary.
 */
export async function GET(req: Request) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS },
      );

    const url = new URL(req.url);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const siteIdParams = url.searchParams.getAll("siteId");

    let start: Date;
    let endExclusive: Date;
    let startISO: string;
    let endISO: string;

    if (fromParam && toParam) {
      start = startOfDayUTC(fromParam);
      const end = startOfDayUTC(toParam);
      endExclusive = addDaysUTC(end, 1);
      startISO = fromParam;
      endISO = toParam;
    } else {
      const ft = currentFortnightSatFri(new Date());
      start = startOfDayUTC(ft.startISO);
      const end = startOfDayUTC(ft.endISO);
      endExclusive = addDaysUTC(end, 1);
      startISO = ft.startISO;
      endISO = ft.endISO;
    }

    const result = await calcSiteCosts(
      start,
      endExclusive,
      siteIdParams.length > 0 ? siteIdParams : undefined,
    );

    return NextResponse.json(
      { ok: true, startISO, endISO, ...result },
      { headers: CORS },
    );
  } catch (e: any) {
    console.error("GET site-costs error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}
