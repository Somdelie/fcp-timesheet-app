import fs from "fs/promises";
import path from "path";
import { prisma } from "../lib/prisma";

const seedFiles = [
  "plascon-materials-seed.json",
  "marmoran-materials-seed.json",
  "cemcrete-materials-seed.json",
  "dulux-materials-seed.json",
];

async function loadSeedEntries() {
  const names = new Set<string>();
  const brands = new Set<string>();

  for (const fileName of seedFiles) {
    const filePath = path.resolve(process.cwd(), fileName);
    const raw = await fs.readFile(filePath, "utf8");
    const entries = JSON.parse(raw) as Array<{ name: string; brand?: string }>;

    for (const entry of entries) {
      const name = (entry.name || "").trim();
      if (!name) continue;
      names.add(name);
      const brand = (entry.brand || "").trim() || "Plascon";
      brands.add(brand);
    }
  }

  return { names: Array.from(names), brands: Array.from(brands) };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const { names, brands } = await loadSeedEntries();

  console.log("Loaded seed data for cleanup:");
  console.log(`  material names: ${names.length}`);
  console.log(`  supplier brands: ${brands.join(", ")}`);

  if (dryRun) {
    console.log("Dry run enabled. No records will be deleted.");
    console.log(
      `Would delete materials matching ${names.length} names for brands: ${brands.join(", ")}`,
    );
    return;
  }

  const deleted = await prisma.material.deleteMany({
    where: {
      name: { in: names },
      supplier: { name: { in: brands } },
    },
  });

  console.log(`Deleted ${deleted.count} material records from seeded brands.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
