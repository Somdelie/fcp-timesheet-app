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
 * GET …/areas/[areaId]/items
 * List items in an area, ordered by sortOrder.
 */
export async function GET(
  req: Request,
  ctx: {
    params: Promise<{
      id: string;
      scheduleId: string;
      areaId: string;
    }>;
  },
) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS },
      );

    const { areaId } = await ctx.params;

    const items = await prisma.siteFinishingScheduleItem.findMany({
      where: { areaId },
      orderBy: [{ sortOrder: "asc" }],
    });

    return NextResponse.json({ data: items }, { headers: CORS });
  } catch (err) {
    console.error("GET finishing-schedule items error:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}

/**
 * POST …/areas/[areaId]/items
 * Create one or more items in the area.
 * Body: single item object OR { items: [...] } for bulk.
 * Each item: { zone, position, product?, colorCode?, supplier?, sortOrder?, note? }
 */
export async function POST(
  req: Request,
  ctx: {
    params: Promise<{
      id: string;
      scheduleId: string;
      areaId: string;
    }>;
  },
) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS },
      );

    const { areaId } = await ctx.params;
    const body = await req.json();

    const rawItems = Array.isArray(body.items) ? body.items : [body];

    const created = await prisma.$transaction(
      rawItems.map((it: any) =>
        prisma.siteFinishingScheduleItem.create({
          data: {
            areaId,
            zone: it.zone,
            position: String(it.position ?? "").trim(),
            product: it.product ? String(it.product).trim() : null,
            colorCode: it.colorCode ? String(it.colorCode).trim() : null,
            supplier: it.supplier ? String(it.supplier).trim() : null,
            sortOrder: typeof it.sortOrder === "number" ? it.sortOrder : 0,
            note: it.note ? String(it.note).trim() : null,
          },
        }),
      ),
    );

    return NextResponse.json({ data: created }, { status: 201, headers: CORS });
  } catch (err) {
    console.error("POST finishing-schedule items error:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}
