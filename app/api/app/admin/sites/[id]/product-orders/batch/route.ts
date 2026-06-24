import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { decimalToNumber } from "@/lib/dateUtc";
import { resolveUnitPrice } from "@/lib/procurement";
import { Prisma } from "@/generated/prisma/client";
import { ensureInitialFinishingScheduleForColourProduct } from "@/lib/procurement/finishingScheduleAutoInitial";
import { ensureSitePaintColorFromOrderItem } from "@/lib/procurement/sitePaintColorSeeder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
    if (p && (p.role === "ADMIN" || p.role === "OFFICE" || p.role === "SUPERVISOR"))
      return { id: p.sub, role: p.role as "ADMIN" | "OFFICE" | "SUPERVISOR" };
  }
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (session?.user && (role === "ADMIN" || role === "OFFICE" || role === "SUPERVISOR"))
    return { id: (session.user as any).id as string, role: role as "ADMIN" | "OFFICE" | "SUPERVISOR" };
  return null;
}

type BatchItem = {
  productId: string;
  quantity: number;
  uom?: string | null;
  unitSize?: number | null;
};

type BatchForeman = {
  foremanId: string;
  foremanName: string;
  items: BatchItem[];
};

/**
 * POST /api/app/admin/sites/[id]/product-orders/batch
 *
 * Creates one SiteProductOrder per foreman in a single transaction.
 * Body: { supplierId?, reference?, note?, foremen: BatchForeman[] }
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });

    const { id: siteId } = await ctx.params;
    const body = await req.json();
    const { supplierId, reference, note, foremen } = body as {
      supplierId?: string;
      reference?: string;
      note?: string;
      foremen: BatchForeman[];
    };

    if (!Array.isArray(foremen) || foremen.length === 0)
      return NextResponse.json({ error: "foremen array is required" }, { status: 400, headers: CORS });

    // Resolve prices for all unique product/uom/unitSize combos upfront
    const priceCache = new Map<string, Prisma.Decimal>();

    async function getPrice(productId: string, uom?: string | null, unitSize?: number | null) {
      const key = `${productId}~${uom ?? ""}~${unitSize ?? ""}`;
      if (priceCache.has(key)) return priceCache.get(key)!;
      const price = await resolveUnitPrice({
        supplierId: supplierId || undefined,
        productId,
        uom: uom ?? undefined,
        unitSize: unitSize ?? undefined,
      });
      priceCache.set(key, new Prisma.Decimal(price));
      return priceCache.get(key)!;
    }

    // Resolve all prices before entering transaction
    for (const f of foremen) {
      for (const item of f.items) {
        await getPrice(item.productId, item.uom, item.unitSize);
      }
    }

    const supplier = supplierId
      ? await prisma.supplier.findUnique({
          where: { id: supplierId },
          select: { name: true },
        })
      : null;

    // Create all orders in one transaction
    const orders = await prisma.$transaction(async (tx) => {
      const created = [];
      for (const f of foremen) {
        if (f.items.length === 0) continue;

        const order = await tx.siteProductOrder.create({
          data: {
            site: { connect: { id: siteId } },
            supplier: supplierId ? { connect: { id: supplierId } } : undefined,
            createdByUser: { connect: { id: auth.id } },
            foreman: f.foremanId ? { connect: { id: f.foremanId } } : undefined,
            foremanName: f.foremanName || null,
            reference: reference?.trim() || null,
            note: note?.trim() || null,
          },
        });

        let total = new Prisma.Decimal(0);
        for (const item of f.items) {
          const price = await getPrice(item.productId, item.uom, item.unitSize);
          const orderItem = await tx.siteProductOrderItem.create({
            data: {
              order: { connect: { id: order.id } },
              product: { connect: { id: item.productId } },
              quantity: item.quantity,
              unitPriceAtOrder: price,
              uomAtOrder: (item.uom as any) || null,
              unitSizeAtOrder: item.unitSize ?? null,
            },
          });
          await ensureInitialFinishingScheduleForColourProduct(tx, {
            siteId,
            productId: item.productId,
          });
          await ensureSitePaintColorFromOrderItem(tx, {
            siteId,
            productId: item.productId,
            rawDescription: null,
            supplierId: supplierId ?? null,
            supplierName: supplier?.name ?? null,
            sourceOrderId: order.id,
            sourceOrderItemId: orderItem.id,
            orderReference: order.reference,
            sourceFile: "site product order batch",
          });
          total = total.add(price.mul(item.quantity));
        }

        await tx.siteProductOrder.update({
          where: { id: order.id },
          data: { totalCost: total },
        });

        created.push({ orderId: order.id, foremanId: f.foremanId, foremanName: f.foremanName, total: decimalToNumber(total) });
      }
      return created;
    });

    return NextResponse.json({ ok: true, data: orders }, { status: 201, headers: CORS });
  } catch (e: any) {
    console.error("POST batch product-orders error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500, headers: CORS });
  }
}
