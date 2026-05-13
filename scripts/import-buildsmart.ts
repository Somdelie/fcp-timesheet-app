/**
 * BuildSmart Historical Cost Engine
 *
 * Imports historical site costs from BuildSmart into HistoricalSiteCost.
 * Supports all cost categories: Labour, Materials, Consumables, Plant, Tools,
 * Safety, Scaffolding, Subcontract, Other.
 *
 * CUTOVER RULES
 * ─────────────
 * Before APP_ADOPTION_DATE (2026-01-01):
 *   Safe to import unconditionally — the app was not in use yet.
 *
 * Between APP_ADOPTION_DATE and BUILDSMART_LAST_DATE (2026-05-01):
 *   Check whether similar records already exist in the live app before
 *   importing. This avoids double-counting costs that were captured
 *   in the app AND appear in BuildSmart.
 *
 * After BUILDSMART_LAST_DATE:
 *   Do not import — the app is the sole source of truth from 2026-05-02.
 *
 * IMPORT STATUS CODES
 * ───────────────────
 *   NEW_HISTORICAL           – row imported successfully
 *   DUPLICATE_IMPORTED       – identical externalRef+ledgerCode already in DB
 *   DUPLICATE_EXISTING_APP   – similar record found in live app data; skipped
 *   MISSING_SITE             – site code not found in DB
 *   INVALID_ROW              – missing required fields or date out of range
 */

import "dotenv/config";
import { PrismaClient, Prisma } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  mapLedgerCategory,
  ledgerLabel,
  type HistoricalCostCategory,
} from "./buildsmart-ledger-mapper.js";

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// App was not yet in use before this date — safe unconditional import.
const APP_ADOPTION_DATE = new Date("2026-01-01T00:00:00.000Z");

// BuildSmart is source of truth up to (and including) this date.
// The app takes over from 2026-05-02.
const BUILDSMART_LAST_DATE = new Date("2026-05-01T23:59:59.999Z");

// ─── Types ────────────────────────────────────────────────────────────────────

export type ImportStatus =
  | "NEW_HISTORICAL"
  | "DUPLICATE_IMPORTED"
  | "DUPLICATE_EXISTING_APP"
  | "MISSING_SITE"
  | "INVALID_ROW";

export interface BuildSmartRow {
  /** BuildSmart contract number, e.g. "6316", "6537" */
  siteCode: string;
  /** BuildSmart ledger code, e.g. "924015", "922010" */
  ledgerCode: string;
  /** Batch / payroll reference, e.g. "P7100726" */
  externalRef?: string;
  /** Optional posting batch */
  batchRef?: string;
  /** Free-text description from report */
  description?: string;
  /** Date of the BuildSmart posting */
  transactionDate: Date;
  /** Decimal string, e.g. "9014.70" */
  amount: string;
}

export interface ImportResult {
  row: BuildSmartRow;
  status: ImportStatus;
  reason?: string;
  category?: HistoricalCostCategory;
  siteId?: string;
}

// ─── Overlap detection ────────────────────────────────────────────────────────

/**
 * Returns true if a sufficiently similar record already exists in live app
 * tables for the same site and date window.
 *
 * Tolerance: ±14 days, ±15% amount.
 */
async function appRecordExists(
  siteId: string,
  category: HistoricalCostCategory,
  transactionDate: Date,
  amount: Prisma.Decimal,
): Promise<boolean> {
  const windowStart = new Date(transactionDate);
  windowStart.setDate(windowStart.getDate() - 14);
  const windowEnd = new Date(transactionDate);
  windowEnd.setDate(windowEnd.getDate() + 14);

  const amountNum = amount.toNumber();
  const lo = new Prisma.Decimal(amountNum * 0.85);
  const hi = new Prisma.Decimal(amountNum * 1.15);

  if (category === "LABOUR") {
    // Compare against sum of dayRateAtScan for this site in the window.
    const agg = await prisma.attendanceScan.aggregate({
      where: {
        siteId,
        workDate: { gte: windowStart, lte: windowEnd },
      },
      _sum: { dayRateAtScan: true },
    });
    const appWages = agg._sum.dayRateAtScan ?? new Prisma.Decimal(0);
    return appWages.gte(lo) && appWages.lte(hi);
  }

  // For all material-type categories, compare against SiteProductOrder totals.
  const orders = await prisma.siteProductOrder.findMany({
    where: {
      siteId,
      createdAt: { gte: windowStart, lte: windowEnd },
    },
    select: { totalCost: true },
  });

  if (orders.length === 0) return false;

  const appTotal = orders.reduce(
    (sum, o) => sum.add(o.totalCost ?? new Prisma.Decimal(0)),
    new Prisma.Decimal(0),
  );
  return appTotal.gte(lo) && appTotal.lte(hi);
}

