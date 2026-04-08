import "dotenv/config";
import { prisma } from "../lib/prisma";
import type { ProductUom } from "../generated/prisma/client";
import {
  DULUX_PRICE_LIST_ID,
  EXACT_VARIANT_UPDATES,
  FAMILY_FALLBACK_UPDATES,
  MANUAL_REVIEW,
} from "./dulux_price_update_seed";

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
  if (!normalized) return { uom: null, unitSize: null };

  const match = normalized.match(
    /^((?:\d+(?:\.\d+)?))(ML|L|KG|G|UNIT|PACK|PIECE)?$/,
  );
  if (!match) return { uom: null, unitSize: null };

  const value = Number(match[1]);
  const rawUom = match[2] ?? null;
  if (!rawUom || Number.isNaN(value)) return { uom: null, unitSize: null };

  return { uom: rawUom as ProductUom, unitSize: value };
}

function sortRows(rows: readonly PriceUpdateRow[]) {
  return [...rows].sort((a, b) => {
    if (a.sourceRow !== b.sourceRow) return a.sourceRow - b.sourceRow;
    return a.productName.localeCompare(b.productName);
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
    const uniquePrices = [
      ...new Set(group.map((row) => row.newPrice.toFixed(2))),
    ];
    if (uniquePrices.length > 1) {
      for (const row of group) conflicts.push({ row, key });
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
      productName: row.productName,
      size: row.size,
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
      productName: row.productName,
      size: row.size,
      nextPrice,
    } as const;
  }

  await prisma.supplierProductPrice.create({
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
    productName: row.productName,
    size: row.size,
    nextPrice,
  } as const;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const includeFallbacks = !process.argv.includes("--exact-only");

  const supplier = await prisma.supplier.findFirst({
    where: { name: { contains: "DULUX", mode: "insensitive" }, isActive: true },
    orderBy: { createdAt: "asc" },
  });

  if (!supplier)
    throw new Error("Could not find active supplier matching 'DULUX'.");

  const exactRows = sortRows(EXACT_VARIANT_UPDATES);
  const fallbackPlan = includeFallbacks
    ? resolveFallbackRows(FAMILY_FALLBACK_UPDATES)
    : { safeRows: [] as PriceUpdateRow[], conflicts: [] as ConflictItem[] };

  const rows = [...exactRows, ...fallbackPlan.safeRows];

  console.log(`Using supplier: ${supplier.name} (${supplier.id})`);
  console.log(`Price list reference: ${DULUX_PRICE_LIST_ID}`);
  console.log(`Mode: ${dryRun ? "DRY-RUN" : "APPLY"}`);
  console.log(
    `Rows: ${rows.length} (${exactRows.length} exact, ${fallbackPlan.safeRows.length} safe fallback)`,
  );
  console.log(
    `Skipped conflicting fallback rows: ${fallbackPlan.conflicts.length}`,
  );
  console.log(`Manual review rows not applied: ${MANUAL_REVIEW.length}`);

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const result = await upsertSupplierPrice(supplier.id, row, dryRun);
    if (result.action === "create") created += 1;
    if (result.action === "update") updated += 1;
    console.log(
      `${dryRun ? "[preview]" : "[applied]"} ${result.action.toUpperCase()} ${result.productName} ${result.size} -> ${result.nextPrice}`,
    );
  }

  console.log("\nSummary");
  console.log(`- Created: ${created}`);
  console.log(`- Updated: ${updated}`);
  console.log(
    `- Conflicting fallback rows skipped: ${fallbackPlan.conflicts.length}`,
  );
  console.log(`- Manual review pending: ${MANUAL_REVIEW.length}`);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
