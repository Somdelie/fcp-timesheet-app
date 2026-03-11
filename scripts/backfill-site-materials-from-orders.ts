import "dotenv/config";

import { prisma } from "@/lib/prisma";

/**
 * Backfill SiteMaterial rows from existing SiteProductOrder items.
 *
 * For every (siteId, productId) pair found across SiteProductOrderItem → SiteProductOrder,
 * creates a SiteMaterial if one doesn't already exist.
 *
 * Safe to run multiple times — uses skipDuplicates and checks existing rows.
 */
async function main() {
  console.log("=== Backfill SiteMaterial from existing orders ===\n");

  // Get all distinct (siteId, productId) pairs from order items
  const orderItems = await prisma.siteProductOrderItem.findMany({
    select: {
      productId: true,
      order: { select: { siteId: true } },
    },
  });

  // Build unique pairs
  const pairSet = new Set<string>();
  const pairs: { siteId: string; productId: string }[] = [];

  for (const item of orderItems) {
    const key = `${item.order.siteId}::${item.productId}`;
    if (!pairSet.has(key)) {
      pairSet.add(key);
      pairs.push({ siteId: item.order.siteId, productId: item.productId });
    }
  }

  console.log(`Found ${pairs.length} unique (site, product) pairs from orders`);

  if (pairs.length === 0) {
    console.log("Nothing to backfill.");
    return;
  }

  // Check which ones already exist
  const existing = await prisma.siteMaterial.findMany({
    select: { siteId: true, productId: true },
  });
  const existingSet = new Set(
    existing.map((e) => `${e.siteId}::${e.productId}`),
  );

  const toCreate = pairs.filter(
    (p) => !existingSet.has(`${p.siteId}::${p.productId}`),
  );

  console.log(`Already exist: ${pairs.length - toCreate.length}`);
  console.log(`To create: ${toCreate.length}`);

  if (toCreate.length === 0) {
    console.log("\nAll materials already seeded. Nothing to do.");
    return;
  }

  const result = await prisma.siteMaterial.createMany({
    data: toCreate.map((p) => ({
      siteId: p.siteId,
      productId: p.productId,
    })),
    skipDuplicates: true,
  });

  console.log(`\nCreated ${result.count} SiteMaterial rows.`);
  console.log("=== Done ===");
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
