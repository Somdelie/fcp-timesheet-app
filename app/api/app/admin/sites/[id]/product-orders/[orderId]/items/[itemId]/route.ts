import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { decimalToNumber } from "@/lib/dateUtc";
import { resolveUnitPrice, recalcOrderTotal } from "@/lib/procurement";

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
 * PATCH /api/app/admin/sites/[id]/product-orders/[orderId]/items/[itemId]
 *
 * Body: { quantity?, unitPrice?, note? }
 * If unitPrice is passed it becomes the new snapshot; if null/omitted the existing value stays.
 * Recalculates order totalCost after update.
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; orderId: string; itemId: string }> },
) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS },
      );

    const { id: siteId, orderId, itemId } = await ctx.params;
    const body = await req.json();
    const { quantity, unitPrice, note } = body as {
      quantity?: number;
      unitPrice?: number | string | null;
      note?: string | null;
    };

    // Verify chain: order belongs to site, item belongs to order
    const item = await prisma.siteProductOrderItem.findFirst({
      where: { id: itemId, orderId },
      include: { order: { select: { siteId: true, supplierId: true } } },
    });
    if (!item || item.order.siteId !== siteId)
      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers: CORS },
      );

    // Build update payload
    const data: Record<string, unknown> = {};
    if (quantity !== undefined && quantity >= 1) data.quantity = quantity;
    if (note !== undefined) data.note = note || null;

    // If a new unitPrice is explicitly provided, resolve it (manual or re-resolve)
    if (unitPrice !== undefined) {
      const resolved = await resolveUnitPrice({
        manualPrice: unitPrice,
        supplierId: item.order.supplierId,
        productId: item.productId,
      });
      data.unitPriceAtOrder = resolved;
    }

    const updated = await prisma.siteProductOrderItem.update({
      where: { id: itemId },
      data,
    });

    // Recalculate order total
    const newTotal = await recalcOrderTotal(orderId);

    return NextResponse.json(
      {
        ok: true,
        data: {
          ...updated,
          unitPriceAtOrder: decimalToNumber(updated.unitPriceAtOrder),
          unitSizeAtOrder: updated.unitSizeAtOrder
            ? decimalToNumber(updated.unitSizeAtOrder)
            : null,
        },
        orderTotal: decimalToNumber(newTotal),
      },
      { headers: CORS },
    );
  } catch (e: any) {
    console.error("PATCH order-item error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}

/**
 * DELETE /api/app/admin/sites/[id]/product-orders/[orderId]/items/[itemId]
 * Recalculates order totalCost after delete.
 */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string; orderId: string; itemId: string }> },
) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS },
      );

    const { id: siteId, orderId, itemId } = await ctx.params;

    const item = await prisma.siteProductOrderItem.findFirst({
      where: { id: itemId, orderId },
      include: { order: { select: { siteId: true } } },
    });
    if (!item || item.order.siteId !== siteId)
      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers: CORS },
      );

    await prisma.siteProductOrderItem.delete({ where: { id: itemId } });

    // Recalculate order total
    const newTotal = await recalcOrderTotal(orderId);

    return NextResponse.json(
      { ok: true, orderTotal: decimalToNumber(newTotal) },
      { headers: CORS },
    );
  } catch (e: any) {
    console.error("DELETE order-item error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}
