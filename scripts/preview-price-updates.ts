import fs from "fs";
import path from "path";
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { findProcurementProductByName } from "../src/lib/procurement/findProcurementProductByName";

function parseCurrency(cell: string | undefined) {
  if (!cell) return null;
  const m = cell.replace(/\s+/g, "").match(/R?([0-9,]+(?:\.[0-9]{1,2})?)/);
  if (!m) return null;
  return parseFloat(m[1].replace(/,/g, ""));
}

function trimCell(c: string | undefined) {
  if (!c) return "";
  return c
    .replace(/^\s*"?\s*/, "")
    .replace(/\s*"?\s*$/, "")
    .trim();
}

async function main() {
  const csvPath = path.join(process.cwd(), "scripts", "prices.csv");
  const raw = fs.readFileSync(csvPath, "utf8");
  const lines = raw.split(/\r?\n/).filter(Boolean);

  if (lines.length < 3) {
    console.error("CSV looks too short");
    process.exit(1);
  }

  // find supplier header line (first non-empty with names)
  const headerLine = lines.find((l) => /PLASCON|DULUX|PROMINENT/i.test(l))!;
  const headerCells = headerLine.split(",");

  const suppliers: { name: string; start: number }[] = [];
  headerCells.forEach((cell, idx) => {
    const t = cell.trim().toUpperCase();
    if (["PLASCON", "DULUX", "PROMINENT"].includes(t)) {
      suppliers.push({ name: t, start: idx });
    }
  });

  if (suppliers.length === 0) {
    console.error("Could not detect suppliers in header");
    process.exit(1);
  }

  // load supplier IDs from DB
  const supplierMap: Record<string, { id: string; name: string } | null> = {};
  for (const s of suppliers) {
    const sup = await prisma.supplier.findFirst({
      where: { name: { contains: s.name, mode: "insensitive" } },
    });
    supplierMap[s.name] = sup ? { id: sup.id, name: sup.name } : null;
  }

  const updates: Array<{
    supplierLabel: string;
    supplierId: string | null;
    productName: string;
    parsedPrice: number | null;
    matchedProductId: string | null;
    matchedProductName: string | null;
    existingPriceId: string | null;
    existingPriceValue: number | null;
  }> = [];

  // start scanning rows after the header block (skip first 4 rows which are headings)
  for (let i = 4; i < lines.length; i++) {
    const cells = lines[i].split(",");

    for (const s of suppliers) {
      const nameCell = trimCell(cells[s.start]);
      if (!nameCell) continue;

      // find first currency-looking cell in the next 6 columns
      let parsedPrice: number | null = null;
      for (let j = s.start + 1; j <= s.start + 8 && j < cells.length; j++) {
        const p = parseCurrency(cells[j]);
        if (p !== null) {
          parsedPrice = p;
          break;
        }
      }

      if (parsedPrice === null) continue; // nothing to update

      // attempt to find procurement product by name using helper
      const supplierEntry = supplierMap[s.name];
      const supplierId = supplierEntry ? supplierEntry.id : null;
      const candidate = await findProcurementProductByName(
        nameCell,
        supplierId,
      );

      let existingPriceId: string | null = null;
      let existingPriceValue: number | null = null;

      if (candidate && supplierId) {
        const existing = await prisma.supplierProductPrice.findFirst({
          where: { supplierId, productId: candidate.id, isActive: true },
          orderBy: { createdAt: "desc" },
        });
        if (existing) {
          existingPriceId = existing.id;
          existingPriceValue = Number(existing.price);
        }
      }

      updates.push({
        supplierLabel: s.name,
        supplierId: supplierId,
        productName: nameCell,
        parsedPrice,
        matchedProductId: candidate ? candidate.id : null,
        matchedProductName: candidate ? candidate.name : null,
        existingPriceId,
        existingPriceValue,
      });
    }
  }

  console.log("Price update preview (first 200 rows):\n");
  for (const u of updates.slice(0, 200)) {
    console.log(
      `Supplier: ${u.supplierLabel} (${u.supplierId ?? "NOT FOUND"})`,
    );
    console.log(`  CSV product: ${u.productName}`);
    if (u.matchedProductId) {
      console.log(
        `  Matched product: ${u.matchedProductName} (id=${u.matchedProductId})`,
      );
    } else {
      console.log(`  Matched product: NONE`);
    }
    console.log(`  CSV price: ${u.parsedPrice}`);
    if (u.existingPriceId) {
      console.log(
        `  Existing supplier price id=${u.existingPriceId} value=${u.existingPriceValue}`,
      );
    } else {
      console.log(`  Existing supplier price: NONE`);
    }
    console.log("---");
  }

  console.log(`\nTotal parsed price rows: ${updates.length}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
