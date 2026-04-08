import "dotenv/config";
import { prisma } from "../lib/prisma";

const DULUX_SUPPLIER_ID = "cmmeftzq4000009l2msbxss71";

const FAMILY_PATTERNS = [
  "Trade 65",
  "Trade 100",
  "Wallclad",
  "Sterishield",
] as const;

function isTargetFamily(name: string) {
  const upper = name.toUpperCase();
  return FAMILY_PATTERNS.some((p) => upper.includes(p.toUpperCase()));
}

function isGenericDuplicate(name: string) {
  const trimmed = name.trim();
  if (trimmed.toUpperCase().startsWith("DULUX ")) return false;

  const upper = trimmed.toUpperCase();
  return (
    upper.startsWith("TRADE ") ||
    upper.startsWith("TRADE100") ||
    upper.startsWith("STERISHIELD ")
  );
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const rows = await prisma.supplierProductPrice.findMany({
    where: {
      supplierId: DULUX_SUPPLIER_ID,
      isActive: true,
      endsOn: null,
    },
    include: {
      product: { select: { name: true } },
    },
    orderBy: [{ createdAt: "asc" }],
  });

  const candidates = rows.filter(
    (r) => isTargetFamily(r.product.name) && isGenericDuplicate(r.product.name),
  );

  console.log(`Supplier: ${DULUX_SUPPLIER_ID}`);
  console.log(`Mode: ${dryRun ? "DRY-RUN" : "APPLY"}`);
  console.log(`Found active target rows: ${rows.length}`);
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
      data: {
        isActive: false,
        endsOn: new Date(),
      },
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
