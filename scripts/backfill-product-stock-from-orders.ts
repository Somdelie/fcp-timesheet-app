import "dotenv/config";

import { prisma } from "@/lib/prisma";

const APPLY = process.env.APPLY === "true";
const SINCE_ISO = process.env.SINCE_ISO?.trim();
const BEFORE_ISO = process.env.BEFORE_ISO?.trim();
const PRODUCT_IDS = (process.env.PRODUCT_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

function parseDate(value: string | undefined, label: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return date;
}

async function main() {
  const since = parseDate(SINCE_ISO, "SINCE_ISO");
  const before = parseDate(BEFORE_ISO, "BEFORE_ISO");

  const createdAt: { gte?: Date; lt?: Date } = {};
  if (since) createdAt.gte = since;
  if (before) createdAt.lt = before;

  const where = {
    order: {
      status: { not: "CANCELLED" as const },
      ...(Object.keys(createdAt).length > 0 ? { createdAt } : {}),
    },
    ...(PRODUCT_IDS.length > 0 ? { productId: { in: PRODUCT_IDS } } : {}),
  };

  console.log("=== Backfill Product.stockQty from existing /orders ===");
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN"}`);
  console.log(`SINCE_ISO: ${since?.toISOString() ?? "-"}`);
  console.log(`BEFORE_ISO: ${before?.toISOString() ?? "-"}`);
  console.log(`PRODUCT_IDS: ${PRODUCT_IDS.length > 0 ? PRODUCT_IDS.join(", ") : "-"}\n`);

  const [orderCount, statusCounts, groupedItems] = await Promise.all([
    prisma.productOrder.count({
      where: {
        status: { not: "CANCELLED" },
        ...(Object.keys(createdAt).length > 0 ? { createdAt } : {}),
      },
    }),
    prisma.productOrder.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.productOrderItem.groupBy({
      by: ["productId"],
      where: { ...where, product: { category: "PPE" } },
      _sum: { quantity: true },
    }),
  ]);

  console.log(`Matching active orders: ${orderCount}`);
  console.log("All order status counts:", statusCounts);
  console.log("");

  if (groupedItems.length === 0) {
    console.log("No matching order items found.");
    return;
  }

  for (const item of groupedItems) {
    const qty = item._sum.quantity ?? 0;
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      select: {
        id: true,
        name: true,
        sku: true,
        category: true,
        stockQty: true,
        variants: {
          select: { id: true, size: true, color: true, qty: true },
        },
      },
    });

    if (!product) {
      console.log(`SKIP missing product ${item.productId} qty=${qty}`);
      continue;
    }

    if (product.category !== "PPE") {
      console.log(`SKIP "${product.name}" category=${product.category} - stock is tracked for PPE only`);
      continue;
    }

    const nextStockQty = product.stockQty - qty;
    console.log(
      `Product "${product.name}" id=${product.id} sku=${product.sku ?? "-"} current=${product.stockQty} deduct=${qty} next=${nextStockQty}`,
    );

    if (APPLY) {
      await prisma.product.update({
        where: { id: product.id },
        data: { stockQty: { decrement: qty } },
      });
    }
  }

  const variantItems = await prisma.productOrderItem.groupBy({
    by: ["productId", "size", "color"],
    where: {
      ...where,
      product: { category: "PPE" },
      OR: [{ size: { not: null } }, { color: { not: null } }],
    },
    _sum: { quantity: true },
  });

  if (variantItems.length > 0) {
    console.log("\nVariant stock changes:");
  }

  for (const item of variantItems) {
    const qty = item._sum.quantity ?? 0;
    const variant = await prisma.stockItemVariant.findFirst({
      where: {
        productId: item.productId,
        size: item.size,
        color: item.color,
      },
      select: {
        id: true,
        qty: true,
        product: { select: { name: true } },
      },
    });

    if (!variant) {
      console.log(
        `SKIP variant productId=${item.productId} size=${item.size ?? "-"} color=${item.color ?? "-"} deduct=${qty} - no variant row`,
      );
      continue;
    }

    console.log(
      `Variant "${variant.product.name}" size=${item.size ?? "-"} color=${item.color ?? "-"} current=${variant.qty} deduct=${qty} next=${variant.qty - qty}`,
    );

    if (APPLY) {
      await prisma.stockItemVariant.update({
        where: { id: variant.id },
        data: { qty: { decrement: qty } },
      });
    }
  }

  console.log("\n=== Done ===");
  if (!APPLY) {
    console.log("Dry run only. Run with APPLY=true to write these stock updates.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
