import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export const procurementCategoriesSeed = [
  { name: "Paints" },
  { name: "Primers" },
  { name: "Undercoats" },
  { name: "Enamels" },
  { name: "Roof Paints" },
  { name: "Waterproofing" },
  { name: "Sealers" },
  { name: "Thinners & Solvents" },
  { name: "Industrial & Protective Coatings" },
  { name: "Fillers & Repair Compounds" },
  { name: "Surface Preparation" },
  { name: "Road Marking Paint" },
];

async function seedCategories() {
  let created = 0;
  let skipped = 0;

  for (const cat of procurementCategoriesSeed) {
    const existing = await prisma.productCategory.findFirst({
      where: { name: cat.name },
    });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.productCategory.create({ data: { name: cat.name } });
    created++;
  }

  console.log(`Categories — created: ${created}, skipped: ${skipped}`);
}

seedCategories()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
