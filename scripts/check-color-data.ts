import "dotenv/config";
import { prisma } from "@/lib/prisma";

async function main() {
  const products = await prisma.procurementProduct.findMany({
    where: {
      OR: [
        { name: { contains: "pastel", mode: "insensitive" } },
        { name: { contains: "offshore", mode: "insensitive" } },
        { name: { contains: "white", mode: "insensitive" } },
        { name: { contains: "deep", mode: "insensitive" } },
        { name: { contains: "tint", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, sku: true },
    take: 30,
  });

  console.log("Sample products with color info:");
  products.forEach((p) => {
    console.log(`  ${p.name} (SKU: ${p.sku})`);
  });

  const variants = await prisma.productColorVariant.findMany({
    select: { id: true, colorName: true, baseType: true, isTinted: true },
    take: 20,
  });

  console.log("\n\nExisting ProductColorVariant records:");
  variants.forEach((v) => {
    console.log(`  ${v.colorName} (${v.baseType}, tinted=${v.isTinted})`);
  });
}

main()
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
