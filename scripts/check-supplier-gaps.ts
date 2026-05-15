import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const products = await prisma.procurementProduct.count({
    where: {
      supplierId: null,
      orderItems: {
        some: {
          order: { note: { contains: "BuildSmart historical cost report" } },
        },
      },
    },
  });
  const orders = await prisma.siteProductOrder.count({
    where: {
      supplierId: null,
      note: { contains: "BuildSmart historical cost report" },
    },
  });
  console.log("BuildSmart historical products without supplier:", products);
  console.log("BuildSmart historical orders without supplier:", orders);
}

main()
  .finally(() => prisma.$disconnect());
