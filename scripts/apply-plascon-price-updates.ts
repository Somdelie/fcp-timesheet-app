import "dotenv/config";
import { prisma } from "../lib/prisma";
import type { ProductUom } from "../generated/prisma/client";
import {
  EXACT_VARIANT_UPDATES,
  FAMILY_FALLBACK_UPDATES,
  MANUAL_REVIEW,
  PLASCON_PRICE_LIST_ID,
} from "./plascon_price_update_seed";

type PriceUpdateRow =
  | (typeof EXACT_VARIANT_UPDATES)[number]
  | (typeof FAMILY_FALLBACK_UPDATES)[number];

type ParsedSize = {
  uom: ProductUom | null;
  unitSize: number | null;
};

type ConflictItem = {
  row: PriceUpdateRow;
  key: string;
};

function parseSize(size: string): ParsedSize {
  const normalized = size.trim().toUpperCase().replace(",", ".");
  const match = normalized.match(/^((?:\d+(?:\.\d+)?))(ML|L|KG|G|UNIT|PACK|PIECE)?$/);

  if (!match) {
    return { uom: null, unitSize: null };
  }

  const value = Number(match[1]);
  const rawUom = match[2] ?? null;

  if (!rawUom || Number.isNaN(value)) {
    return { uom: null, unitSize: null };
  }

  return { uom: rawUom as ProductUom, unitSize: value };
}

function sortRows(rows: readonly PriceUpdateRow[]) {
  return [...rows].sort((left, right) => {
    if (left.sourceRow !== right.sourceRow) {
      return left.sourceRow - right.sourceRow;
    }
    return left.productCode.localeCompare(right.productCode);
  });
}

function buildRowKey(row: PriceUpdateRow) {
  const parsed = parseSize(row.size);
  return `${row.productId}::${parsed.uom ?? "null"}::${parsed.unitSize ?? "null"}`;
}

function resolveFallbackRows(rows: readonly PriceUpdateRow[]) {
  const groups = new Map<string, PriceUpdateRow[]>();

  for (const row of rows) {
    const key = buildRowKey(row);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  const safeRows: PriceUpdateRow[] = [];
  const conflicts: ConflictItem[] = [];

  for (const [key, group] of groups.entries()) {
    const uniquePrices = [...new Set(group.map((row) => row.newPrice.toFixed(2)))];

    if (uniquePrices.length > 1) {
      for (const row of group) {
        conflicts.push({ row, key });
      }
      continue;
    }

    safeRows.push(group[0]);
  }

  return { safeRows: sortRows(safeRows), conflicts };
}

async function upsertSupplierPrice(
  supplierId: string,
  row: PriceUpdateRow,
  dryRun: boolean,
) {
  const { uom, unitSize } = parseSize(row.size);

  const existing = await prisma.supplierProductPrice.findFirst({
    where: {
      supplierId,
      productId: row.productId,
      uom,
      unitSize,
      isActive: true,
      endsOn: null,
    },
    orderBy: [{ startsOn: "desc" }, { createdAt: "desc" }],
  });

  const nextPrice = row.newPrice.toFixed(2);

  if (dryRun) {
    return {
      action: existing ? "update" : "create",
      existingId: existing?.id ?? null,
      productId: row.productId,
      productCode: row.productCode,
      productName: row.productName,
      size: row.size,
      uom,
      unitSize,
      nextPrice,
      sourceRow: row.sourceRow,
      sourceName: row.sourceName,
    } as const;
  }

  if (existing) {
    await prisma.supplierProductPrice.update({
      where: { id: existing.id },
      data: {
        price: nextPrice,
        startsOn: new Date(),
        endsOn: null,
        isActive: true,
      },
    });

    return {
      action: "update",
      existingId: existing.id,
      productId: row.productId,
      productCode: row.productCode,
      productName: row.productName,
      size: row.size,
      uom,
      unitSize,
      nextPrice,
      sourceRow: row.sourceRow,
      sourceName: row.sourceName,
    } as const;
  }

  const created = await prisma.supplierProductPrice.create({
    data: {
      supplierId,
      productId: row.productId,
      uom,
      unitSize,
      price: nextPrice,
      isActive: true,
      startsOn: new Date(),
      endsOn: null,
    },
  });

  return {
    action: "create",
    existingId: created.id,
    productId: row.productId,
    productCode: row.productCode,
    productName: row.productName,
    size: row.size,
    uom,
    unitSize,
    nextPrice,
    sourceRow: row.sourceRow,
    sourceName: row.sourceName,
  } as const;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const includeFallbacks = !process.argv.includes("--exact-only");

  const supplier = await prisma.supplier.findFirst({
    where: {
      name: { contains: "PLASCON", mode: "insensitive" },
      isActive: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (!supplier) {
    throw new Error("Could not find active supplier matching 'PLASCON'.");
  }

  const exactRows = sortRows(EXACT_VARIANT_UPDATES);
  const fallbackPlan = includeFallbacks
    ? resolveFallbackRows(FAMILY_FALLBACK_UPDATES)
    : { safeRows: [] as PriceUpdateRow[], conflicts: [] as ConflictItem[] };
  const rows = [...exactRows, ...fallbackPlan.safeRows];

  console.log(`Using supplier: ${supplier.name} (${supplier.id})`);
  console.log(`Price list reference: ${PLASCON_PRICE_LIST_ID}`);
  console.log(`Mode: ${dryRun ? "DRY-RUN" : "APPLY"}`);
  console.log(`Rows: ${rows.length} (${exactRows.length} exact, ${fallbackPlan.safeRows.length} safe fallback)`);
  console.log(`Skipped conflicting fallback rows: ${fallbackPlan.conflicts.length}`);
  console.log(`Manual review rows not applied: ${MANUAL_REVIEW.length}`);

  const results: Array<Awaited<ReturnType<typeof upsertSupplierPrice>>> = [];

  for (const row of rows) {
    const result = await upsertSupplierPrice(supplier.id, row, dryRun);
    results.push(result);
    console.log(`${dryRun ? "[preview]" : "[applied]"} ${result.action.toUpperCase()} ${result.productCode} ${result.productName} ${result.size} -> ${result.nextPrice}`);
  }

  const createdCount = results.filter((item) => item.action === "create").length;
  const updatedCount = results.filter((item) => item.action === "update").length;

  console.log("\nSummary");
  console.log(`- Created: ${createdCount}`);
  console.log(`- Updated: ${updatedCount}`);
  console.log(`- Conflicting fallback rows skipped: ${fallbackPlan.conflicts.length}`);
  console.log(`- Manual review pending: ${MANUAL_REVIEW.length}`);

  if (fallbackPlan.conflicts.length > 0) {
    console.log("\nConflicting fallback rows (not auto-applied):");
    for (const item of fallbackPlan.conflicts) {
      console.log(`- Row ${item.row.sourceRow}: ${item.row.sourceName} (${item.row.size}) -> ${item.row.newPrice.toFixed(2)} [${item.key}]`);
    }
  }

  if (MANUAL_REVIEW.length > 0) {
    console.log("\nManual review items:");
    for (const row of MANUAL_REVIEW) {
      console.log(`- Row ${row.sourceRow}: ${row.sourceName} (${row.size}) -> ${row.reason}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
