import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { PpeOrderStatus } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAuth(req: Request) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (session?.user && (role === "ADMIN" || role === "OFFICE" || role === "SUPERVISOR"))
    return { id: (session.user as any).id as string, role };
  return null;
}

/** PATCH /api/app/admin/ppe-orders/[id] — update status / note */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await ctx.params;
    const body = await req.json();
    const { status, note } = body as { status?: PpeOrderStatus; note?: string };

    const data: Record<string, unknown> = {};
    if (status !== undefined) data.status = status;
    if (note !== undefined) data.note = note?.trim() || null;

    const updated = await prisma.foremanPpeOrder.update({
      where: { id },
      data,
      include: {
        foreman: { include: { user: { select: { id: true, name: true } } } },
        site: { select: { id: true, name: true, code: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, thumbnailUrl: true, colors: true } },
          },
        },
      },
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (e: any) {
    if (e?.code === "P2025")
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    console.error("PATCH ppe-order error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/** DELETE /api/app/admin/ppe-orders/[id] */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await ctx.params;
    await prisma.foremanPpeOrder.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.code === "P2025")
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    console.error("DELETE ppe-order error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
