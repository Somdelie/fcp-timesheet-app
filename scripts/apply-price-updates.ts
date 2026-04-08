import fs from "fs";
import path from "path";
import "dotenv/config";
import { prisma } from "../lib/prisma";

type Proposal = {
  rowIndex: number;
  supplierLabel: string;
  supplierId: string;
  csvProductName: string;
  parsedPrice: number | null;
  candidateId: string | null;
  candidateName: string | null;
  confidence: number;
  note?: string;
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const threshold = Number(process.env.CONFIDENCE_THRESHOLD ?? 0.65);

  const proposalsPath = path.join(
    process.cwd(),
    "scripts",
    "price-match-proposals.json",
  );
  if (!fs.existsSync(proposalsPath)) {
    console.error("Proposals file not found:", proposalsPath);
    process.exit(1);
  }

  const proposals: Proposal[] = JSON.parse(
    fs.readFileSync(proposalsPath, "utf8"),
  );

  const filtered = proposals.filter(
    (p) =>
      p.confidence >= threshold &&
      p.candidateId &&
      p.supplierId &&
      p.parsedPrice !== null,
  );

  console.log(`\n=== Price Update ${dryRun ? "DRY-RUN" : "APPLY"} ===`);
  console.log(
    `Total proposals: ${proposals.length}, Filtered (confidence >= ${threshold}): ${filtered.length}\n`,
  );

  const applied: Array<{
    supplier: string;
    productName: string;
    price: number;
    action: "created" | "updated";
  }> = [];
  const skipped: Array<{ reason: string; proposal: Proposal }> = [];

  for (const p of filtered) {
    try {
      // Type guards: filter already checked these, but TypeScript needs explicit guards
      if (!p.candidateId || !p.supplierId || p.parsedPrice === null) {
        skipped.push({
          reason: "Failed null check (should not happen after filter)",
          proposal: p,
        });
        continue;
      }

      // Check if price already exists
      const existing = await prisma.supplierProductPrice.findFirst({
        where: {
          supplierId: p.supplierId,
          productId: p.candidateId,
          isActive: true,
        },
        orderBy: { createdAt: "desc" },
      });

      if (dryRun) {
        const action = existing ? "would update" : "would create";
        console.log(
          `${action}: ${p.supplierLabel} / ${p.candidateName} @ ${p.parsedPrice}`,
        );
        if (existing) {
          console.log(`  (existing price: ${existing.price})`);
        }
      } else {
        if (existing) {
          // Update existing price
          await prisma.supplierProductPrice.update({
            where: { id: existing.id },
            data: { price: p.parsedPrice.toString() },
          });
          applied.push({
            supplier: p.supplierLabel,
            productName: p.candidateName || p.csvProductName,
            price: p.parsedPrice,
            action: "updated",
          });
          console.log(`✓ Updated: ${p.supplierLabel} / ${p.candidateName}`);
        } else {
          // Create new price entry
          await prisma.supplierProductPrice.create({
            data: {
              supplierId: p.supplierId,
              productId: p.candidateId,
              price: p.parsedPrice.toString(),
              isActive: true,
            },
          });
          applied.push({
            supplier: p.supplierLabel,
            productName: p.candidateName || p.csvProductName,
            price: p.parsedPrice,
            action: "created",
          });
          console.log(`✓ Created: ${p.supplierLabel} / ${p.candidateName}`);
        }
      }
    } catch (err) {
      skipped.push({
        reason: String(err),
        proposal: p,
      });
      console.error(`✗ Error: ${p.supplierLabel} / ${p.candidateName}: ${err}`);
    }
  }

  console.log(`\n=== Summary ===`);
  if (dryRun) {
    console.log(`Would apply ${filtered.length} price updates`);
    console.log(`Skipped: ${skipped.length}`);
  } else {
    console.log(`Applied: ${applied.length}`);
    const created = applied.filter((a) => a.action === "created").length;
    const updated = applied.filter((a) => a.action === "updated").length;
    console.log(`  - Created: ${created}`);
    console.log(`  - Updated: ${updated}`);
    console.log(`Skipped/Errors: ${skipped.length}`);

    // Write summary
    const summaryPath = path.join(
      process.cwd(),
      "scripts",
      "price-update-summary.json",
    );
    fs.writeFileSync(
      summaryPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          threshold,
          applied,
          skipped,
          totals: {
            proposed: proposals.length,
            filtered,
            created,
            updated,
            errors: skipped.length,
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    console.log(`\nSummary written to ${summaryPath}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
