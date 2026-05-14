import { prisma } from "@/lib/prisma";
import { Prisma } from "../../generated/prisma/client";
import { mapLedgerCategory, ledgerLabel } from "@/lib/buildsmart-ledger-mapper";
import type { HistoricalCostCategory } from "@/lib/buildsmart-ledger-mapper";

export type { HistoricalCostCategory };

// Full app adoption started from the fortnight beginning 25-Apr-2026.
// Everything up to and including the BuildSmart cutover (01-May-2026) is
// treated as historical — skip the live-app duplicate check for all rows.
const APP_ADOPTION_DATE = new Date("2026-05-09T00:00:00.000Z");

// BuildSmart is the financial source of truth up to and including this date.
const BUILDSMART_LAST_DATE = new Date("2026-05-01T23:59:59.999Z");

export type ImportStatus =
  | "NEW_HISTORICAL"
  | "DUPLICATE_IMPORTED"
  | "DUPLICATE_EXISTING_APP"
  | "MISSING_SITE"
  | "INVALID_ROW";

export interface BuildSmartRow {
  siteCode: string;
  ledgerCode: string;
  externalRef?: string;
  batchRef?: string;
  description?: string;
  transactionDate: Date;
  amount: string;
}

export interface ImportResult {
  row: BuildSmartRow;
  status: ImportStatus;
  reason?: string;
  category?: HistoricalCostCategory;
  siteId?: string;
}

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
    const agg = await prisma.attendanceScan.aggregate({
      where: { siteId, workDate: { gte: windowStart, lte: windowEnd } },
      _sum: { dayRateAtScan: true },
    });
    const appWages = agg._sum.dayRateAtScan ?? new Prisma.Decimal(0);
    return appWages.gte(lo) && appWages.lte(hi);
  }

  const orders = await prisma.siteProductOrder.findMany({
    where: { siteId, createdAt: { gte: windowStart, lte: windowEnd } },
    select: { totalCost: true },
  });
  if (!orders.length) return false;

  const appTotal = orders.reduce(
    (sum, o) => sum.add(o.totalCost ?? new Prisma.Decimal(0)),
    new Prisma.Decimal(0),
  );
  return appTotal.gte(lo) && appTotal.lte(hi);
}

async function processBuildSmartRow(
  row: BuildSmartRow,
  siteMap: Map<string, string>,
): Promise<ImportResult> {
  if (
    !row.siteCode ||
    !row.ledgerCode ||
    !row.transactionDate ||
    !row.amount ||
    isNaN(Number(row.amount))
  ) {
    return {
      row,
      status: "INVALID_ROW",
      reason: "Missing or invalid required fields",
    };
  }

  if (row.transactionDate > BUILDSMART_LAST_DATE) {
    return {
      row,
      status: "INVALID_ROW",
      reason: `Date ${row.transactionDate.toISOString().slice(0, 10)} is after 2026-05-01 cutover`,
    };
  }

  const siteId = siteMap.get(row.siteCode);
  if (!siteId) {
    return {
      row,
      status: "MISSING_SITE",
      reason: `Site code "${row.siteCode}" not found`,
    };
  }

  const category = mapLedgerCategory(row.ledgerCode);
  const amount = new Prisma.Decimal(row.amount);

  if (row.externalRef && row.ledgerCode) {
    const existing = await prisma.historicalSiteCost.findFirst({
      where: {
        siteId,
        source: "BUILDSMART",
        externalRef: row.externalRef,
        ledgerCode: row.ledgerCode,
      },
      select: { id: true },
    });
    if (existing) {
      return {
        row,
        status: "DUPLICATE_IMPORTED",
        reason: "Already imported",
        category,
        siteId,
      };
    }
  }

  const exactMatch = await prisma.historicalSiteCost.findFirst({
    where: {
      siteId,
      source: "BUILDSMART",
      ledgerCode: row.ledgerCode,
      transactionDate: row.transactionDate,
      amount,
    },
    select: { id: true },
  });
  if (exactMatch) {
    return {
      row,
      status: "DUPLICATE_IMPORTED",
      reason: "Already imported (exact match)",
      category,
      siteId,
    };
  }

  if (row.transactionDate >= APP_ADOPTION_DATE) {
    const overlaps = await appRecordExists(
      siteId,
      category,
      row.transactionDate,
      amount,
    );
    if (overlaps) {
      return {
        row,
        status: "DUPLICATE_EXISTING_APP",
        reason: "Similar record found in live app (±14 days, ±15% amount)",
        category,
        siteId,
      };
    }
  }

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

  return { row, status: "NEW_HISTORICAL", category, siteId };
}

export async function importBuildSmartRows(
  rows: BuildSmartRow[],
): Promise<ImportResult[]> {
  const results: ImportResult[] = [];

  const siteCodes = [...new Set(rows.map((r) => r.siteCode).filter(Boolean))];
  const sites = await prisma.site.findMany({
    where: { code: { in: siteCodes } },
    select: { id: true, code: true },
  });
  const siteMap = new Map(sites.map((s) => [s.code!, s.id]));

  for (const row of rows) {
    results.push(await processBuildSmartRow(row, siteMap));
  }

  return results;
}

export async function* importBuildSmartRowsStream(
  rows: BuildSmartRow[],
): AsyncGenerator<
  { total: number; done: number; result: ImportResult },
  void,
  unknown
> {
  const siteCodes = [...new Set(rows.map((r) => r.siteCode).filter(Boolean))];
  const sites = await prisma.site.findMany({
    where: { code: { in: siteCodes } },
    select: { id: true, code: true },
  });
  const siteMap = new Map(sites.map((s) => [s.code!, s.id]));

  let done = 0;
  for (const row of rows) {
    const result = await processBuildSmartRow(row, siteMap);
    done += 1;
    yield { total: rows.length, done, result };
  }
}
