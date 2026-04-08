import "dotenv/config";
import { prisma } from "../lib/prisma";

const DEFAULT_PROMINENT_SUPPLIER_ID = "cmnog4opm0000ocpvu6yt79mp";

async function dumpRows(supplierId: string, label: string, contains?: string) {
  const rows = await prisma.supplierProductPrice.findMany({
    where: {
      supplierId,
      isActive: true,
      endsOn: null,
      ...(contains
        ? { product: { name: { contains, mode: "insensitive" as const } } }
        : {}),
    },
    include: { product: { select: { name: true } } },
    orderBy: [
      { product: { name: "asc" } },
      { uom: "asc" },
      { unitSize: "asc" },
    ],
  });

  console.log(`\n${label}`);
  console.log(
    JSON.stringify(
      rows.map((row) => ({
        product: row.product.name,
        uom: row.uom,
        unitSize: row.unitSize ? String(row.unitSize) : null,
        price: String(row.price),
      })),
      null,
      2,
    ),
  );
}

async function main() {
  const supplierId = process.argv[2]?.trim() || DEFAULT_PROMINENT_SUPPLIER_ID;

  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, isActive: true },
  });

  if (!supplier) {
    console.log(`PROMINENT supplier not found for id: ${supplierId}`);
    return;
  }

  console.log(`Supplier: ${supplier.name} (${supplier.id})`);
  await dumpRows(supplier.id, "All active Prominent prices");
  await dumpRows(supplier.id, "Select family", "Select");
  await dumpRows(supplier.id, "Enamel family", "Enamel");
  await dumpRows(supplier.id, "Polyurethane family", "Polyurethane");
  await dumpRows(supplier.id, "Wood family", "Wood");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
