import { prisma } from "../lib/prisma";

async function main() {
  console.log("Adding 'EACH' to ProductUom enum in database...");
  await prisma.$executeRawUnsafe(`ALTER TYPE "ProductUom" ADD VALUE 'EACH'`);
  console.log("Done.");
}

main()
  .catch((err) => {
    console.error("Failed to add EACH to ProductUom enum:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
