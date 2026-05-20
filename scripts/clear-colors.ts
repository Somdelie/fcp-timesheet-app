/*
 * clear-colors.ts
 *
 * Wipes every ProductColorVariant row and removes the shared
 * "Paint Tint Catalogue" placeholder product (SKU "__TINT_CATALOGUE__")
 * so the next seed-from-pdfs run can rebuild from scratch.
 *
 * Run:
 *   npx tsx scripts/clear-colors.ts
 */

import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { TINT_CATALOGUE_PRODUCT_SKU } from "@/lib/procurement/colorPdfImporter";

async function main() {
  const variantCountBefore = await prisma.productColorVariant.count();
  console.log(`ProductColorVariant rows before: ${variantCountBefore}`);

  const del = await prisma.productColorVariant.deleteMany({});
  console.log(`Deleted ${del.count} ProductColorVariant rows.`);

  const placeholder = await prisma.procurementProduct.findFirst({
    where: { sku: TINT_CATALOGUE_PRODUCT_SKU },
    select: { id: true, name: true },
  });
  if (placeholder) {
    await prisma.procurementProduct.delete({ where: { id: placeholder.id } });
    console.log(
      `Removed placeholder product "${placeholder.name}" (${placeholder.id}).`,
    );
  } else {
    console.log("No Tint Catalogue placeholder product found — nothing to remove.");
  }

  const variantCountAfter = await prisma.productColorVariant.count();
  console.log(`ProductColorVariant rows after: ${variantCountAfter}`);
}

main()
  .catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
