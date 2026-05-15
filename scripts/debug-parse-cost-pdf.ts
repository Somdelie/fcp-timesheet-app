import "dotenv/config";
import { readFileSync } from "fs";
import { parseCostReportBuffer } from "../lib/buildsmart-cost-parser";
import { mapLedgerCategory } from "../lib/buildsmart-ledger-mapper";

const pdfPath =
  process.argv[2] ??
  String.raw`C:\Users\Cautious.FCP\Downloads\'Contract Costs Report site c'.pdf`;

async function main() {
  const buffer = readFileSync(pdfPath);
  const report = await parseCostReportBuffer(buffer);

  console.log("=== Parse summary ===");
  console.log("Site:", report.siteCode, report.siteName);
  console.log("Financial rows:", report.rows.length);
  console.log("Material (DEL) lines:", report.materialLines.length);
  console.log("Warnings:", report.warnings.length);

  if (report.warnings.length) {
    console.log("\n--- Warnings (first 30) ---");
    report.warnings.slice(0, 30).forEach((w) => console.log(" ", w));
  }

  const byLedger = new Map<string, { count: number; total: number }>();
  for (const r of report.rows) {
    const cat = mapLedgerCategory(r.ledgerCode);
    const key = `${r.ledgerCode} (${cat})`;
    const cur = byLedger.get(key) ?? { count: 0, total: 0 };
    cur.count++;
    cur.total += parseFloat(r.amount);
    byLedger.set(key, cur);
  }

  console.log("\n--- Rows by ledger (financial) ---");
  [...byLedger.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([k, v]) =>
      console.log(`  ${k}: ${v.count} rows, R${v.total.toFixed(2)}`),
    );

  const labourOnly = report.rows.filter(
    (r) => mapLedgerCategory(r.ledgerCode) === "LABOUR",
  );
  const nonLabour = report.rows.filter(
    (r) => mapLedgerCategory(r.ledgerCode) !== "LABOUR",
  );
  console.log("\n--- Import filter (historical costs API) ---");
  console.log("  Would import (LABOUR only):", labourOnly.length);
  console.log("  Skipped non-labour:", nonLabour.length);

  const skippedByCat = new Map<string, number>();
  for (const r of nonLabour) {
    const c = mapLedgerCategory(r.ledgerCode);
    skippedByCat.set(c, (skippedByCat.get(c) ?? 0) + 1);
  }
  console.log("  Skipped breakdown:");
  [...skippedByCat.entries()].forEach(([c, n]) =>
    console.log(`    ${c}: ${n}`),
  );

  // Sample raw PDF lines that didn't become rows
  const pdfParse = await import("pdf-parse");
  const parser = await pdfParse.default(buffer);
  const textResult = parser.text;
  const lines = textResult.text
    .split(/\r?\n/)
    .map((l: string) => l.trim())
    .filter(Boolean);

  interface TxnLineFilter {
    (l: string): boolean;
  }

  const txnLines: string[] = lines.filter(
    (<TxnLineFilter>(
      (l: string) =>
        /^\d{1,2}[-\s](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(
          l,
        )
    ))
  );
  const parsedRaw = new Set(report.rows.map((r) => r.rawLine));
  const materialRaw = new Set(report.materialLines.map((m) => m.rawLine));
  const missed = txnLines.filter(
    (l) => !parsedRaw.has(l) && !materialRaw.has(l),
  );

  console.log("\n--- Transaction lines in PDF not in output ---");
  console.log("  Total txn-looking lines:", txnLines.length);
  console.log("  Missed:", missed.length);
  missed.slice(0, 25).forEach((l: string) => console.log("  ", l.slice(0, 120)));
}

main().catch(console.error);
