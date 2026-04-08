import "dotenv/config";
import { prisma } from "../lib/prisma";

const PLASCON_SUPPLIER_ID = "cmmdxdol60009w8plpxqwnxct";

type ActiveRow = {
  id: string;
  productId: string;
  uom: string | null;
  unitSize: string | null;
  price: string;
  createdAt: Date;
  startsOn: Date;
  productName: string;
};

function keyOf(row: ActiveRow) {
  return [
    row.productId,
    row.uom ?? "null",
    row.unitSize ?? "null",
    row.price,
  ].join("::");
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const rows = await prisma.supplierProductPrice.findMany({
    where: {
      supplierId: PLASCON_SUPPLIER_ID,
      isActive: true,
      endsOn: null,
    },
    include: {
      product: { select: { name: true } },
    },
    orderBy: [{ startsOn: "desc" }, { createdAt: "desc" }],
  });

  const mapped: ActiveRow[] = rows.map((row) => ({
    id: row.id,
    productId: row.productId,
    uom: row.uom,
    unitSize: row.unitSize ? String(row.unitSize) : null,
    price: String(row.price),
    createdAt: row.createdAt,
    startsOn: row.startsOn,
    productName: row.product.name,
  }));

  const groups = new Map<string, ActiveRow[]>();
  for (const row of mapped) {
    const key = keyOf(row);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const duplicates = [...groups.values()].filter((group) => group.length > 1);
  const toDeactivate = duplicates.flatMap((group) => group.slice(1));

  console.log(`Supplier: ${PLASCON_SUPPLIER_ID}`);
  console.log(`Mode: ${dryRun ? "DRY-RUN" : "APPLY"}`);
  console.log(`Active rows scanned: ${mapped.length}`);
  console.log(`Duplicate groups: ${duplicates.length}`);
  console.log(`Rows to deactivate: ${toDeactivate.length}`);

  for (const row of toDeactivate) {
    if (dryRun) {
      console.log(
        `[preview] DEACTIVATE ${row.id} :: ${row.productName} :: ${row.uom ?? "-"} ${row.unitSize ?? ""} :: ${row.price}`,
      );
      continue;
    }

    await prisma.supplierProductPrice.update({
      where: { id: row.id },
      data: { isActive: false, endsOn: new Date() },
    });

    console.log(
      `[applied] DEACTIVATED ${row.id} :: ${row.productName} :: ${row.price}`,
    );
  }

  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
