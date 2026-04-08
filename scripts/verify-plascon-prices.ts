import "dotenv/config";
import { prisma } from "../lib/prisma";

const DEFAULT_PLASCON_SUPPLIER_ID = "cmmdxdol60009w8plpxqwnxct";

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
  const supplierId = process.argv[2]?.trim() || DEFAULT_PLASCON_SUPPLIER_ID;
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, isActive: true },
  });

  if (!supplier) {
    console.log(`PLASCON supplier not found for id: ${supplierId}`);
    return;
  }

  console.log(`Supplier: ${supplier.name} (${supplier.id})`);
  await dumpGroup(supplier.id, "Velvaglo", "Velvaglo");
  await dumpGroup(supplier.id, "Cashmere", "Cashmere");
  await dumpGroup(supplier.id, "Wall&All", "Wall&All");
  await dumpGroup(supplier.id, "Nuroof", "Nuroof");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
