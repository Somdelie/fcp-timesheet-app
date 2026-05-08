import "dotenv/config";

import { prisma } from "@/lib/prisma";

/**
 * Backfill stock quantities from existing plant assignments and PPE orders.
 *
 * Run this ONCE after deploying the stock-deduction fix so that orders placed
 * before the fix are reflected in ProcurementProduct.stockQty / ProductVariantStock.qty.
 *
 * Safe to verify first with DRY_RUN=true:
 *   DRY_RUN=true npx ts-node -r tsconfig-paths/register scripts/backfill-stock-from-orders.ts
 */

const DRY_RUN = process.env.DRY_RUN === "true";

async function main() {
  console.log(`=== Backfill stock from existing orders (DRY_RUN=${DRY_RUN}) ===\n`);

  // ──────────────────────────────────────────────────────────────
  // 1. PLANT ASSIGNMENTS — deduct for every currently DEPLOYED item
  // ──────────────────────────────────────────────────────────────
  console.log("--- Plant Assignments ---");

  const deployedAssignments = await prisma.sitePlantAssignment.findMany({
    where: { status: { in: ["DEPLOYED", "REPAIR"] } },
    select: { id: true, productId: true, quantity: true, status: true },
  });

  console.log(`Found ${deployedAssignments.length} deployed/repair plant assignments`);

  // Aggregate by productId
  const plantDeductions = new Map<string, number>();
  for (const a of deployedAssignments) {
    plantDeductions.set(a.productId, (plantDeductions.get(a.productId) ?? 0) + a.quantity);
  }

  for (const [productId, totalQty] of plantDeductions.entries()) {
    const product = await prisma.procurementProduct.findUnique({
      where: { id: productId },
      select: { name: true, stockQty: true },
    });
    const currentQty = product?.stockQty ?? 0;

    if (currentQty === 0) {
      console.log(`  SKIP Plant "${product?.name}" — stockQty is 0 (not yet set)`);
      continue;
    }

    const newQty = currentQty - totalQty;
    console.log(
      `  Plant "${product?.name}" — current: ${currentQty}, deduct: ${totalQty}, new: ${newQty}`
    );

    if (!DRY_RUN) {
      await prisma.procurementProduct.update({
        where: { id: productId },
        data: { stockQty: { decrement: totalQty } },
      });
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 2. PPE ORDERS — deduct for all non-CANCELLED orders
  // ──────────────────────────────────────────────────────────────
  console.log("\n--- PPE Orders ---");

  const activeOrders = await prisma.foremanPpeOrder.findMany({
    where: { status: { not: "CANCELLED" } },
    include: { items: true },
  });

  console.log(`Found ${activeOrders.length} active PPE orders`);

  // Aggregate master stockQty deductions
  const ppeDeductions = new Map<string, number>();
  // Aggregate variant deductions: key = "productId|size|color"
  const variantDeductions = new Map<string, { productId: string; size: string | null; color: string | null; qty: number }>();

  for (const order of activeOrders) {
    for (const item of order.items) {
      // Master stockQty
      ppeDeductions.set(item.productId, (ppeDeductions.get(item.productId) ?? 0) + item.quantity);

      // Variant stockQty (only when size or color present)
      if (item.size || item.color) {
        const vKey = `${item.productId}|${item.size ?? ""}|${item.color ?? ""}`;
        const existing = variantDeductions.get(vKey);
        if (existing) {
          existing.qty += item.quantity;
        } else {
          variantDeductions.set(vKey, {
            productId: item.productId,
            size: item.size ?? null,
            color: item.color ?? null,
            qty: item.quantity,
          });
        }
      }
    }
  }

  // Apply master stock deductions (only where stock > 0)
  for (const [productId, totalQty] of ppeDeductions.entries()) {
    const product = await prisma.procurementProduct.findUnique({
      where: { id: productId },
      select: { name: true, stockQty: true },
    });
    const currentQty = product?.stockQty ?? 0;

    if (currentQty === 0) {
      console.log(`  SKIP PPE "${product?.name}" — stockQty is 0 (not yet set)`);
      continue;
    }

    const newQty = currentQty - totalQty;
    console.log(
      `  PPE "${product?.name}" — current: ${currentQty}, deduct: ${totalQty}, new: ${newQty}`
    );

    if (!DRY_RUN) {
      await prisma.procurementProduct.update({
        where: { id: productId },
        data: { stockQty: { decrement: totalQty } },
      });
    }
  }

  // Apply variant stock deductions (only where variant qty > 0)
  for (const v of variantDeductions.values()) {
    const existing = await prisma.productVariantStock.findFirst({
      where: { productId: v.productId, size: v.size, color: v.color },
      select: { id: true, qty: true },
    });
    if (!existing) {
      console.log(`  SKIP Variant [productId=${v.productId} size=${v.size} color=${v.color}] - no variant row`);
      continue;
    }
    const currentQty = existing?.qty ?? 0;

    if (currentQty === 0) {
      console.log(`  SKIP Variant [productId=${v.productId} size=${v.size} color=${v.color}] — qty is 0 (not yet set)`);
      continue;
    }

    const newQty = currentQty - v.qty;
    console.log(
      `  Variant [productId=${v.productId} size=${v.size} color=${v.color}] — current: ${currentQty}, deduct: ${v.qty}, new: ${newQty}`
    );

    if (!DRY_RUN) {
      await prisma.productVariantStock.update({
        where: { id: existing.id },
        data: { qty: { decrement: v.qty } },
      });
    }
  }

  console.log("\n=== Done ===");
  if (DRY_RUN) {
    console.log("DRY RUN — no changes written. Remove DRY_RUN=true to apply.");
  } else {
    console.log("Stock quantities updated successfully.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
