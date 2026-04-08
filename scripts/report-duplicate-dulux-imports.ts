import "dotenv/config";
import { prisma } from "../lib/prisma";
import { resolveDuluxBaseProduct } from "../src/lib/procurement/resolveDuluxBaseProduct";
import { resolvePlasconBaseProduct } from "../src/lib/procurement/resolvePlasconBaseProduct";

async function main() {
  const dulux = await prisma.supplier.findFirst({
    where: { name: "Dulux" },
    select: { id: true, name: true },
  });

  if (!dulux) {
    throw new Error("Dulux supplier not found");
  }

  const products = await prisma.procurementProduct.findMany({
    where: { supplierId: dulux.id },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  console.log("=== Dulux duplicate-like imports report ===");

  for (const p of products) {
    const resolved = resolveDuluxBaseProduct(p.name);

    if (resolved.matchedProductName && p.name !== resolved.matchedProductName) {
      console.log(`${p.name} -> should map to: ${resolved.matchedProductName}`);
    }
  }

  // Plascon
  const plascon = await prisma.supplier.findFirst({
    where: { name: "Plascon" },
    select: { id: true, name: true },
  });

  if (plascon) {
    const plasconProducts = await prisma.procurementProduct.findMany({
      where: { supplierId: plascon.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    console.log("=== Plascon duplicate-like imports report ===");
    for (const p of plasconProducts) {
      const resolved = resolvePlasconBaseProduct(p.name);
      if (
        resolved.matchedProductName &&
        p.name !== resolved.matchedProductName
      ) {
        console.log(
          `${p.name} -> should map to: ${resolved.matchedProductName}`,
        );
      }
    }
  } else {
    console.log("Plascon supplier not found — skipping Plascon report");
  }
  console.log("=== Done ===");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
