import fs from "fs";
import path from "path";
import "dotenv/config";
import { prisma } from "../lib/prisma";
import normalizeProductName from "../src/lib/procurement/normalizeProductName";

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

function cleanForCompare(s: string) {
  return s
    .toLowerCase()
    .replace(/\b\d+(?:\.\d+)?\s*(l|kg|g)s?\b/gi, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string) {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;
  const dp: number[][] = Array.from({ length: al + 1 }, () =>
    Array(bl + 1).fill(0),
  );
  for (let i = 0; i <= al; i++) dp[i][0] = i;
  for (let j = 0; j <= bl; j++) dp[0][j] = j;
  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[al][bl];
}

function similarity(a: string, b: string) {
  if (!a || !b) return 0;
  const dist = levenshtein(a, b);
  return 1 - dist / Math.max(a.length, b.length);
}

async function main() {
  const csvPath = path.join(process.cwd(), "scripts", "prices.csv");
  if (!fs.existsSync(csvPath)) {
    console.error("CSV not found at", csvPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(csvPath, "utf8");
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length < 3) {
    console.error("CSV looks too short");
    process.exit(1);
  }

  const headerLine = lines.find((l) => /PLASCON|DULUX|PROMINENT/i.test(l))!;
  const headerCells = headerLine.split(",");

  const suppliers: { name: string; start: number }[] = [];
  headerCells.forEach((cell, idx) => {
    const t = cell.trim().toUpperCase();
    if (t === "PLASCON" || t === "DULUX" || t === "PROMINENT") {
      suppliers.push({ name: t, start: idx });
    }
  });

  if (suppliers.length === 0) {
    console.error("Could not detect suppliers in header");
    process.exit(1);
  }

  // Load procurement products once
  const products = await prisma.procurementProduct.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  const productCache = products.map((p) => ({
    id: p.id,
    name: p.name,
    clean: cleanForCompare(p.name),
  }));

  // supplier map; create missing suppliers (user approved)
  const supplierMap: Record<string, { id: string; name: string }> = {};
  for (const s of suppliers) {
    const sup = await prisma.supplier.findFirst({
      where: { name: { contains: s.name, mode: "insensitive" } },
    });
    if (sup) {
      supplierMap[s.name] = { id: sup.id, name: sup.name };
    } else {
      // create as BRAND
      const created = await prisma.supplier.create({
        data: { name: s.name, supplierType: "BRAND", isActive: true },
      });
      supplierMap[s.name] = { id: created.id, name: created.name };
      console.log(`Created missing supplier: ${s.name} (id=${created.id})`);
    }
  }

  const proposals: Array<{
    rowIndex: number;
    supplierLabel: string;
    supplierId: string;
    csvProductName: string;
    parsedPrice: number | null;
    candidateId: string | null;
    candidateName: string | null;
    confidence: number;
    note?: string;
  }> = [];

  for (let i = 4; i < lines.length; i++) {
    const cells = lines[i].split(",");
    for (const s of suppliers) {
      const nameCell = trimCell(cells[s.start]);
      if (!nameCell) continue;
      let parsedPrice: number | null = null;
      for (let j = s.start + 1; j <= s.start + 8 && j < cells.length; j++) {
        const p = parseCurrency(cells[j]);
        if (p !== null) {
          parsedPrice = p;
          break;
        }
      }
      if (parsedPrice === null) continue;

      const supplierEntry = supplierMap[s.name];
      const supplierId = supplierEntry.id;

      // get normalized canonical name (if any)
      const norm = normalizeProductName(nameCell, s.name);
      const candidates: { id: string; name: string; score: number }[] = [];

      const left = cleanForCompare(nameCell);
      for (const p of productCache) {
        let score = similarity(left, p.clean);
        // if canonical names exist, compare them too
        if (norm.canonicalName) {
          const c = cleanForCompare(norm.canonicalName);
          const sscore = similarity(c, p.clean);
          score = Math.max(score, sscore);
        }
        if (score > 0) candidates.push({ id: p.id, name: p.name, score });
      }

      candidates.sort((a, b) => b.score - a.score);
      const best = candidates[0];
      const conf = best ? best.score : 0;
      // threshold default 0.65
      const threshold = Number(process.env.FUZZY_THRESHOLD ?? 0.65);

      proposals.push({
        rowIndex: i,
        supplierLabel: s.name,
        supplierId,
        csvProductName: nameCell,
        parsedPrice,
        candidateId: conf >= threshold && best ? best.id : null,
        candidateName: conf >= threshold && best ? best.name : null,
        confidence: conf,
        note: norm.hadVariant ? "hadVariant" : undefined,
      });
    }
  }

  const outPath = path.join(
    process.cwd(),
    "scripts",
    "price-match-proposals.json",
  );
  fs.writeFileSync(outPath, JSON.stringify(proposals, null, 2), "utf8");
  console.log(`Wrote ${proposals.length} proposals to ${outPath}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
