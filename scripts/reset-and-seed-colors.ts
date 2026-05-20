/*
 * reset-and-seed-colors.ts
 *
 * Safely remove all ProductColorVariant rows and re-seed them by parsing
 * procurement product names. Requires `--force` to actually run.
 *
 * Usage:
 *   npx tsx scripts/reset-and-seed-colors.ts --force
 */

import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { parseBuildSmartProduct } from "@/lib/product-color-parser";

async function main() {
  const force = process.argv.includes("--force");
  if (!force) {
    console.log(
      "This will DELETE all ProductColorVariant rows and re-seed them.",
    );
    console.log("To proceed, run with --force:");
    console.log("  npx tsx scripts/reset-and-seed-colors.ts --force");
    process.exit(1);
  }

  console.log("Reset: deleting all ProductColorVariant rows...");
  const del = await prisma.productColorVariant.deleteMany({});
  console.log(`Deleted ${del.count} variants.`);

  console.log("Seeding variants from procurement products...");
  const products = await prisma.procurementProduct.findMany({
    select: { id: true, name: true, sku: true },
  });

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const product of products) {
    try {
      const parsed = parseBuildSmartProduct(product.name);
      const { colorName, baseType, isTinted } = parsed as any;

      if (!colorName) {
        skipped++;
        continue;
      }

      await prisma.productColorVariant.create({
        data: {
          productId: product.id,
          colorName,
          baseType,
          isTinted,
        },
      });

      created++;
    } catch (err) {
      errors++;
      console.error(`Error seeding product ${product.id}:`, err);
    }
  }

  console.log(
    `\nProduct seeding complete: created=${created} skipped=${skipped} errors=${errors}`,
  );

  // Also extract colors from seeded order items
  console.log("\nExtracting colors from seeded order items...");
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

  let orderCreated = 0;
  let orderSkipped = 0;
  let orderErrors = 0;

  for (const item of orderItems) {
    const rawDesc = item.note ?? item.product?.name ?? "";
    if (!rawDesc) continue;

    try {
      const parsed = parseBuildSmartProduct(rawDesc);
      const { colorName, baseType, isTinted } = parsed as any;

      if (!colorName) {
        orderSkipped++;
        continue;
      }

      // Check if already exists
      const existing = await prisma.productColorVariant.findFirst({
        where: {
          productId: item.product?.id,
          colorName: { equals: colorName, mode: "insensitive" },
          baseType,
        },
        select: { id: true },
      });

      if (existing) {
        orderSkipped++;
        continue;
      }

      await prisma.productColorVariant.create({
        data: {
          productId: item.product!.id,
          colorName,
          baseType,
          isTinted,
        },
      });

      orderCreated++;
    } catch (err) {
      // Check for race condition
      try {
        const parsed = parseBuildSmartProduct(rawDesc);
        const { colorName, baseType } = parsed as any;

        if (colorName) {
          const raced = await prisma.productColorVariant.findFirst({
            where: {
              productId: item.product?.id,
              colorName: { equals: colorName, mode: "insensitive" },
              baseType,
            },
            select: { id: true },
          });

          if (raced) {
            orderCreated++;
          } else {
            orderErrors++;
          }
        }
      } catch {
        orderErrors++;
      }
    }
  }

  console.log(
    `Order extraction complete: created=${orderCreated} skipped=${orderSkipped} errors=${orderErrors}`,
  );
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
