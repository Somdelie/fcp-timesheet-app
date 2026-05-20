/*
 * backfill-colors-from-products.ts
 *
 * Extract color information from all ProcurementProduct names and create
 * ProductColorVariant records for each product-color combination found.
 *
 * This properly backs the /admin/paints-colors page with real color data
 * extracted from product descriptions.
 *
 * Usage:
 *   npx tsx scripts/backfill-colors-from-products.ts
 */

import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { parseBuildSmartProduct } from "@/lib/product-color-parser";

async function main() {
  console.log(
    "Backfill: extract colors from all product names and create variants",
  );

  const products = await prisma.procurementProduct.findMany({
    select: { id: true, name: true, sku: true },
  });

  console.log(`Processing ${products.length} products...`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const product of products) {
    const parsed = parseBuildSmartProduct(product.name);
    const { colorName, baseType, isTinted } = parsed;

    // Skip if no color was detected
    if (!colorName) {
      skipped++;
      continue;
    }

    try {
      // Check if this color variant already exists
      const existing = await prisma.productColorVariant.findFirst({
        where: {
          productId: product.id,
          colorName: { equals: colorName, mode: "insensitive" },
          baseType,
        },
        select: { id: true },
      });

      if (existing) {
        // Already exists, skip
        continue;
      }

      // Create the color variant
      await prisma.productColorVariant.create({
        data: {
          productId: product.id,
          colorName,
          baseType,
          isTinted,
        },
      });

      created++;
      console.log(`  Created: ${product.name} -> ${colorName} (${baseType})`);
    } catch (err) {
      // Likely a unique constraint violation (race condition)
      // Check if it was created by another process
      const raced = await prisma.productColorVariant.findFirst({
        where: {
          productId: product.id,
          colorName: { equals: colorName, mode: "insensitive" },
          baseType,
        },
        select: { id: true },
      });

      if (raced) {
        // It was created, that's fine
        created++;
      } else {
        errors++;
        console.error(`  ERROR on product ${product.id}: ${err}`);
      }
    }
  }

  console.log(`\nBackfill complete:`);
  console.log(`  Created: ${created}`);
  console.log(`  Skipped (no color): ${skipped}`);
  console.log(`  Errors: ${errors}`);
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
