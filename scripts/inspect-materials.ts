import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error("DATABASE_URL environment variable is not set");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const ppCount = await prisma.procurementProduct.count({
    where: { productType: "MATERIAL" },
  });
  const matsCount = await prisma.material.count();
  console.log(`procurementProduct (productType=MATERIAL): ${ppCount}`);
  console.log(`material count: ${matsCount}`);

  const ppSample = await prisma.procurementProduct.findMany({
    where: { productType: "MATERIAL" },
    take: 10,
    select: { id: true, name: true, supplier: { select: { name: true } } },
  });
  const matSample = await prisma.material.findMany({
    take: 10,
    select: { id: true, name: true, supplier: { select: { name: true } } },
  });

  console.log("\nSample procurementProducts:");
  for (const p of ppSample)
    console.log(p.name, "-", p.supplier?.name ?? "(no supplier)");

  console.log("\nSample Materials:");
  for (const m of matSample)
    console.log(m.name, "-", m.supplier?.name ?? "(no supplier)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
