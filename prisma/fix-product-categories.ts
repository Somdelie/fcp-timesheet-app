import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL not set");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// True PPE — worn on the body for personal protection
const PPE_NAMES = new Set([
  "beanie",
  "floppy hat",
  "gloves",
  "hard hat",
  "overall half",
  "overalls full",
  "safety boots full",
  "safety boots half",
  "safety goggles",
  "safety vests",
]);

// Everything else in the original seed is a painting tool or equipment

async function fixCategories() {
  const all = await prisma.product.findMany({ select: { id: true, name: true, normalizedName: true, category: true } });

  let toTool = 0;
  let toPpe = 0;
  let skipped = 0;

  for (const p of all) {
    const key = (p.normalizedName ?? p.name).toLowerCase().trim();
    const correctCategory = PPE_NAMES.has(key) ? "PPE" : "TOOL";

    if (p.category === correctCategory) {
      skipped++;
      continue;
    }

    await prisma.product.update({ where: { id: p.id }, data: { category: correctCategory } });
    if (correctCategory === "TOOL") toTool++;
    else toPpe++;
    console.log(`  ${p.name} → ${correctCategory}`);
  }

  console.log(`\nDone — set to TOOL: ${toTool}, set to PPE: ${toPpe}, already correct: ${skipped}`);
}

fixCategories()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
