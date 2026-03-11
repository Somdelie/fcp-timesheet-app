import "dotenv/config";

import { prisma } from "@/lib/prisma";

/**
 * Backfill script for normalizedName / normalizedLabel fields.
 *
 * Targets: ProductCategory, Supplier, Product, ProcurementProduct, EarlySignOutReason
 *
 * Rules:
 * - Skip rows where the normalized field is already populated.
 * - Normalize: trim, collapse internal whitespace, lowercase.
 * - Log duplicates (same normalized value) for manual review — do NOT crash.
 */

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

async function backfillProductCategories() {
  const rows = await prisma.productCategory.findMany({
    where: { normalizedName: null },
    select: { id: true, name: true },
  });
  console.log(`ProductCategory: ${rows.length} rows to backfill`);

  const seen = new Map<string, string[]>();
  let updated = 0;

  for (const row of rows) {
    const norm = normalize(row.name);
    const ids = seen.get(norm) ?? [];
    ids.push(row.id);
    seen.set(norm, ids);

    await prisma.productCategory.update({
      where: { id: row.id },
      data: { normalizedName: norm },
    });
    updated++;
  }

  for (const [norm, ids] of seen) {
    if (ids.length > 1) {
      console.warn(
        `  ⚠ DUPLICATE ProductCategory normalizedName="${norm}" ids=[${ids.join(", ")}]`,
      );
    }
  }
  console.log(`  Updated ${updated} rows`);
}

async function backfillSuppliers() {
  const rows = await prisma.supplier.findMany({
    where: { normalizedName: null },
    select: { id: true, name: true },
  });
  console.log(`Supplier: ${rows.length} rows to backfill`);

  const seen = new Map<string, string[]>();
  let updated = 0;

  for (const row of rows) {
    const norm = normalize(row.name);
    const ids = seen.get(norm) ?? [];
    ids.push(row.id);
    seen.set(norm, ids);

    await prisma.supplier.update({
      where: { id: row.id },
      data: { normalizedName: norm },
    });
    updated++;
  }

  for (const [norm, ids] of seen) {
    if (ids.length > 1) {
      console.warn(
        `  ⚠ DUPLICATE Supplier normalizedName="${norm}" ids=[${ids.join(", ")}]`,
      );
    }
  }
  console.log(`  Updated ${updated} rows`);
}

async function backfillProducts() {
  const rows = await prisma.product.findMany({
    where: { normalizedName: null },
    select: { id: true, name: true },
  });
  console.log(`Product: ${rows.length} rows to backfill`);

  const seen = new Map<string, string[]>();
  let updated = 0;

  for (const row of rows) {
    const norm = normalize(row.name);
    const ids = seen.get(norm) ?? [];
    ids.push(row.id);
    seen.set(norm, ids);

    await prisma.product.update({
      where: { id: row.id },
      data: { normalizedName: norm },
    });
    updated++;
  }

  for (const [norm, ids] of seen) {
    if (ids.length > 1) {
      console.warn(
        `  ⚠ DUPLICATE Product normalizedName="${norm}" ids=[${ids.join(", ")}]`,
      );
    }
  }
  console.log(`  Updated ${updated} rows`);
}

async function backfillProcurementProducts() {
  const rows = await prisma.procurementProduct.findMany({
    where: { normalizedName: null },
    select: { id: true, name: true },
  });
  console.log(`ProcurementProduct: ${rows.length} rows to backfill`);

  const seen = new Map<string, string[]>();
  let updated = 0;

  for (const row of rows) {
    const norm = normalize(row.name);
    const ids = seen.get(norm) ?? [];
    ids.push(row.id);
    seen.set(norm, ids);

    await prisma.procurementProduct.update({
      where: { id: row.id },
      data: { normalizedName: norm },
    });
    updated++;
  }

  for (const [norm, ids] of seen) {
    if (ids.length > 1) {
      console.warn(
        `  ⚠ DUPLICATE ProcurementProduct normalizedName="${norm}" ids=[${ids.join(", ")}]`,
      );
    }
  }
  console.log(`  Updated ${updated} rows`);
}

async function backfillEarlySignOutReasons() {
  const rows = await prisma.earlySignOutReason.findMany({
    where: { normalizedLabel: null },
    select: { id: true, label: true },
  });
  console.log(`EarlySignOutReason: ${rows.length} rows to backfill`);

  const seen = new Map<string, string[]>();
  let updated = 0;

  for (const row of rows) {
    const norm = normalize(row.label);
    const ids = seen.get(norm) ?? [];
    ids.push(row.id);
    seen.set(norm, ids);

    await prisma.earlySignOutReason.update({
      where: { id: row.id },
      data: { normalizedLabel: norm },
    });
    updated++;
  }

  for (const [norm, ids] of seen) {
    if (ids.length > 1) {
      console.warn(
        `  ⚠ DUPLICATE EarlySignOutReason normalizedLabel="${norm}" ids=[${ids.join(", ")}]`,
      );
    }
  }
  console.log(`  Updated ${updated} rows`);
}

async function main() {
  console.log("=== Backfill normalized fields ===\n");

  await backfillProductCategories();
  await backfillSuppliers();
  await backfillProducts();
  await backfillProcurementProducts();
  await backfillEarlySignOutReasons();

  console.log("\n=== Done ===");
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
