import { PrismaClient } from "../generated/prisma/client/index.js";
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.historicalSiteCost.count({
    where: { siteId: "cmmf809u3001kv4pl0tzbxxcd" },
  });
  console.log("Records found:", count);
  const del = await prisma.historicalSiteCost.deleteMany({
    where: { siteId: "cmmf809u3001kv4pl0tzbxxcd" },
  });
  console.log("Deleted:", del.count);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