// ─── Core import function ─────────────────────────────────────────────────────

export async function importBuildSmartRows(
  rows: BuildSmartRow[],
): Promise<ImportResult[]> {
  const results: ImportResult[] = [];

  // Resolve site codes → ids in one query.
  const siteCodes = [...new Set(rows.map((r) => r.siteCode).filter(Boolean))];
  const sites = await prisma.site.findMany({
    where: { code: { in: siteCodes } },
    select: { id: true, code: true },
  });
  const siteMap = new Map(sites.map((s) => [s.code!, s.id]));

  for (const row of rows) {
    // ── Validate required fields ──
    if (
      !row.siteCode ||
      !row.ledgerCode ||
      !row.transactionDate ||
      !row.amount ||
      isNaN(Number(row.amount))
    ) {
      results.push({
        row,
        status: "INVALID_ROW",
        reason: "Missing or invalid required fields (siteCode, ledgerCode, transactionDate, amount)",
      });
      continue;
    }

    // ── Enforce import window ──
    if (row.transactionDate > BUILDSMART_LAST_DATE) {
      results.push({
        row,
        status: "INVALID_ROW",
        reason: `transactionDate ${row.transactionDate.toISOString().slice(0, 10)} is after cutover (2026-05-01). App is source of truth from 2026-05-02.`,
      });
      continue;
    }

    // ── Site lookup ──
    const siteId = siteMap.get(row.siteCode);
    if (!siteId) {
      results.push({
        row,
        status: "MISSING_SITE",
        reason: `Site code "${row.siteCode}" not found in database`,
      });
      continue;
    }

    const category = mapLedgerCategory(row.ledgerCode);
    const amount = new Prisma.Decimal(row.amount);

    // ── Duplicate: already imported ──
    // Only use the unique index when both fields are non-null.
    if (row.externalRef && row.ledgerCode) {
      const existing = await prisma.historicalSiteCost.findFirst({
        where: {
          source: "BUILDSMART",
          externalRef: row.externalRef,
          ledgerCode: row.ledgerCode,
        },
        select: { id: true },
      });
      if (existing) {
        results.push({
          row,
          status: "DUPLICATE_IMPORTED",
          reason: "Already imported (externalRef + ledgerCode match)",
          category,
          siteId,
        });
        continue;
      }
    }

    // ── Duplicate: overlap with live app data ──
    // Only check rows that fall within the app-adoption window.
    if (row.transactionDate >= APP_ADOPTION_DATE) {
      const overlaps = await appRecordExists(
        siteId,
        category,
        row.transactionDate,
        amount,
      );
      if (overlaps) {
        results.push({
          row,
          status: "DUPLICATE_EXISTING_APP",
          reason: "Similar record found in live app data (±14 days, ±15% amount)",
          category,
          siteId,
        });
        continue;
      }
    }

    // ── Import ──
    await prisma.historicalSiteCost.create({
      data: {
        siteId,
        source: "BUILDSMART",
        category,
        transactionDate: row.transactionDate,
        externalRef: row.externalRef ?? null,
        batchRef: row.batchRef ?? null,
        ledgerCode: row.ledgerCode,
        description: row.description ?? ledgerLabel(row.ledgerCode),
        amount,
      },
    });

    results.push({ row, status: "NEW_HISTORICAL", category, siteId });
  }

  return results;
}

// ─── Reporting helper ─────────────────────────────────────────────────────────

