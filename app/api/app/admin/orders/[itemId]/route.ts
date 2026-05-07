import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/apiAuth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}

async function getAdminFromRequest(req: NextRequest) {
  const apiCtx = await requireApiAuth(req, ["ADMIN", "OFFICE"]);
  if (apiCtx) {
    return { id: apiCtx.user.sub, role: apiCtx.user.role as string } as const;
  }

  try {
    const session = await getServerSession(authOptions);
    if (session?.user && (session.user as any).id) {
      const role = (session.user as any).role as string | undefined;
      if (role === "ADMIN" || role === "OFFICE") {
        return {
          id: (session.user as any).id as string,
          role,
        } as const;
      }
    }
  } catch {
    // ignore
  }

  return null;
}

/** Restore stockQty on Product and StockItemVariant for a list of order items */
async function restoreStock(
  items: { productId: string; quantity: number; size: string | null; color: string | null }[],
) {
  for (const item of items) {
    await prisma.product.update({
      where: { id: item.productId },
      data: { stockQty: { increment: item.quantity } },
    });
    if (item.size !== null || item.color !== null) {
      await prisma.stockItemVariant.updateMany({
        where: { productId: item.productId, size: item.size, color: item.color },
        data: { qty: { increment: item.quantity } },
      });
    }
  }
}

/**
 * DELETE /api/app/admin/orders/:itemId
 * Cancel an order. If the order was APPLIED, also delete linked deductions
 * (only if the related timesheet is not PAID). Restores stock quantities.
 */
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ itemId: string }> },
) {
  try {
    const admin = await getAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS },
      );
    }

    const { itemId } = await ctx.params;

    const order = await prisma.productOrder.findUnique({
      where: { id: itemId },
      include: {
        items: {
          select: {
            id: true,
            productId: true,
            quantity: true,
            size: true,
            color: true,
            deductions: {
              select: {
                id: true,
                timesheet: { select: { status: true } },
              },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404, headers: CORS_HEADERS },
      );
    }

    // Already-cancelled orders: hard delete immediately (stock already restored at cancel time)
    if (order.status === "CANCELLED") {
      await prisma.productOrder.delete({ where: { id: itemId } });
      return NextResponse.json(
        { ok: true, deleted: true },
        { headers: CORS_HEADERS },
      );
    }

    // Active orders: check for paid deductions before cancelling
    const linkedDeductions = order.items.flatMap((i) => i.deductions);
    const hasPaidDeduction = linkedDeductions.some(
      (d) => d.timesheet?.status === "PAID",
    );

    if (hasPaidDeduction) {
      return NextResponse.json(
        { error: "Cannot cancel order — some deductions are on a paid timesheet" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    // Delete linked deductions then soft-cancel and restore stock
    if (linkedDeductions.length > 0) {
      await prisma.deduction.deleteMany({
        where: { id: { in: linkedDeductions.map((d) => d.id) } },
      });
    }

    await prisma.productOrder.update({
      where: { id: itemId },
      data: { status: "CANCELLED" },
    });

    // Restore stock for all items in this order
    await restoreStock(
      order.items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        size: i.size,
        color: i.color,
      })),
    );

    return NextResponse.json(
      { ok: true, cancelled: true },
      { headers: CORS_HEADERS },
    );
  } catch (e: any) {
    console.error("/api/app/admin/orders DELETE error", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}

const PatchOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
        size: z.string().max(100).optional(),
        color: z.string().max(100).optional(),
        note: z.string().max(2000).optional(),
      }),
    )
    .min(1),
});

/**
 * PATCH /api/app/admin/orders/:itemId
 * Replace all items in a PENDING order. Restores stock for old items and
 * deducts stock for the new items.
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ itemId: string }> },
) {
  try {
    const admin = await getAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS },
      );
    }

    const { itemId } = await ctx.params;

    const json = await req.json().catch(() => null as any);
    const body = PatchOrderSchema.safeParse(json);
    if (!body.success) {
      return NextResponse.json(
        { error: body.error.issues[0]?.message ?? "Invalid payload" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const order = await prisma.productOrder.findUnique({
      where: { id: itemId },
      include: {
        items: {
          select: { id: true, productId: true, quantity: true, size: true, color: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404, headers: CORS_HEADERS },
      );
    }

    if (order.status !== "PENDING") {
      return NextResponse.json(
        { error: "Only PENDING orders can be edited" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const productIds = Array.from(new Set(body.data.items.map((i) => i.productId)));
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, price: true, isActive: true },
    });

    if (products.length !== productIds.length) {
      return NextResponse.json(
        { error: "One or more products not found" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const productsById = new Map(products.map((p) => [p.id, p] as const));

    // Restore stock for old items
    await restoreStock(
      order.items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        size: i.size,
        color: i.color,
      })),
    );

    // Delete old items
    await prisma.productOrderItem.deleteMany({ where: { orderId: itemId } });

    // Create new items and deduct stock
    const newItems = [];
    for (const item of body.data.items) {
      const p = productsById.get(item.productId)!;
      const priceNum = Number((p.price as any).toString?.() ?? p.price);
      const normalizedSize = item.size?.trim() || null;
      const normalizedColor = item.color?.trim() || null;

      const created = await prisma.productOrderItem.create({
        data: {
          order: { connect: { id: itemId } },
          product: { connect: { id: item.productId } },
          quantity: item.quantity,
          unitPrice: priceNum as any,
          size: normalizedSize,
          color: normalizedColor,
          note: item.note?.trim() || undefined,
        },
        select: { id: true, productId: true, quantity: true, unitPrice: true, size: true, color: true, note: true },
      });
      newItems.push(created);

      await prisma.product.update({
        where: { id: item.productId },
        data: { stockQty: { decrement: item.quantity } },
      });
      if (normalizedSize !== null || normalizedColor !== null) {
        await prisma.stockItemVariant.updateMany({
          where: { productId: item.productId, size: normalizedSize, color: normalizedColor },
          data: { qty: { decrement: item.quantity } },
        });
      }
    }

    return NextResponse.json(
      {
        ok: true,
        items: newItems.map((i) => ({
          id: i.id,
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: (i.unitPrice as any).toString?.() ?? String(i.unitPrice ?? "0"),
          size: i.size ?? null,
          color: i.color ?? null,
          note: i.note ?? null,
        })),
      },
      { headers: CORS_HEADERS },
    );
  } catch (e: any) {
    console.error("/api/app/admin/orders PATCH error", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
