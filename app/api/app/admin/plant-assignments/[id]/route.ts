import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { PlantStatus } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAuth(req: Request) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (session?.user && (role === "ADMIN" || role === "OFFICE"))
    return { id: (session.user as any).id as string, role };
  return null;
}

/** PATCH /api/app/admin/plant-assignments/[id] — update status / note */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await ctx.params;
    const body = await req.json();
    const {
      status,
      note,
      returnedOn,
      quantity,
      unitPrice,
      chargeToSite,
      chargeQuantity,
      size,
    } = body as {
      status?: PlantStatus;
      note?: string;
      returnedOn?: string;
      quantity?: number;
      unitPrice?: number | null;
      chargeToSite?: boolean;
      chargeQuantity?: number | null;
      size?: string | null;
    };

    const data: Record<string, unknown> = {};
    if (status !== undefined) data.status = status;
    if (note !== undefined) data.note = note?.trim() || null;
    if (quantity !== undefined) data.quantity = quantity;
    if (unitPrice !== undefined) data.unitPrice = unitPrice;
    if (chargeToSite !== undefined) data.chargeToSite = chargeToSite;
    if (chargeQuantity !== undefined) data.chargeQuantity = chargeQuantity;
    if (size !== undefined) data.size = size?.trim() || null;
    if (returnedOn !== undefined)
      data.returnedOn = returnedOn ? new Date(returnedOn) : null;
    else if (status === "RETURNED" && !returnedOn) data.returnedOn = new Date();

    const updated = await prisma.sitePlantAssignment.update({
      where: { id },
      data,
      include: {
        product: { select: { id: true, name: true, thumbnailUrl: true } },
        site: { select: { id: true, name: true, code: true } },
      },
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (e: any) {
    if (e?.code === "P2025")
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    console.error("PATCH plant-assignment error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/** DELETE /api/app/admin/plant-assignments/[id] */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await ctx.params;
    await prisma.sitePlantAssignment.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.code === "P2025")
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    console.error("DELETE plant-assignment error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
