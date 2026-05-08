import "dotenv/config";

import { prisma } from "@/lib/prisma";

type PpeItem = {
  productId: string;
  quantity: number;
  size: string | null;
  color: string | null;
  product: {
    id: string;
    name: string;
    sku: string | null;
    normalizedName: string | null;
  };
};

type LegacyMatch = {
  id: string;
  name: string;
  stockQty: number;
  sku: string | null;
  category: "PPE" | "TOOL";
};

const APPLY = process.env.APPLY === "true";
const BEFORE_ISO = process.env.BEFORE_ISO?.trim();

function normalizeName(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function variantKey(productId: string, size: string | null, color: string | null) {
  return `${productId}|${size ?? ""}|${color ?? ""}`;
}

async function findLegacyProduct(item: PpeItem): Promise<LegacyMatch | null> {
  const sku = item.product.sku?.trim();
  if (sku) {
    const bySku = await prisma.product.findFirst({
      where: { sku },
      select: { id: true, name: true, stockQty: true, sku: true, category: true },
      orderBy: { createdAt: "asc" },
    });
    if (bySku) return bySku;
  }

  const normalizedName = normalizeName(item.product.normalizedName ?? item.product.name);
  if (!normalizedName) return null;

  return prisma.product.findFirst({
    where: {
      OR: [
        { normalizedName },
        { name: { equals: item.product.name, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, stockQty: true, sku: true, category: true },
    orderBy: { createdAt: "asc" },
  });
}

async function main() {
  const beforeDate = BEFORE_ISO ? new Date(BEFORE_ISO) : new Date();
  if (Number.isNaN(beforeDate.getTime())) {
    throw new Error(`Invalid BEFORE_ISO value: ${BEFORE_ISO}`);
  }

  console.log("=== Backfill /orders stock from existing PPE orders ===");
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN"}`);
  console.log(`Including non-cancelled PPE orders created before: ${beforeDate.toISOString()}\n`);

  const [rawTotal, rawStatusCounts, rawLatest] = await Promise.all([
    prisma.foremanPpeOrder.count(),
    prisma.foremanPpeOrder.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.foremanPpeOrder.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        foremanId: true,
        siteId: true,
        createdAt: true,
        items: {
          select: {
            productId: true,
            quantity: true,
            size: true,
            color: true,
            product: { select: { name: true, sku: true } },
          },
        },
      },
    }),
  ]);

  console.log("Raw PPE order table:");
  console.log(`  Total rows: ${rawTotal}`);
  console.log("  Status counts:", rawStatusCounts);
  console.log(
    "  Latest preview:",
    rawLatest.map((order) => ({
      id: order.id,
      status: order.status,
      foremanId: order.foremanId,
      siteId: order.siteId,
      createdAt: order.createdAt.toISOString(),
      items: order.items.map((item) => ({
        productId: item.productId,
        productName: item.product?.name ?? null,
        sku: item.product?.sku ?? null,
        quantity: item.quantity,
        size: item.size,
        color: item.color,
      })),
    })),
  );
  console.log("");

  const orders = await prisma.foremanPpeOrder.findMany({
    where: {
      status: { not: "CANCELLED" },
      createdAt: { lt: beforeDate },
    },
    select: {
      id: true,
      createdAt: true,
      items: {
        select: {
          productId: true,
          quantity: true,
          size: true,
          color: true,
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              normalizedName: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${orders.length} PPE orders.`);

  const productDeductions = new Map<
    string,
    { legacyProduct: LegacyMatch; qty: number; procurementNames: Set<string> }
  >();
  const variantDeductions = new Map<
    string,
    { productId: string; size: string | null; color: string | null; qty: number; productName: string }
  >();
  const unmatched = new Map<string, { name: string; sku: string | null; qty: number }>();

  for (const order of orders) {
    for (const item of order.items) {
      const legacyProduct = await findLegacyProduct(item);
      if (!legacyProduct) {
        const key = item.productId;
        const existing = unmatched.get(key);
        if (existing) {
          existing.qty += item.quantity;
        } else {
          unmatched.set(key, {
            name: item.product.name,
            sku: item.product.sku,
            qty: item.quantity,
          });
        }
        continue;
      }
      if (legacyProduct.category !== "PPE") continue;

      const existingProduct = productDeductions.get(legacyProduct.id);
      if (existingProduct) {
        existingProduct.qty += item.quantity;
        existingProduct.procurementNames.add(item.product.name);
      } else {
        productDeductions.set(legacyProduct.id, {
          legacyProduct,
          qty: item.quantity,
          procurementNames: new Set([item.product.name]),
        });
      }

      const size = item.size?.trim() || null;
      const color = item.color?.trim() || null;
      if (size || color) {
        const key = variantKey(legacyProduct.id, size, color);
        const existingVariant = variantDeductions.get(key);
        if (existingVariant) {
          existingVariant.qty += item.quantity;
        } else {
          variantDeductions.set(key, {
            productId: legacyProduct.id,
            size,
            color,
            qty: item.quantity,
            productName: legacyProduct.name,
          });
        }
      }
    }
  }

  console.log(`Matched ${productDeductions.size} /orders products.`);
  if (unmatched.size > 0) {
    console.log(`Unmatched PPE products: ${unmatched.size}`);
    for (const item of unmatched.values()) {
      console.log(`  UNMATCHED "${item.name}" sku=${item.sku ?? "-"} qty=${item.qty}`);
    }
  }

  console.log("\nProduct stock changes:");
  for (const entry of productDeductions.values()) {
    const current = entry.legacyProduct.stockQty;
    const next = current - entry.qty;
    const sourceNames = Array.from(entry.procurementNames).join(", ");
    console.log(
      `  "${entry.legacyProduct.name}" current=${current} deduct=${entry.qty} next=${next} source="${sourceNames}"`,
    );

    if (APPLY) {
      await prisma.product.update({
        where: { id: entry.legacyProduct.id },
        data: { stockQty: { decrement: entry.qty } },
      });
    }
  }

  console.log("\nVariant stock changes:");
  for (const entry of variantDeductions.values()) {
    const existing = await prisma.stockItemVariant.findFirst({
      where: { productId: entry.productId, size: entry.size, color: entry.color },
      select: { id: true, qty: true },
    });

    if (!existing) {
      console.log(
        `  SKIP "${entry.productName}" size=${entry.size ?? "-"} color=${entry.color ?? "-"} deduct=${entry.qty} - no /orders variant row`,
      );
      continue;
    }

    console.log(
      `  "${entry.productName}" size=${entry.size ?? "-"} color=${entry.color ?? "-"} current=${existing.qty} deduct=${entry.qty} next=${existing.qty - entry.qty}`,
    );

    if (APPLY) {
      await prisma.stockItemVariant.update({
        where: { id: existing.id },
        data: { qty: { decrement: entry.qty } },
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
