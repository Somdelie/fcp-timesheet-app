import "dotenv/config";
import { prisma } from "../lib/prisma";

const DEFAULT_DULUX_SUPPLIER_ID = "cmmeftzq4000009l2msbxss71";

async function dumpGroup(supplierId: string, label: string, contains: string) {
  const rows = await prisma.supplierProductPrice.findMany({
    where: {
      supplierId,
      isActive: true,
      endsOn: null,
      product: { name: { contains, mode: "insensitive" } },
    },
    include: { product: { select: { name: true } } },
    orderBy: [{ productId: "asc" }, { uom: "asc" }, { unitSize: "asc" }],
  });

  console.log(`\n${label}`);
  console.log(
    JSON.stringify(
      rows.map((r) => ({
        product: r.product.name,
        uom: r.uom,
        unitSize: r.unitSize ? String(r.unitSize) : null,
        price: String(r.price),
      })),
      null,
      2,
    ),
  );
}

async function main() {
  const argSupplierId = process.argv[2]?.trim();
  const supplierId = argSupplierId || DEFAULT_DULUX_SUPPLIER_ID;

  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, isActive: true },
  });

  if (!supplier) {
    console.log(`DULUX supplier not found for id: ${supplierId}`);
    return;
  }

  console.log(`Supplier: ${supplier.name} (${supplier.id})`);
  await dumpGroup(supplier.id, "Trade 65", "Trade 65");
  await dumpGroup(supplier.id, "Trade 100", "Trade 100");
  await dumpGroup(supplier.id, "Wallclad", "Wallclad");
  await dumpGroup(supplier.id, "Sterishield", "Sterishield");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
