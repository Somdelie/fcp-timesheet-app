/**
 * Explains where contract/ledger totals on a BuildSmart cost report PDF come from.
 */
import { readFileSync } from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error("Usage: npx tsx scripts/analyze-cost-report-totals.ts <pdf-path>");
  process.exit(1);
}

const CONTRACT_RE =
  /^contract(?:\s+no\.?)?[:\s#]*(\d{4,6})\s*[-–]\s*(.+)$/i;
const LEDGER_HEADER_RE = /^(9\d{1,5})\s*[-–]\s*(.+)$/i;
const AMOUNT_RE = /\d{1,3}(?:[,\s]\d{3})*\.\d{2}|\d+\.\d{2}/g;

function parseAmounts(line: string): number[] {
  return [...line.matchAll(AMOUNT_RE)]
    .map((m) => parseFloat(m[0].replace(/[\s,]/g, "")))
    .filter((n) => n > 0);
}

async function main() {
  const { PDFParse } = require("pdf-parse");
  const buffer = readFileSync(pdfPath);
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();

  const lines = result.text
    .split(/\r?\n/)
    .map((l: string) => l.trim())
    .filter(Boolean);

  console.log("=== Contract header lines ===\n");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(CONTRACT_RE);
    if (!m) continue;
    const amounts = parseAmounts(lines[i]);
    console.log(`Line ${i + 1}: ${lines[i]}`);
    console.log(`  Code: ${m[1]}, Name: ${m[2].slice(0, 60)}`);
    console.log(`  Amounts on line: ${amounts.map((a) => a.toFixed(2)).join(", ")}`);
    if (amounts.length >= 2) {
      console.log(`  → Often: col1=${amounts[0].toFixed(2)}, col2=${amounts[1].toFixed(2)} (period / cumulative)`);
    }
    console.log();
  }

  console.log("=== Ledger header subtotals (first occurrence per ledger) ===\n");
  const seenLedgers = new Set<string>();
  let ledgerHeaderSum = 0;

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(LEDGER_HEADER_RE);
    if (!m) continue;
    const code = m[1];
    if (seenLedgers.has(code)) continue;
    seenLedgers.add(code);

    const amounts = parseAmounts(lines[i]);
    const total = amounts.length ? amounts[amounts.length - 1] : 0;
    ledgerHeaderSum += total;

    console.log(`Line ${i + 1}: ${lines[i].slice(0, 100)}`);
    console.log(`  Ledger ${code}: amounts=${amounts.map((a) => a.toFixed(2)).join(", ")}`);
    console.log(`  Using last amount as subtotal: ${total.toFixed(2)}`);
    console.log();
  }

  console.log(`Sum of ledger header subtotals (last col): ${ledgerHeaderSum.toFixed(2)}`);

  // Search specific target
  const target = 361102.54;
  console.log(`\n=== Searching for ${target.toFixed(2)} ===`);
  for (let i = 0; i < lines.length; i++) {
    const amounts = parseAmounts(lines[i]);
    if (amounts.some((a) => Math.abs(a - target) < 0.01)) {
      console.log(`EXACT on line ${i + 1}: ${lines[i]}`);
    } else if (lines[i].includes("361") && lines[i].includes("102")) {
      console.log(`Partial match line ${i + 1}: ${lines[i]}`);
    }
  }
}

main().catch(console.error);
