/*
 * extract-colors-from-orders.ts
 *
 * Extract colors from seeded BuildSmart order items and create ProductColorVariant
 * records for any colors found that don't already exist in the database.
 *
 * Usage:
 *   npx tsx scripts/extract-colors-from-orders.ts
 */

import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { parseBuildSmartProduct } from "@/lib/product-color-parser";

async function main() {
  console.log("Extract: scanning seeded orders for colors...");

  const orderItems = await prisma.siteProductOrderItem.findMany({
    select: {
      id: true,
      note: true,
      product: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  console.log(`Found ${orderItems.length} order items to scan for colors`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const item of orderItems) {
    const rawDesc = item.note ?? item.product?.name ?? "";
    if (!rawDesc) continue;

    try {
      const parsed = parseBuildSmartProduct(rawDesc);
      const { colorName, baseType, isTinted } = parsed as any;

      // Skip if no color was detected
      if (!colorName) {
        skipped++;
        continue;
      }

      // Check if this color variant already exists for this product
      const existing = await prisma.productColorVariant.findFirst({
        where: {
          productId: item.product?.id,
          colorName: { equals: colorName, mode: "insensitive" },
          baseType,
        },
        select: { id: true },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Create the color variant
      await prisma.productColorVariant.create({
        data: {
          productId: item.product!.id,
          colorName,
          baseType,
          isTinted,
        },
      });

      created++;
      console.log(
        `  Created: ${item.product?.name} -> ${colorName} (${baseType})`,
      );
    } catch (err) {
      // Likely a unique constraint violation (race condition)
      // Check if it was created by another process
      try {
        const parsed = parseBuildSmartProduct(rawDesc);
        const { colorName, baseType } = parsed as any;

        if (!colorName) {
          errors++;
          continue;
        }

        const raced = await prisma.productColorVariant.findFirst({
          where: {
            productId: item.product?.id,
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
          console.error(
            `  ERROR on item ${item.id} (product ${item.product?.id}):`,
            err,
          );
        }
      } catch (innerErr) {
        errors++;
        console.error(
          `  ERROR on item ${item.id} (product ${item.product?.id}):`,
          innerErr,
        );
      }
    }
  }

  console.log(`\nExtraction complete:`);
  console.log(`  Created: ${created}`);
  console.log(`  Skipped (already exist or no color): ${skipped}`);
  console.log(`  Errors: ${errors}`);
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
