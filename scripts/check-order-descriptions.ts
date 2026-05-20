import "dotenv/config";
import { prisma } from "@/lib/prisma";

async function main() {
  // Check SiteProductOrderItem to see the original descriptions
  const items = await prisma.siteProductOrderItem.findMany({
    select: {
      product: {
        select: {
          description: true,
        },
      },
    },
    where: { product: { description: { not: null } } },
    take: 50,
  });

  console.log("Sample product descriptions from order products:");
  items.forEach((item) => {
    console.log(`  "${item.product.description ?? ""}"`);
  });
}

main()
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
