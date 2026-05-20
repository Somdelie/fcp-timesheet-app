/*
 * backfill-color-codes.ts
 *
 * One-off script to populate missing productColorVariant.colorCode values
 * from the associated procurement product (parsed SKU or inferred code).
 *
 * Usage (from project root):
 *   npx tsx scripts/backfill-color-codes.ts
 * or
 *   npx ts-node --project tsconfig.scripts.json scripts/backfill-color-codes.ts
 */

import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { parseBuildSmartProduct } from "@/lib/product-color-parser";
import { inferBuildSmartProductCode } from "@/lib/procurement/buildsmartProductCodes";

function hasBaseKeyword(name: string) {
  const lower = name.toLowerCase();
  return (
    lower.includes("t/base") ||
    lower.includes("deep base") ||
    lower.includes("pastel") ||
    lower.includes("white") ||
    lower.includes("clear") ||
    lower.includes("neutral")
  );
}

function mapMainSupplier(name?: string | null) {
  if (!name) return null;
  const lower = name.toLowerCase();
  if (lower.includes("plascon")) return "Plascon";
  if (lower.includes("dulux")) return "Dulux";
  if (lower.includes("sikkens")) return "Sikkens";
  if (lower.includes("interpon")) return "Interpon";
  return name;
}

async function main() {
  console.log("Backfill: populate productColorVariant.colorCode where missing");

  const variants = await prisma.productColorVariant.findMany({
    where: { colorCode: null },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          supplierPrices: {
            where: { isActive: true },
            select: { supplier: { select: { name: true } } },
            orderBy: { id: "asc" },
          },
        },
      },
    },
  });

  console.log(`Found ${variants.length} variants missing colorCode`);

  let updated = 0;
  for (const v of variants) {
    const prodName = v.product?.name ?? "";

    // Skip primers entirely — never assign tint codes to primers
    if (prodName.toLowerCase().includes("primer")) continue;

    // Skip products without a clear base keyword (user instructed)
    if (!hasBaseKeyword(prodName)) continue;

    const supplierName = v.product?.supplierPrices?.[0]?.supplier?.name ?? null;
    const mainSupplier = mapMainSupplier(supplierName);

    const parsed = parseBuildSmartProduct(prodName) as any;
    const candidate =
      parsed.colorCode ??
      parsed.sku ??
      inferBuildSmartProductCode(prodName, mainSupplier) ??
      v.product?.sku ??
      null;

    if (!candidate) {
      continue;
    }

    // Dry-run log before performing updates to make it easier to audit
    console.log({
      id: v.id,
      product: prodName,
      supplier: mainSupplier,
      parsed,
      candidate,
    });

    try {
      const updateData: any = { colorCode: candidate };
      if (!v.colorName && parsed.colorName)
        updateData.colorName = parsed.colorName;
      if (!v.baseType && parsed.baseType) updateData.baseType = parsed.baseType;
      if (!v.isTinted && parsed.isTinted) updateData.isTinted = parsed.isTinted;

      await prisma.productColorVariant.update({
        where: { id: v.id },
        data: updateData,
      });

      updated++;
      console.log(
        `Updated variant ${v.id} -> colorCode=${candidate} (supplier=${mainSupplier ?? "unknown"})`,
      );
    } catch (err) {
      console.error(`Failed to update variant ${v.id}:`, err);
    }
  }

  console.log(
    `Backfill complete: updated ${updated} of ${variants.length} variants.`,
  );
}

main()
  .catch((err) => {
    console.error("Fatal error during backfill:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
