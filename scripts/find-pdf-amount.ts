import { readFileSync } from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const pdfPath =
  process.argv[2] ??
  String.raw`C:\Users\Cautious.FCP\Downloads\'Contract Costs Report site c'.pdf`;

const target = process.argv[3] ?? "361102.54";
const targetNorm = target.replace(/[^\d]/g, "");

async function main() {
  const { PDFParse } = require("pdf-parse");
  const buffer = readFileSync(pdfPath);
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();

  const text: string = result.text;
  const lines = text.split(/\r?\n/).map((l: string) => l.trim());

  console.log(`Searching for: ${target} (normalized: ${targetNorm})\n`);

  // Direct string matches (various formats)
  const patterns = [
    "361,102.54",
    "361102.54",
    "361 102.54",
    "361102,54",
  ];

  for (const p of patterns) {
    if (text.includes(p)) {
      console.log(`Found literal: "${p}"`);
    }
  }

  // Line-by-line with context
  const hits: { lineNo: number; line: string; context: string[] }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const digits = line.replace(/[^\d]/g, "");
    if (
      line.includes("361") &&
      (line.includes("102") || digits.includes("36110254"))
    ) {
      const context: string[] = [];
      for (let j = Math.max(0, i - 3); j <= Math.min(lines.length - 1, i + 3); j++) {
        context.push(`${j + 1}: ${lines[j]}`);
      }
      hits.push({ lineNo: i + 1, line, context });
    }
  }

  console.log(`\n--- Lines mentioning 361 / 102 (${hits.length} hits) ---\n`);
  for (const h of hits) {
    console.log(`Line ${h.lineNo}:`);
    console.log(`  ${h.line}`);
    console.log("  Context:");
    h.context.forEach((c) => console.log(`    ${c}`));
    console.log();
  }

  // All amounts on the PDF near that magnitude
  const amountRe = /\d{1,3}(?:[,\s]\d{3})*\.\d{2}|\d{6,}\.\d{2}/g;
  const amounts = new Map<string, string[]>();
  for (let i = 0; i < lines.length; i++) {
    const matches = [...lines[i].matchAll(amountRe)];
    for (const m of matches) {
      const raw = m[0];
      const norm = parseFloat(raw.replace(/[\s,]/g, ""));
      if (norm >= 350000 && norm <= 370000) {
        const key = norm.toFixed(2);
        if (!amounts.has(key)) amounts.set(key, []);
        amounts.get(key)!.push(`L${i + 1}: ${lines[i].slice(0, 100)}`);
      }
    }
  }

  console.log("--- Amounts in range 350k–370k ---");
  for (const [amt, locs] of amounts) {
    console.log(`  R${amt}:`);
    locs.forEach((l) => console.log(`    ${l}`));
  }

  // Contract / ledger header lines with totals
  console.log("\n--- Contract & ledger summary lines (with amounts) ---");
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (
      /^(contract|9\d{2,6}\s*[-–])/i.test(l) &&
      /\d+[,\s]?\d*\.\d{2}/.test(l)
    ) {
      console.log(`L${i + 1}: ${l.slice(0, 120)}`);
    }
  }
}

main().catch(console.error);
