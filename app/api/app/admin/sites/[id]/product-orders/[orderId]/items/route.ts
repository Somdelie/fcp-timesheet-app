import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { decimalToNumber } from "@/lib/dateUtc";
import {
  ensureSiteMaterialsForProducts,
  resolveUnitPrice,
  recalcOrderTotal,
} from "@/lib/procurement";
import { ensureInitialFinishingScheduleForColourProduct } from "@/lib/procurement/finishingScheduleAutoInitial";
import { ensureSitePaintColorFromOrderItem } from "@/lib/procurement/sitePaintColorSeeder";

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
      return { id: p.sub, role: p.role as "ADMIN" | "OFFICE" | "SUPERVISOR" };
  }
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (
    session?.user &&
    (role === "ADMIN" || role === "OFFICE" || role === "SUPERVISOR")
  )
    return {
      id: (session.user as any).id as string,
      role: role as "ADMIN" | "OFFICE" | "SUPERVISOR",
    };
  return null;
}

/**
 * GET /api/app/admin/sites/[id]/product-orders/[orderId]/items
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

    const { orderId } = await ctx.params;

    const items = await prisma.siteProductOrderItem.findMany({
      where: { orderId },
      include: {
        product: {
          select: { id: true, name: true, uom: true, unitSize: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const data = items.map((i) => ({
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
    }));

    return NextResponse.json({ ok: true, data }, { headers: CORS });
  } catch (e: any) {
    console.error("GET order-items error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}

/**
 * POST /api/app/admin/sites/[id]/product-orders/[orderId]/items
 *
 * Body: { productId, quantity, unitPrice? (manual override), note? }
 *
 * Price resolution:
 *  1. Manual unitPrice → use it
 *  2. Order has supplierId → latest SupplierProductPrice for (supplier, product)
 *  3. Fallback → latest active price for product across suppliers (or 0)
 *
 * Also snapshots uomAtOrder and unitSizeAtOrder from the product.
 * Recalculates the order totalCost after insert.
 */
export async function POST(
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
    const { productId, quantity, unitPrice, note, uom, unitSize } = body as {
      productId: string;
      quantity: number;
      unitPrice?: number | string | null;
      note?: string;
      uom?: string;
      unitSize?: number | string | null;
    };

    if (!productId || !quantity || quantity < 1) {
      return NextResponse.json(
        { error: "productId and quantity (>= 1) are required" },
        { status: 400, headers: CORS },
      );
    }

    // Verify order belongs to this site
    const order = await prisma.siteProductOrder.findFirst({
      where: { id: orderId, siteId },
      select: {
        id: true,
        supplierId: true,
        reference: true,
        supplier: { select: { name: true } },
      },
    });
    if (!order)
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404, headers: CORS },
      );

    // Fetch the product (to verify it exists)
    const product = await prisma.procurementProduct.findUnique({
      where: { id: productId },
      select: { id: true, uom: true, unitSize: true },
    });
    if (!product)
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404, headers: CORS },
      );

    // Determine UOM / unitSize: prefer explicit body values, fallback to product defaults
    const itemUom = (uom as any) || product.uom || null;
    const itemUnitSize =
      unitSize != null && unitSize !== ""
        ? Number(unitSize)
        : product.unitSize
          ? Number(product.unitSize)
          : null;

    // Resolve price (match on uom/unitSize if provided)
    const resolvedPrice = await resolveUnitPrice({
      manualPrice: unitPrice,
      supplierId: order.supplierId,
      productId,
      uom: itemUom ?? undefined,
      unitSize: itemUnitSize ?? undefined,
    });

    // Create item
    const item = await prisma.siteProductOrderItem.create({
      data: {
        order: { connect: { id: orderId } },
        product: { connect: { id: productId } },
        quantity,
        unitPriceAtOrder: resolvedPrice,
        uomAtOrder: itemUom,
        unitSizeAtOrder: itemUnitSize,
        note: note || null,
      },
    });

    // Recalculate order total
    const newTotal = await recalcOrderTotal(orderId);
    await ensureSiteMaterialsForProducts(prisma, {
      siteId,
      productIds: [productId],
    });
    await ensureInitialFinishingScheduleForColourProduct(prisma, {
      siteId,
      productId,
    });
    await ensureSitePaintColorFromOrderItem(prisma, {
      siteId,
      productId,
      rawDescription: note || null,
      supplierId: order.supplierId,
      supplierName: order.supplier?.name ?? null,
      sourceOrderId: order.id,
      sourceOrderItemId: item.id,
      orderReference: order.reference,
      sourceFile: "site product order",
    });

    return NextResponse.json(
      {
        ok: true,
        data: {
          ...item,
          unitPriceAtOrder: decimalToNumber(item.unitPriceAtOrder),
          unitSizeAtOrder: item.unitSizeAtOrder
            ? decimalToNumber(item.unitSizeAtOrder)
            : null,
        },
        orderTotal: decimalToNumber(newTotal),
      },
      { status: 201, headers: CORS },
    );
  } catch (e: any) {
    console.error("POST order-items error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}
