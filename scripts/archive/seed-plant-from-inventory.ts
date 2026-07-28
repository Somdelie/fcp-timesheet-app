/**
 * One-time seed: migrate EquipmentInventory → Plant Assignments + Plant List.
 *
 * Rules:
 *  - Office holder  → ProcurementProduct (PLANT) with stockQty updated
 *  - Other holders  → ProcurementProduct (PLANT) + SitePlantAssignment on
 *                     the supervisor's most-recent active site
 *
 * Condition → PlantStatus mapping:
 *  Good           → DEPLOYED
 *  Needs Service  → DEPLOYED  (note appended)
 *  Beyond Repair  → DAMAGED
 *  Stolen         → LOST
 *
 * Run ONCE:  npx tsx prisma/seed-plant-from-inventory.ts
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL not set");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

function conditionToStatus(condition: string): "DEPLOYED" | "DAMAGED" | "LOST" | "AVAILABLE" {
  switch (condition) {
    case "Beyond Repair": return "DAMAGED";
    case "Stolen":        return "LOST";
    default:              return "DEPLOYED"; // Good + Needs Service
  }
}

async function main() {
  console.log("🌱 Seeding Plant Assignments from Equipment Inventory…\n");

  // ── 1. Load all inventory items with holders ──────────────────────────────
  const inventoryItems = await prisma.equipmentItem.findMany({
    include: { holder: true },
  });

  if (inventoryItems.length === 0) {
    console.log("⚠️  No EquipmentItems found — run seed-equipment-inventory.ts first.");
    return;
  }

  // ── 2. Build a map: holder name → supervisor's current primary site ───────
  const supervisors = await prisma.supervisor.findMany({
    include: {
      user: true,
      // fetch ALL site assignments, active first, then most recent
      siteAssignments: {
        include: { site: true },
        orderBy: [{ endsOn: "desc" }, { startsOn: "desc" }],
      },
    },
  });

  console.log("👥 Supervisors found in DB:");
  for (const sup of supervisors) {
    const site = sup.siteAssignments[0]?.site?.name ?? "(no site)";
    console.log(`   ${sup.user.name} → ${site}`);
  }
  console.log();

  const holderSiteMap = new Map<string, string>(); // first name (lower) → siteId
  const holderSiteNameMap = new Map<string, string>();

  for (const sup of supervisors) {
    const fullName = (sup.user.name ?? "").trim();
    const firstName = fullName.split(/\s+/)[0].toLowerCase();
    const bestSite = sup.siteAssignments[0]?.site;
    if (firstName && bestSite) {
      holderSiteMap.set(firstName, bestSite.id);
      holderSiteNameMap.set(firstName, bestSite.name);
      // also map full name in case holder uses full name
      holderSiteMap.set(fullName.toLowerCase(), bestSite.id);
      holderSiteNameMap.set(fullName.toLowerCase(), bestSite.name);
    }
  }

  // Known spelling variants: inventory name → DB first name
  const aliases: Record<string, string> = {
    "geoffrey": "geofrey",
    "nicolas":  "nicholas",
    "temba":    "themba",
  };
  for (const [alias, canonical] of Object.entries(aliases)) {
    const siteId = holderSiteMap.get(canonical);
    if (siteId) {
      holderSiteMap.set(alias, siteId);
      holderSiteNameMap.set(alias, holderSiteNameMap.get(canonical)!);
    }
  }

  console.log("🗺  Holder → Site mapping:");
  for (const [k, v] of holderSiteMap) {
    console.log(`   "${k}" → ${holderSiteNameMap.get(k)}`);
  }
  console.log();

  // ── 3. Ensure all unique equipment names exist as PLANT products ──────────
  const uniqueItems = [...new Set(inventoryItems.map((i) => i.item.trim()))];
  const productMap = new Map<string, string>(); // item name → productId

  for (const name of uniqueItems) {
    let product = await prisma.procurementProduct.findFirst({
      where: { name: { equals: name, mode: "insensitive" }, productType: "PLANT" },
    });
    if (!product) {
      product = await prisma.procurementProduct.create({
        data: { name, productType: "PLANT", isReturnable: true },
      });
      console.log(`  ✚ Created product: ${name}`);
    }
    productMap.set(name, product.id);
  }

  console.log(`\n✅ ${productMap.size} PLANT products ready\n`);

  // ── 4. Process each item ──────────────────────────────────────────────────
  let deployed = 0;
  let officeStock = 0;
  let skipped = 0;

  for (const item of inventoryItems) {
    const holderName = item.holder?.name ?? "Office";
    const productId = productMap.get(item.item.trim())!;
    const note = [
      item.condition !== "Good" ? item.condition : null,
      item.location,
      item.notes,
    ].filter(Boolean).join(" · ") || null;

    // ── Office → update stockQty ──────────────────────────────────────────
    if (holderName === "Office") {
      await prisma.procurementProduct.update({
        where: { id: productId },
        data: { stockQty: { increment: item.quantity } },
      });
      officeStock += item.quantity;
      console.log(`  🏢 Office stock +${item.quantity} ${item.item}`);
      continue;
    }

    // ── Supervisor → find site (try full name then first name) ───────────
    const holderLower = holderName.toLowerCase().trim();
    const holderFirst = holderLower.split(/\s+/)[0];
    const siteId = holderSiteMap.get(holderLower) ?? holderSiteMap.get(holderFirst);
    if (!siteId) {
      console.warn(`  ⚠️  No active site for "${holderName}" — skipping ${item.item} (qty ${item.quantity})`);
      skipped++;
      continue;
    }

    const status = conditionToStatus(item.condition);

    await prisma.sitePlantAssignment.create({
      data: {
        siteId,
        productId,
        quantity: item.quantity,
        status,
        note,
        deployedOn: new Date(),
      },
    });

    deployed++;
    console.log(`  🚀 ${holderName} (${holderSiteNameMap.get(holderName.toLowerCase())}) ← ${item.quantity}× ${item.item} [${status}]`);
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅  Deployed assignments : ${deployed}
🏢  Office stock items   : ${officeStock} (qty added to stockQty)
⚠️  Skipped (no site)   : ${skipped}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
