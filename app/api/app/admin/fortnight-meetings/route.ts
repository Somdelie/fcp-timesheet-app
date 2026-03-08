import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { generateFortnightMeeting } from "@/lib/procurement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

async function getAuth(req: Request) {
  const h = req.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : null;
  if (token) {
    const p = await verifyApiToken(token);
    if (p && (p.role === "ADMIN" || p.role === "OFFICE"))
      return { id: p.sub, role: p.role as "ADMIN" | "OFFICE" };
  }
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (session?.user && (role === "ADMIN" || role === "OFFICE"))
    return {
      id: (session.user as any).id as string,
      role: role as "ADMIN" | "OFFICE",
    };
  return null;
}

/**
 * GET /api/app/admin/fortnight-meetings
 * List all generated fortnight meetings (most recent first).
 * Query: ?limit=10
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
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 100);

    const meetings = await prisma.fortnightMeeting.findMany({
      orderBy: { meetingOn: "desc" },
      take: limit,
      include: {
        totals: {
          select: {
            totalMaterialCost: true,
            totalWagesCost: true,
            totalOvertimeCost: true,
            totalProjectCost: true,
          },
        },
        createdByUser: { select: { id: true, name: true } },
        _count: { select: { rows: true } },
      },
    });

    const data = meetings.map((m) => ({
      id: m.id,
      startDate: m.startDate.toISOString().slice(0, 10),
      endDate: m.endDate.toISOString().slice(0, 10),
      meetingOn: m.meetingOn.toISOString(),
      createdAt: m.createdAt.toISOString(),
      totals: m.totals
        ? {
            totalMaterialCost: Number(m.totals.totalMaterialCost),
            totalWagesCost: Number(m.totals.totalWagesCost),
            totalOvertimeCost: Number(m.totals.totalOvertimeCost),
            totalProjectCost: Number(m.totals.totalProjectCost),
          }
        : null,
      createdBy: m.createdByUser,
      siteCount: m._count.rows,
    }));

    return NextResponse.json({ ok: true, data }, { headers: CORS });
  } catch (e: any) {
    console.error("GET fortnight-meetings error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}

/**
 * POST /api/app/admin/fortnight-meetings
 * Generate (or re-generate) a meeting snapshot for a custom date range.
 *
 * Body: { startDate, endDate, meetingOn? }
 *   - startDate: ISO date string – report range start
 *   - endDate:   ISO date string – report range end
 *   - meetingOn:  ISO date string for the meeting date (defaults to now)
 */
export async function POST(req: Request) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS },
      );

    const body = await req.json();
    const { startDate, endDate, meetingOn } = body as {
      startDate?: string;
      endDate?: string;
      meetingOn?: string;
    };

    if (!startDate || !endDate)
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400, headers: CORS },
      );

    const sd = new Date(startDate);
    const ed = new Date(endDate);

    if (isNaN(sd.getTime()) || isNaN(ed.getTime()))
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400, headers: CORS },
      );

    if (sd >= ed)
      return NextResponse.json(
        { error: "startDate must be before endDate" },
        { status: 400, headers: CORS },
      );

    const result = await generateFortnightMeeting({
      startDate: sd,
      endDate: ed,
      meetingOn: meetingOn ? new Date(meetingOn) : new Date(),
      createdByUserId: auth.id,
    });

    return NextResponse.json(
      { ok: true, data: result },
      { status: 201, headers: CORS },
    );
  } catch (e: any) {
    console.error("POST fortnight-meetings error:", e);
    const msg = e?.message?.includes("not found")
      ? e.message
      : "Internal error";
    const status = msg.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: msg }, { status, headers: CORS });
  }
}
