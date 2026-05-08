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

async function adjustProcurementOrderStock(
  tx: Prisma.TransactionClient,
  item: {
    productId: string;
    quantity: number;
    size?: string | null;
    color?: string | null;
  },
  direction: "deduct" | "restore",
) {
  const quantityChange =
    direction === "deduct"
      ? { decrement: item.quantity }
      : { increment: item.quantity };

  const size = item.size?.trim() || "";
  const color = item.color?.trim() || "";
  if (size || color) {
    await tx.productVariantStock.upsert({
      where: {
        productId_size_color: { productId: item.productId, size, color },
      },
      update: { qty: quantityChange },
      create: {
        productId: item.productId,
        size,
        color,
        qty: direction === "deduct" ? -item.quantity : item.quantity,
      },
    });
  }

  await tx.procurementProduct.update({
    where: { id: item.productId },
    data: { stockQty: quantityChange },
  });

  await adjustLegacyOrderStock(tx, item, direction);
}

/** PATCH /api/app/admin/ppe-orders/[id] — update status / note */
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
    const { status, note } = body as { status?: PpeOrderStatus; note?: string };

    const data: Record<string, unknown> = {};
    if (status !== undefined) data.status = status;
    if (note !== undefined) data.note = note?.trim() || null;

    const updated = await prisma.$transaction(async (tx) => {
      // Fetch current order with items so we can restore stock if cancelling
      const current = await tx.foremanPpeOrder.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!current)
        throw Object.assign(new Error("Not found"), { code: "P2025" });

      const wasCancelled = current.status === "CANCELLED";
      const nowCancelled = status === "CANCELLED";

      const result = await tx.foremanPpeOrder.update({
        where: { id },
        data,
        include: {
          foreman: { include: { user: { select: { id: true, name: true } } } },
          site: { select: { id: true, name: true, code: true } },
          items: {
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

      // Restore stock when an active order is cancelled
      if (!wasCancelled && nowCancelled) {
        for (const item of current.items) {
          await adjustProcurementOrderStock(tx, item, "restore");
        }
      }

      // If a cancelled order is re-opened, deduct the stock again.
      if (wasCancelled && status !== undefined && !nowCancelled) {
        for (const item of current.items) {
          await adjustProcurementOrderStock(tx, item, "deduct");
        }
      }

      return result;
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
    if (!auth)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await ctx.params;

    await prisma.$transaction(async (tx) => {
      const current = await tx.foremanPpeOrder.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!current)
        throw Object.assign(new Error("Not found"), { code: "P2025" });

      await tx.foremanPpeOrder.delete({ where: { id } });

      // Restore stock for non-cancelled orders (cancelled orders already had stock restored)
      if (current.status !== "CANCELLED") {
        for (const item of current.items) {
          await adjustProcurementOrderStock(tx, item, "restore");
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.code === "P2025")
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    console.error("DELETE ppe-order error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