function printSummary(results: ImportResult[]): void {
  const counts: Record<ImportStatus, number> = {
    NEW_HISTORICAL: 0,
    DUPLICATE_IMPORTED: 0,
    DUPLICATE_EXISTING_APP: 0,
    MISSING_SITE: 0,
    INVALID_ROW: 0,
  };

  for (const r of results) {
    counts[r.status]++;
    if (r.status !== "NEW_HISTORICAL") {
      const date = r.row.transactionDate.toISOString().slice(0, 10);
      const cat = r.category ?? mapLedgerCategory(r.row.ledgerCode);
      console.log(
        `  [${r.status}] ${r.row.siteCode} | ${r.row.ledgerCode} (${cat}) | ${date} | R${r.row.amount} — ${r.reason}`,
      );
    }
  }

  console.log("\n=== IMPORT SUMMARY ===");
  console.log(`  NEW_HISTORICAL:           ${counts.NEW_HISTORICAL}`);
  console.log(`  DUPLICATE_IMPORTED:       ${counts.DUPLICATE_IMPORTED}`);
  console.log(`  DUPLICATE_EXISTING_APP:   ${counts.DUPLICATE_EXISTING_APP}`);
  console.log(`  MISSING_SITE:             ${counts.MISSING_SITE}`);
  console.log(`  INVALID_ROW:              ${counts.INVALID_ROW}`);
  console.log(`  ────────────────────────────`);
  console.log(`  Total processed:          ${results.length}`);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main() {
  // =========================================================================
  // PASTE YOUR BUILDSMART REPORT ROWS HERE.
  //
  // One object per posting line from the BuildSmart cost report.
  //
  // Fields:
  //   siteCode        – contract number from BuildSmart (e.g. "6316")
  //   ledgerCode      – BuildSmart ledger code     (e.g. "924015")
  //   externalRef     – payroll / batch reference  (e.g. "P7100726")
  //   batchRef        – optional sub-batch ref
  //   description     – free text from the report
  //   transactionDate – posting date
  //   amount          – decimal string, no currency symbol
  //
  // The importer will:
  //   • map ledgerCode → category automatically
  //   • skip rows already in the DB (externalRef + ledgerCode match)
  //   • skip rows where the app already has a similar record (post 2026-01-01)
  //   • refuse rows dated after 2026-05-01 (app is source of truth from then)
  // =========================================================================
  const rows: BuildSmartRow[] = [
    // ── Curro Waterfall (6537) – Labour ─────────────────────────────────────
    // {
    //   siteCode: "6537",
    //   ledgerCode: "924015",
    //   externalRef: "P7101626",
    //   description: "Payroll 001 Posting - Labour Only",
    //   transactionDate: new Date("2025-10-03"),
    //   amount: "9014.70",
    // },

    // ── Curro Waterfall (6537) – Paint / Materials ───────────────────────────
    // {
    //   siteCode: "6537",
    //   ledgerCode: "922010",
    //   externalRef: "INV-20251005",
    //   description: "Paint - Walls",
    //   transactionDate: new Date("2025-10-05"),
    //   amount: "12450.00",
    // },

    // ── Sandton Gate PH2 (6316) – Labour ────────────────────────────────────
    // {
    //   siteCode: "6316",
    //   ledgerCode: "924015",
    //   externalRef: "P7100726",
    //   description: "Payroll 001 Posting - Clock Cards Internal Contracts",
    //   transactionDate: new Date("2025-03-07"),
    //   amount: "152340.22",
    // },

    // ── Sandton Gate PH2 (6316) – Scaffolding ───────────────────────────────
    // {
    //   siteCode: "6316",
    //   ledgerCode: "920030",
    //   externalRef: "INV-SCAFFOLD-001",
    //   description: "Formwork & Scaffolding",
    //   transactionDate: new Date("2025-03-10"),
    //   amount: "30189.91",
    // },

    // ADD YOUR REAL ROWS BELOW THIS LINE
  ];

  if (rows.length === 0) {
    console.log("No rows to import. Add BuildSmart rows to the `rows` array in main().");
    return;
  }

  console.log(`Importing ${rows.length} BuildSmart row(s)…\n`);
  const results = await importBuildSmartRows(rows);
  printSummary(results);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
