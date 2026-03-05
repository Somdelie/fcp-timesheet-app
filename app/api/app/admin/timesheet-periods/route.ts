import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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
 * GET /api/app/admin/timesheet-periods
 * List all timesheet periods (most recent first).
 * Query: ?limit=50
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
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

    const periods = await prisma.timesheetPeriod.findMany({
      orderBy: { startDate: "desc" },
      take: limit,
      select: {
        id: true,
        startDate: true,
        endDate: true,
        label: true,
        createdAt: true,
      },
    });

    const data = periods.map((p) => ({
      id: p.id,
      startDate: p.startDate.toISOString().slice(0, 10),
      endDate: p.endDate.toISOString().slice(0, 10),
      label: p.label,
      createdAt: p.createdAt.toISOString(),
    }));

    return NextResponse.json({ ok: true, data }, { headers: CORS });
  } catch (e: any) {
    console.error("GET timesheet-periods error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}
