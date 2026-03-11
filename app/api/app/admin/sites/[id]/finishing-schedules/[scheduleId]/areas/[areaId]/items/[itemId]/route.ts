import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "PATCH, DELETE, OPTIONS",
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
 * PATCH …/items/[itemId]
 * Update fields on a single item.
 */
export async function PATCH(
  req: Request,
  ctx: {
    params: Promise<{
      id: string;
      scheduleId: string;
      areaId: string;
      itemId: string;
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

    const { itemId } = await ctx.params;
    const body = await req.json();

    const data: Record<string, unknown> = {};
    if (body.zone !== undefined) data.zone = body.zone;
    if (body.position !== undefined)
      data.position = String(body.position).trim();
    if (body.product !== undefined)
      data.product = body.product ? String(body.product).trim() : null;
    if (body.colorCode !== undefined)
      data.colorCode = body.colorCode ? String(body.colorCode).trim() : null;
    if (body.supplier !== undefined)
      data.supplier = body.supplier ? String(body.supplier).trim() : null;
    if (typeof body.sortOrder === "number") data.sortOrder = body.sortOrder;
    if (body.note !== undefined)
      data.note = body.note ? String(body.note).trim() : null;

    const updated = await prisma.siteFinishingScheduleItem.update({
      where: { id: itemId },
      data,
    });

    return NextResponse.json({ data: updated }, { headers: CORS });
  } catch (err) {
    console.error("PATCH finishing-schedule item error:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}

/**
 * DELETE …/items/[itemId]
 * Delete a single item.
 */
export async function DELETE(
  req: Request,
  ctx: {
    params: Promise<{
      id: string;
      scheduleId: string;
      areaId: string;
      itemId: string;
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

    const { itemId } = await ctx.params;

    await prisma.siteFinishingScheduleItem.delete({
      where: { id: itemId },
    });

    return NextResponse.json({ ok: true }, { headers: CORS });
  } catch (err) {
    console.error("DELETE finishing-schedule item error:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}
