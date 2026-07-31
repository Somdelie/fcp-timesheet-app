import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const prices = await prisma.overtimePrice.findMany({
    orderBy: { rate: "asc" },
  });

  console.table(
    prices.map((p) => ({
      id: p.id,
      label: p.label,
      rate: Number(p.rate),
    })),
  );
}

main().finally(() => prisma.$disconnect());
