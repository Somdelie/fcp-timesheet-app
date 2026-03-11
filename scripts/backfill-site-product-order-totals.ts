import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { recalcOrderTotal } from "@/lib/procurement";

async function main() {
  console.log("Backfilling SiteProductOrder.totalCost from items...");

  const orders = await prisma.siteProductOrder.findMany({
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${orders.length} orders`);

  let processed = 0;
  for (const order of orders) {
    await recalcOrderTotal(order.id);
    processed += 1;
    if (processed % 50 === 0) {
      console.log(`Processed ${processed}/${orders.length} orders...`);
    }
  }

  console.log(`Done. Updated totalCost for ${processed} orders.`);
}

main()
  .catch((err) => {
    console.error("Error while backfilling totals:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
