import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
    if (
      p &&
      (p.role === "ADMIN" || p.role === "OFFICE" || p.role === "SUPERVISOR")
    )
      return { id: p.sub, role: p.role as string };
  }
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (
    session?.user &&
    (role === "ADMIN" || role === "OFFICE" || role === "SUPERVISOR")
  )
    return { id: (session.user as any).id as string, role };
  return null;
}

/**
 * GET /api/app/admin/sites/[id]/finishing-schedules/[scheduleId]/areas
 * List areas for a schedule, ordered by sortOrder.
 */
export async function GET(
  req: Request,
  ctx: {
    params: Promise<{ id: string; scheduleId: string }>;
  },
) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS },
      );

    const { scheduleId } = await ctx.params;

    const areas = await prisma.siteFinishingScheduleArea.findMany({
      where: { scheduleId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { items: { orderBy: [{ sortOrder: "asc" }] } },
    });

    return NextResponse.json({ data: areas }, { headers: CORS });
  } catch (err) {
    console.error("GET finishing-schedule areas error:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}

/**
 * POST /api/app/admin/sites/[id]/finishing-schedules/[scheduleId]/areas
 * Create a new area under the schedule.
 * Body: { name, sortOrder? }
 */
export async function POST(
  req: Request,
  ctx: {
    params: Promise<{ id: string; scheduleId: string }>;
  },
) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS },
      );

    const { scheduleId } = await ctx.params;
    const body = await req.json();

    if (!body.name?.trim())
      return NextResponse.json(
        { error: "name is required" },
        { status: 400, headers: CORS },
      );

    const area = await prisma.siteFinishingScheduleArea.create({
      data: {
        scheduleId,
        name: String(body.name).trim(),
        sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
      },
      include: { items: true },
    });

    return NextResponse.json({ data: area }, { status: 201, headers: CORS });
  } catch (err) {
    console.error("POST finishing-schedule area error:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}
