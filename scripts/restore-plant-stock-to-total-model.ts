import "dotenv/config";

import { prisma } from "@/lib/prisma";

/**
 * One-time migration: move plant stockQty to "total owned" model.
 *
 * The earlier backfill script subtracted deployed quantities from stockQty for
 * items that had stock set.  This script undoes that and sets every plant item
 * so that stockQty represents the COMPANY TOTAL (deployed + at office).
 *
 * Formula used per item:
 *   • new = max(current + deployed, deployed)
 *
 * Why this works:
 *   – Items never set (current=0):  0 + deployed = deployed  → minimum baseline ✓
 *   – Items with stock, none deployed (deployed=0): current + 0 = current  (unchanged) ✓
 *   – Items reduced by the backfill (current = original_at_office − deployed):
 *       current + deployed = original_at_office  → undoes the backfill deduction ✓
 *   – Items over-deducted to negatives: max(negative+deployed, deployed) = deployed ✓
 *
 * After this runs, tell the user: for items that previously had stock set,
 * the "Total Owned" now shows what was at the office before — they should add
 * whatever deployed units they want counted as owned.  The table shows
 * Total | Deployed | At Office so they can see at a glance what needs updating.
 */

const DRY_RUN = process.env.DRY_RUN === "true";

async function main() {
  console.log(`=== Restore plant stock to total-owned model (DRY_RUN=${DRY_RUN}) ===\n`);

  const plantProducts = await prisma.procurementProduct.findMany({
    where: { productType: "PLANT" },
    select: { id: true, name: true, stockQty: true },
  });

  const deployedSums = await prisma.sitePlantAssignment.groupBy({
    by: ["productId"],
    where: { status: { in: ["DEPLOYED", "REPAIR"] } },
    _sum: { quantity: true },
  });
  const deployedMap = new Map(
    deployedSums.map((d) => [d.productId, d._sum.quantity ?? 0]),
  );

  let updated = 0;
  let unchanged = 0;

  for (const product of plantProducts) {
    const current = product.stockQty;
    const deployed = deployedMap.get(product.id) ?? 0;

    // new = max(current + deployed, deployed)
    const proposed = Math.max(current + deployed, deployed);

    if (proposed === current) {
      console.log(`  OK   "${product.name}" — ${current} (total: ${current}, deployed: ${deployed}, at office: ${current - deployed})`);
      unchanged++;
      continue;
    }

    const atOffice = proposed - deployed;
    console.log(
      `  SET  "${product.name}" — ${current} → ${proposed}  (deployed: ${deployed}, at office: ${atOffice})`
    );

    if (!DRY_RUN) {
      await prisma.procurementProduct.update({
        where: { id: product.id },
        data: { stockQty: proposed },
      });
    }
    updated++;
  }

  console.log(`\nUpdated: ${updated}, Unchanged: ${unchanged}`);
  if (DRY_RUN) {
    console.log("DRY RUN — no changes written. Remove DRY_RUN=true to apply.");
  } else {
    console.log("\nDone. stockQty now represents total company owned.");
    console.log("Items that previously had stock set show their at-office value as total.");
    console.log("You may want to review those items and add the deployed count to 'Total Owned'.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
