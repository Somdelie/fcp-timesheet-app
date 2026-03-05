import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { decimalToNumber } from "@/lib/dateUtc";
import { recalcOrderTotal } from "@/lib/procurement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PATCH, DELETE, OPTIONS",
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
 * GET /api/app/admin/sites/[id]/product-orders/[orderId]
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string; orderId: string }> },
) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS },
      );

    const { id: siteId, orderId } = await ctx.params;

    const order = await prisma.siteProductOrder.findFirst({
      where: { id: orderId, siteId },
      include: {
        supplier: { select: { id: true, name: true } },
        createdByUser: { select: { id: true, name: true } },
        items: {
          include: {
            product: {
              select: { id: true, name: true, uom: true, unitSize: true },
            },
          },
        },
      },
    });

    if (!order)
      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers: CORS },
      );

    const data = {
      ...order,
      totalCost: order.totalCost ? decimalToNumber(order.totalCost) : null,
      items: order.items.map((i) => ({
        ...i,
        unitPriceAtOrder: decimalToNumber(i.unitPriceAtOrder),
        unitSizeAtOrder: i.unitSizeAtOrder
          ? decimalToNumber(i.unitSizeAtOrder)
          : null,
        product: {
          ...i.product,
          unitSize: i.product.unitSize
            ? decimalToNumber(i.product.unitSize)
            : null,
        },
      })),
    };

    return NextResponse.json({ ok: true, data }, { headers: CORS });
  } catch (e: any) {
    console.error("GET product-order error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}

/**
 * PATCH /api/app/admin/sites/[id]/product-orders/[orderId]
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; orderId: string }> },
) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS },
      );

    const { id: siteId, orderId } = await ctx.params;
    const body = await req.json();
    const { supplierId, reference, note } = body as {
      supplierId?: string | null;
      reference?: string | null;
      note?: string | null;
    };

    const existing = await prisma.siteProductOrder.findFirst({
      where: { id: orderId, siteId },
      select: { id: true },
    });
    if (!existing)
      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers: CORS },
      );

    const updated = await prisma.siteProductOrder.update({
      where: { id: orderId },
      data: {
        ...(supplierId !== undefined ? { supplierId: supplierId || null } : {}),
        ...(reference !== undefined ? { reference: reference || null } : {}),
        ...(note !== undefined ? { note: note || null } : {}),
      },
    });

    return NextResponse.json({ ok: true, data: updated }, { headers: CORS });
  } catch (e: any) {
    console.error("PATCH product-order error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}

/**
 * DELETE /api/app/admin/sites/[id]/product-orders/[orderId]
 */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string; orderId: string }> },
) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS },
      );

    const { id: siteId, orderId } = await ctx.params;

    const existing = await prisma.siteProductOrder.findFirst({
      where: { id: orderId, siteId },
      select: { id: true },
    });
    if (!existing)
      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers: CORS },
      );

    await prisma.siteProductOrder.delete({ where: { id: orderId } });

    return NextResponse.json({ ok: true }, { headers: CORS });
  } catch (e: any) {
    console.error("DELETE product-order error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}
