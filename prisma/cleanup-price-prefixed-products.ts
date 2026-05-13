/**
 * One-time cleanup: strip the price prefix that the BuildSmart seeder accidentally
 * embedded into product names (e.g. "1,119.48 UNIVERSAL UNDERCOAT" → "UNIVERSAL UNDERCOAT").
 *
 * Run modes
 *   npx ts-node prisma/cleanup-price-prefixed-products.ts           ← dry run (default)
 *   npx ts-node prisma/cleanup-price-prefixed-products.ts --apply   ← write to DB
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// Matches names like "1,119.48 UNIVERSAL UNDERCOAT" or ". 1,119.48 UNIVERSAL UNDERCOAT"
const PRICE_PREFIX_RE = /^[.\s]*\d{1,3}(?:,\d{3})*\.\d{2}\s+/;

function stripPricePrefix(name: string): string {
  return name.replace(PRICE_PREFIX_RE, "").trim();
}

async function main() {
  const apply = process.argv.includes("--apply");
  if (!apply) console.log("DRY RUN — pass --apply to write changes\n");

  // ── 1. Load all products ──────────────────────────────────────────────────
  const allProducts = await prisma.procurementProduct.findMany({
    select: { id: true, name: true, sku: true },
  });

  const dirty = allProducts.filter((p) => PRICE_PREFIX_RE.test(p.name));
  console.log(`Found ${dirty.length} price-prefixed product names\n`);
  if (dirty.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  // ── 2. Group dirty products by their clean name ───────────────────────────
  // Key = lowercase clean name so "UNIVERSAL UNDERCOAT" and "Universal Undercoat" collapse.
  type ProductRow = { id: string; name: string; sku: string | null };
  const groups = new Map<string, ProductRow[]>();

  for (const p of dirty) {
    const key = stripPricePrefix(p.name).toLowerCase();
    const arr = groups.get(key) ?? [];
    arr.push(p);
    groups.set(key, arr);
  }

  let renames = 0;
  let merges = 0;

  for (const [lowerClean, candidates] of groups) {
    const cleanName = stripPricePrefix(candidates[0].name); // preserve original casing

    // Is there already a product with this clean name (no price prefix)?
    const existingClean = allProducts.find(
      (p) => !PRICE_PREFIX_RE.test(p.name) && p.name.toLowerCase() === lowerClean,
    );

    let masterId: string;

    if (existingClean) {
      // Merge everything into the already-clean product
      masterId = existingClean.id;
      console.log(`MERGE into existing "${existingClean.name}" (${existingClean.id})`);
      for (const c of candidates) {
        console.log(`  ✗ delete "${c.name}"`);
        if (apply) await reassignAndDelete(c.id, masterId);
        merges++;
      }
    } else if (candidates.length === 1) {
      // Only one dirty copy — just rename it
      masterId = candidates[0].id;
      console.log(`RENAME "${candidates[0].name}" → "${cleanName}"`);
      if (apply) {
        await prisma.procurementProduct.update({
          where: { id: masterId },
          data: { name: cleanName },
        });
      }
      renames++;
    } else {
      // Multiple dirty copies for the same base name — pick the one with the
      // most order items as the master, rename it, and merge the rest in.
      const withCounts = await Promise.all(
        candidates.map(async (p) => ({
          ...p,
          count: await prisma.siteProductOrderItem.count({
            where: { productId: p.id },
          }),
        })),
      );
      withCounts.sort((a, b) => b.count - a.count);
      const master = withCounts[0];
      masterId = master.id;

      console.log(
        `RENAME+MERGE → "${cleanName}" (master: "${master.name}", ${master.count} items)`,
      );
      if (apply) {
        await prisma.procurementProduct.update({
          where: { id: masterId },
          data: { name: cleanName },
        });
      }
      renames++;

      for (const other of withCounts.slice(1)) {
        console.log(`  ✗ merge "${other.name}" (${other.count} items) → master`);
        if (apply) await reassignAndDelete(other.id, masterId);
        merges++;
      }
    }
  }

  console.log(
    `\n${apply ? "Done" : "Would do"}: ${renames} renames, ${merges} merges`,
  );
}

/**
 * Move all FK references from `fromId` to `toId`, then delete the product.
 * Handles every model that has `onDelete: Restrict` on procurementProduct.
 * Models with `onDelete: Cascade` (SiteMaterial, SupplierProductPrice, etc.)
 * are cleaned up automatically when the product is deleted.
 */
async function reassignAndDelete(fromId: string, toId: string) {
  // Restrict models — must reassign before delete
  await prisma.siteProductOrderItem.updateMany({
    where: { productId: fromId },
    data: { productId: toId },
  });
  await prisma.sitePaintPlan.updateMany({
    where: { productId: fromId },
    data: { productId: toId },
  });
  await prisma.sitePlantAssignment.updateMany({
    where: { productId: fromId },
    data: { productId: toId },
  });
  await prisma.plantTransfer.updateMany({
    where: { productId: fromId },
    data: { productId: toId },
  });
  await prisma.foremanPpeOrderItem.updateMany({
    where: { productId: fromId },
    data: { productId: toId },
  });

  // Delete — Cascade/SetNull children are handled automatically by the DB
  await prisma.procurementProduct.delete({ where: { id: fromId } });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
