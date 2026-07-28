import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { PpeOrderStatus, Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAuth(req: Request) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (
    session?.user &&
    (role === "ADMIN" || role === "OFFICE" || role === "SUPERVISOR")
  )
    return { id: (session.user as any).id as string, role };
  return null;
}

const itemInclude = {
  product: {
    select: {
      id: true,
      name: true,
      thumbnailUrl: true,
      colors: true,
      isDeductible: true,
      deductionSplits: true,
      supplierPrices: {
        where: { isActive: true },
        select: { price: true, supplierId: true },
        take: 1,
      },
    },
  },
};

const orderInclude = {
  foreman: { include: { user: { select: { id: true, name: true } } } },
  site: { select: { id: true, name: true, code: true } },
  createdByUser: { select: { id: true, name: true } },
  items: { include: itemInclude },
};

function normalizeName(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

async function findLegacyProductForProcurementProduct(
  tx: Prisma.TransactionClient,
  procurementProductId: string,
) {
  const procurementProduct = await tx.procurementProduct.findUnique({
    where: { id: procurementProductId },
    select: { name: true, sku: true, normalizedName: true },
  });

  if (!procurementProduct) return null;

  const sku = procurementProduct.sku?.trim();
  if (sku) {
    const bySku = await tx.product.findFirst({
      where: { sku },
      select: { id: true, category: true },
      orderBy: { createdAt: "asc" },
    });
    if (bySku) return bySku;
  }

  const normalizedName = normalizeName(
    procurementProduct.normalizedName ?? procurementProduct.name,
  );
  if (!normalizedName) return null;

  return tx.product.findFirst({
    where: {
      OR: [
        { normalizedName },
        { name: { equals: procurementProduct.name, mode: "insensitive" } },
      ],
    },
    select: { id: true, category: true },
    orderBy: { createdAt: "asc" },
  });
}

async function adjustLegacyOrderStock(
  tx: Prisma.TransactionClient,
  item: {
    productId: string;
    quantity: number;
    size?: string | null;
    color?: string | null;
  },
  direction: "deduct" | "restore",
) {
  const legacyProduct = await findLegacyProductForProcurementProduct(
    tx,
    item.productId,
  );
  if (!legacyProduct) return;
  if (legacyProduct.category !== "PPE") return;

  const quantityChange =
    direction === "deduct"
      ? { decrement: item.quantity }
      : { increment: item.quantity };

  await tx.product.update({
    where: { id: legacyProduct.id },
    data: { stockQty: quantityChange },
  });

  const size = item.size?.trim() || null;
  const color = item.color?.trim() || null;
  if (size || color) {
    await tx.stockItemVariant.updateMany({
      where: { productId: legacyProduct.id, size, color },
      data: { qty: quantityChange },
    });
  }
}

const LEGACY_STATUS_MAP: Record<string, PpeOrderStatus> = {
  PENDING: "PENDING",
  COLLECTED: "FULFILLED",
  DEDUCTED: "FULFILLED",
  APPLIED: "FULFILLED",
  PARTIALLY_APPLIED: "PARTIALLY_FULFILLED",
  CANCELLED: "CANCELLED",
};

/** GET /api/app/admin/ppe-orders?foremanId=&siteId=&status= */
export async function GET(req: Request) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const foremanId = url.searchParams.get("foremanId");
    const siteId = url.searchParams.get("siteId");
    const status = url.searchParams.get("status") as PpeOrderStatus | null;

    const where: Record<string, unknown> = {};
    if (foremanId) where.foremanId = foremanId;
    if (siteId) where.siteId = siteId;
    if (status) where.status = status;

    // New system orders
    const newRows = await prisma.foremanPpeOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: orderInclude,
    });

    // Legacy orders from productOrder with PPE items
    const legacyWhere: Record<string, unknown> = {
      items: { some: { product: { category: "PPE" } } },
    };
    if (foremanId) legacyWhere.foremanId = foremanId;

    const legacyRows = await prisma.productOrder.findMany({
      where: legacyWhere,
      orderBy: { createdAt: "desc" },
      include: {
        foreman: { include: { user: { select: { id: true, name: true } } } },
        items: {
          where: { product: { category: "PPE" } },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                thumbnailUrl: true,
                colors: true,
              },
            },
          },
        },
      },
    });

    const legacyNormalized = legacyRows
      .filter((o) => o.foremanId && o.foreman)
      .map((o) => ({
        id: o.id,
        isLegacy: true,
        status: (LEGACY_STATUS_MAP[o.status] ?? "PENDING") as PpeOrderStatus,
        note: null,
        createdAt: o.createdAt,
        foreman: {
          id: o.foreman!.id,
          user: { id: o.foreman!.user.id, name: o.foreman!.user.name },
        },
        site: null,
        createdByUser: null,
        items: o.items.map((i) => ({
          id: i.id,
          quantity: i.quantity,
          size: i.size ?? null,
          color: i.color ?? null,
          note: i.note ?? null,
          product: {
            id: i.product.id,
            name: i.product.name,
            thumbnailUrl: i.product.thumbnailUrl ?? null,
            colors: i.product.colors ?? [],
            isDeductible: false,
            deductionSplits: 1,
            supplierPrices: [] as { price: number; supplierId: string }[],
          },
        })),
      }));

    const combined = [
      ...newRows.map((r) => ({ ...r, isLegacy: false })),
      ...legacyNormalized,
    ].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return NextResponse.json({ ok: true, data: combined });
  } catch (e: any) {
    console.error("GET ppe-orders error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/** POST /api/app/admin/ppe-orders */
export async function POST(req: Request) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { foremanId, siteId, note, chargeToSite, destination, items } =
      body as {
        foremanId: string;
        siteId?: string;
        note?: string;
        chargeToSite?: boolean;
        destination?: string;
        items: {
          productId: string;
          quantity: number;
          size?: string;
          color?: string;
          note?: string;
          unitPriceAtOrder?: number | null;
        }[];
      };

    if (!foremanId)
      return NextResponse.json(
        { error: "foremanId is required" },
        { status: 400 },
      );
    if (!items?.length)
      return NextResponse.json(
        { error: "At least one item is required" },
        { status: 400 },
      );

    // Pre-fetch active supplier prices for all products in one query
    const productIds = [...new Set(items.map((i) => i.productId))];
    const supplierPrices = await prisma.supplierProductPrice.findMany({
      where: { productId: { in: productIds }, isActive: true },
      select: { productId: true, price: true },
      orderBy: { startsOn: "desc" },
    });
    const priceMap = new Map<string, number>();
    for (const sp of supplierPrices) {
      if (!priceMap.has(sp.productId))
        priceMap.set(sp.productId, Number(sp.price));
    }

    // Pre-fetch procurement product metadata to help map items to Cape Town stock items
    const procurementProducts = await prisma.procurementProduct.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, normalizedName: true },
    });
    const procurementMap = new Map(procurementProducts.map((p) => [p.id, p]));

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.foremanPpeOrder.create({
        data: {
          foremanId,
          siteId: siteId || null,
          note:
            destination === "CAPE_TOWN"
              ? `[DEST:CAPE_TOWN] ${String(note ?? "").trim()}`
              : note?.trim() || null,
          createdByUserId: auth.id,
          status: "PENDING",
          chargeToSite: chargeToSite ?? false,
          items: {
            create: items.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              size: i.size?.trim() || null,
              color: i.color?.trim() || null,
              note: i.note?.trim() || null,
              unitPriceAtOrder:
                i.unitPriceAtOrder != null
                  ? i.unitPriceAtOrder
                  : (priceMap.get(i.productId) ?? null),
            })),
          },
        },
        include: orderInclude,
      });

      // Deduct stock for each item
      if (String(destination ?? "JHB").toUpperCase() === "CAPE_TOWN") {
        // For Cape Town destination, create CapeTownStockOrder entries when we can
        for (const i of items) {
          const size = i.size?.trim() || null;
          const color = i.color?.trim() || null;

          const procurement = procurementMap.get(i.productId as string) as
            | { id: string; name: string | null; normalizedName: string | null }
            | undefined;

          let ctItem = null;
          if (procurement?.name) {
            ctItem = await tx.capeTownStockItem.findFirst({
              where: {
                name: { equals: procurement.name, mode: "insensitive" },
              },
            });
          }
          if (!ctItem && procurement?.normalizedName) {
            ctItem = await tx.capeTownStockItem.findFirst({
              where: {
                name: {
                  contains: procurement.normalizedName,
                  mode: "insensitive",
                },
              },
            });
          }

          if (ctItem) {
            await tx.capeTownStockOrder.create({
              data: {
                itemId: ctItem.id,
                qty: i.quantity,
                size: size,
                color: color,
                notes: `ForemanPpeOrder:${created.id}`,
                status: "PENDING",
              },
            });
            // do not deduct JHB procurement stock when creating Cape Town order
          } else {
            // fallback: deduct JHB procurement stock if we can't map to Cape Town
            if (size && color) {
              await tx.productVariantStock.upsert({
                where: {
                  productId_size_color_condition: {
                    productId: i.productId,
                    size,
                    color,
                    condition: "OLD",
                  },
                },
                update: { qty: { decrement: i.quantity } },
                create: {
                  productId: i.productId,
                  size,
                  color,
                  qty: -i.quantity,
                },
              });
            }
            await tx.procurementProduct.update({
              where: { id: i.productId },
              data: { stockQty: { decrement: i.quantity } },
            });

            await adjustLegacyOrderStock(
              tx,
              { productId: i.productId, quantity: i.quantity, size, color },
              "deduct",
            );
          }
        }
      } else {
        // Default: JHB flow — deduct procurement stock as before
        for (const i of items) {
          const size = i.size?.trim() || null;
          const color = i.color?.trim() || null;

          // Deduct variant stock if a size and color are both selected
          if (size && color) {
            await tx.productVariantStock.upsert({
              where: {
                productId_size_color_condition: {
                  productId: i.productId,
                  size,
                  color,
                  condition: "OLD",
                },
              },
              update: { qty: { decrement: i.quantity } },
              create: { productId: i.productId, size, color, qty: -i.quantity },
            });
          }

          // Always deduct from master stockQty
          await tx.procurementProduct.update({
            where: { id: i.productId },
            data: { stockQty: { decrement: i.quantity } },
          });

          await adjustLegacyOrderStock(
            tx,
            { productId: i.productId, quantity: i.quantity, size, color },
            "deduct",
          );
        }
      }

      return created;
    });

    return NextResponse.json({ ok: true, data: order }, { status: 201 });
  } catch (e: any) {
    console.error("POST ppe-orders error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
