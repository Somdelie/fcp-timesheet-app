import "dotenv/config";
import { prisma } from "../lib/prisma";

const PLASCON_SUPPLIER_ID = "cmmdxdol60009w8plpxqwnxct";

const EXACT_GENERIC_NAMES = new Set([
  "Cashmere",
  "Double Velvet",
  "Micatex",
  "Nuroof Cool Acrylic Roof Paint",
  "Superior Low Sheen",
  "Wall & All",
  "Velvaglo Non-Drip Water-based Enamel",
  "Velvaglo Satin",
  "Plascoprime 207",
  "Plascoprime Self Etch Primer",
  "Plascosafe 18 Primer",
  "Plascosafe 500",
  "Plascosafe Water-based Floor Coating",
  "Plascosafe Water-based Multicoat",
  "Tradepro Bright Matt",
  "Tradepro Brilliant Sheen",
  "Tradepro Gloss Enamel",
  "Tradepro High Hiding Matt",
  "Tradepro Solvent-Based Primer",
  "Tradepro Textured",
  "Tradepro Undercoat",
  "Tradepro Water-Based Primer",
]);

function isGenericDuplicate(name: string) {
  const trimmed = name.trim();
  return EXACT_GENERIC_NAMES.has(trimmed);
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
    orderBy: [{ createdAt: "asc" }],
  });

  const candidates = rows.filter((row) => isGenericDuplicate(row.product.name));

  console.log(`Supplier: ${PLASCON_SUPPLIER_ID}`);
  console.log(`Mode: ${dryRun ? "DRY-RUN" : "APPLY"}`);
  console.log(`Found active rows: ${rows.length}`);
  console.log(`Generic duplicate rows to deactivate: ${candidates.length}`);

  for (const row of candidates) {
    if (dryRun) {
      console.log(
        `[preview] DEACTIVATE ${row.id} :: ${row.product.name} :: ${String(row.price)} :: ${row.uom ?? "-"}${row.unitSize ? ` ${String(row.unitSize)}` : ""}`,
      );
      continue;
    }

    await prisma.supplierProductPrice.update({
      where: { id: row.id },
      data: { isActive: false, endsOn: new Date() },
    });

    console.log(
      `[applied] DEACTIVATED ${row.id} :: ${row.product.name} :: ${String(row.price)}`,
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
