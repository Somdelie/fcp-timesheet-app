/*
 * revert-backfill-color-codes.ts
 *
 * Revert the incorrect backfill that populated colorCode with product SKUs.
 * Clear all colorCode values that match the pattern of product codes.
 *
 * Usage:
 *   npx tsx scripts/revert-backfill-color-codes.ts
 */

import "dotenv/config";
import { prisma } from "@/lib/prisma";

async function main() {
  console.log("Reverting incorrect colorCode backfill...");

  // Find all variants with colorCode and filter for SKU-like patterns
  const allVariants = await prisma.productColorVariant.findMany({
    where: { colorCode: { not: null } },
  });

  const skuPattern = /^[A-Z]{2,4}\d+/i; // Matches SKU patterns like PEM00100020, PRT0090014
  const variants = allVariants.filter(
    (v) => v.colorCode && skuPattern.test(v.colorCode),
  );

  console.log(
    `Found ${variants.length} variants with SKU-like colorCode values`,
  );

  let cleared = 0;
  for (const v of variants) {
    try {
      await prisma.productColorVariant.update({
        where: { id: v.id },
        data: { colorCode: null },
      });
      cleared++;
      console.log(`Cleared variant ${v.id} (was: ${v.colorCode})`);
    } catch (err) {
      console.error(`Failed to clear variant ${v.id}:`, err);
    }
  }

  console.log(`Revert complete: cleared ${cleared} variants.`);
}

main()
  .catch((err) => {
    console.error("Fatal error during revert:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
