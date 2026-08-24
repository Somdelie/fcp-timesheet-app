import { prisma } from "@/lib/prisma";
import { Prisma } from "../../generated/prisma/client";

import { mapLedgerCategory, ledgerLabel } from "@/lib/buildsmart-ledger-mapper";

import type { HistoricalCostCategory } from "@/lib/buildsmart-ledger-mapper";

import {
  isOrderReferenceTaken,
  loadExistingOrderReferences,
} from "@/lib/procurement/buildsmartOrderDedup";

import { getFortnightForDateUTC } from "@/lib/timesheetPeriods";

export type { HistoricalCostCategory };

/**
 * BUILDSMART CUTOVER RULES
 * ─────────────────────────
 *
 * Labour is cut over separately from every other cost category, because the
 * FCP app started recording live attendance (AttendanceScan.dayRateAtScan)
 * before it took over as source of truth for materials and other costs.
 *
 * LABOUR:
 *   BuildSmart is the source of truth for every row dated before the start
 *   of the current fortnight (the fortnight containing `asOfDate`, per the
 *   canonical `TimesheetYear.anchorSat` fortnight boundary used everywhere
 *   else in the app — see lib/timesheetPeriods.ts). From that fortnight's
 *   start date onward, the FCP app (AttendanceScan) is the sole source of
 *   truth and BuildSmart labour rows must not be imported.
 *
 *   This boundary is not a fixed date. It moves every 14 days and is
 *   resolved fresh each time the importer runs, from `asOfDate` (defaults
 *   to now, but callers can pass an explicit date for deterministic/
 *   reproducible imports).
 *
 * MATERIAL / CONSUMABLE / PLANT / TOOLS / SAFETY / SCAFFOLDING / SUBCONTRACT / OTHER:
 *   Up to and including 3 July 2026:  BuildSmart is the source of truth.
 *   From 4 July 2026:                 the FCP app is the source of truth.
 *   BuildSmart rows dated 4 July 2026 or later must not be imported.
 */

// The FCP app becomes the source of truth for every non-labour category from 4 July 2026.
const APP_CUTOVER_DATE = new Date("2026-07-04T00:00:00.000Z");

// BuildSmart remains the source of truth for non-labour categories up to and including 3 July 2026.
const BUILDSMART_LAST_DATE = new Date("2026-07-03T23:59:59.999Z");

/**
 * Resolves the labour cutover boundary as of `asOfDate`: the start of the
 * fortnight containing `asOfDate`, per the canonical `TimesheetYear.anchorSat`
 * used by the rest of the app's fortnight logic (see lib/timesheetPeriods.ts).
 *
 * Throws if the relevant year has no configured anchor, rather than guessing
 * one — matching the convention already used by the timesheet-period
 * generation routes.
 *
 * Exported because the wage-reporting layer (calcSiteCosts, listSites) needs
 * the same boundary to stop double-counting AttendanceScan labour for
 * periods BuildSmart already covers historically — see calcSiteCosts.ts.
 */
export async function resolveLabourCutover(
  asOfDate: Date,
): Promise<{ cutoverDate: Date; lastValidDate: Date }> {
  const year = asOfDate.getUTCFullYear();

  const yearConfig = await prisma.timesheetYear.findUnique({
    where: { year },
    select: { anchorSat: true },
  });

  if (!yearConfig) {
    throw new Error(
      `Cannot resolve the labour cutover: no TimesheetYear configured for ${year}. ` +
        `Configure it via /admin/timesheets/generate-year first.`,
    );
  }

  const fortnight = getFortnightForDateUTC(asOfDate, yearConfig.anchorSat);
  const cutoverDate = fortnight.startDate;
  const lastValidDate = new Date(cutoverDate.getTime() - 1);

  return { cutoverDate, lastValidDate };
}

/**
 * Returns the cutover date (first date the app takes over, exclusive of
 * BuildSmart) for the given category.
 */
function cutoverDateFor(
  category: HistoricalCostCategory,
  labourCutoverDate: Date,
): Date {
  return category === "LABOUR" ? labourCutoverDate : APP_CUTOVER_DATE;
}

export type ImportStatus =
  | "NEW_HISTORICAL"
  | "DUPLICATE_IMPORTED"
  | "DUPLICATE_EXISTING_APP"
  | "DUPLICATE_ORDER"
  | "MISSING_SITE"
  | "INVALID_ROW";

export interface BuildSmartRow {
  siteCode: string;
  ledgerCode: string;
  externalRef?: string;
  batchRef?: string;

  /**
   * BuildSmart PO number.
   *
   * The row is skipped when the order reference already exists in either:
   * - SiteProductOrder
   * - Historical materials
   */
  orderNumber?: string | null;

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

/**
 * Checks whether a similar transaction already exists in the live app.
 *
 * This is retained as an additional safeguard, even though BuildSmart
 * transactions on or after the cutover date are rejected before reaching it.
 *
 * Tolerance:
 * - Date: ±14 days
 * - Amount: ±15%
 */
async function appRecordExists(
  siteId: string,
  category: HistoricalCostCategory,
  transactionDate: Date,
  amount: Prisma.Decimal,
): Promise<boolean> {
  const windowStart = new Date(transactionDate);
  windowStart.setUTCDate(windowStart.getUTCDate() - 14);

  const windowEnd = new Date(transactionDate);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 14);

  const amountNum = amount.toNumber();

  const minimumAmount = new Prisma.Decimal(amountNum * 0.85);
  const maximumAmount = new Prisma.Decimal(amountNum * 1.15);

  if (category === "LABOUR") {
    const aggregate = await prisma.attendanceScan.aggregate({
      where: {
        siteId,
        workDate: {
          gte: windowStart,
          lte: windowEnd,
        },
      },
      _sum: {
        dayRateAtScan: true,
      },
    });

    const appWages = aggregate._sum.dayRateAtScan ?? new Prisma.Decimal(0);

    return appWages.gte(minimumAmount) && appWages.lte(maximumAmount);
  }

  const orders = await prisma.siteProductOrder.findMany({
    where: {
      siteId,
      createdAt: {
        gte: windowStart,
        lte: windowEnd,
      },
    },
    select: {
      totalCost: true,
    },
  });

  if (orders.length === 0) {
    return false;
  }

  const appTotal = orders.reduce(
    (total, order) => total.add(order.totalCost ?? new Prisma.Decimal(0)),
    new Prisma.Decimal(0),
  );

  return appTotal.gte(minimumAmount) && appTotal.lte(maximumAmount);
}

/**
 * Ensures the supplied value is a valid Date.
 */
function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

/**
 * Normalizes a date to a new Date instance.
 *
 * This prevents accidental mutation of the original row date.
 */
function normalizeTransactionDate(date: Date): Date {
  return new Date(date.getTime());
}

/**
 * Processes and imports one BuildSmart transaction.
 */
async function processBuildSmartRow(
  row: BuildSmartRow,
  siteMap: Map<string, string>,
  existingOrderRefs: Set<string>,
  labourCutoverDate: Date,
  labourLastValidDate: Date,
): Promise<ImportResult> {
  const normalizedSiteCode = row.siteCode?.trim();
  const normalizedLedgerCode = row.ledgerCode?.trim();
  const normalizedOrderNumber = row.orderNumber?.trim() || null;
  const normalizedExternalRef = row.externalRef?.trim() || null;
  const normalizedBatchRef = row.batchRef?.trim() || null;
  const normalizedDescription = row.description?.trim() || null;

  if (
    !normalizedSiteCode ||
    !normalizedLedgerCode ||
    !isValidDate(row.transactionDate) ||
    !row.amount?.trim() ||
    !Number.isFinite(Number(row.amount))
  ) {
    return {
      row,
      status: "INVALID_ROW",
      reason:
        "Missing or invalid required fields: siteCode, ledgerCode, transactionDate or amount",
    };
  }

  let amount: Prisma.Decimal;

  try {
    amount = new Prisma.Decimal(row.amount);
  } catch {
    return {
      row,
      status: "INVALID_ROW",
      reason: `Invalid amount "${row.amount}"`,
    };
  }

  const transactionDate = normalizeTransactionDate(row.transactionDate);

  // Category determines which cutover rule applies. Labour cuts over at the
  // start of the current fortnight (resolved per-batch by the caller from
  // TimesheetYear.anchorSat); every other category cuts over on 2026-07-04.
  const category = mapLedgerCategory(normalizedLedgerCode);

  /**
   * Reject transactions dated on or after the app cutover for this category.
   */
  const cutoverDate = cutoverDateFor(category, labourCutoverDate);

  if (transactionDate >= cutoverDate) {
    const finalValidDate =
      category === "LABOUR" ? labourLastValidDate : BUILDSMART_LAST_DATE;

    return {
      row,
      status: "INVALID_ROW",
      reason: `Date ${transactionDate
        .toISOString()
        .slice(
          0,
          10,
        )} is on or after the ${cutoverDate
        .toISOString()
        .slice(0, 10)} FCP app ${category === "LABOUR" ? "labour " : ""}cutover. BuildSmart is only valid up to ${finalValidDate
        .toISOString()
        .slice(0, 10)}.`,
      category,
    };
  }

  /**
   * Secondary boundary check.
   *
   * This explicitly enforces the final BuildSmart timestamp per category.
   */
  const finalValidDate =
    category === "LABOUR" ? labourLastValidDate : BUILDSMART_LAST_DATE;

  if (transactionDate > finalValidDate) {
    return {
      row,
      status: "INVALID_ROW",
      reason: `Date ${transactionDate
        .toISOString()
        .slice(0, 10)} is after the final BuildSmart ${category === "LABOUR" ? "labour " : ""}date of ${finalValidDate
        .toISOString()
        .slice(0, 10)}`,
      category,
    };
  }

  const siteId = siteMap.get(normalizedSiteCode);

  if (!siteId) {
    return {
      row,
      status: "MISSING_SITE",
      reason: `Site code "${normalizedSiteCode}" was not found`,
      category,
    };
  }

  /**
   * Skip BuildSmart rows where the PO already exists in the live order
   * tables or has already been captured as historical material.
   */
  if (
    normalizedOrderNumber &&
    isOrderReferenceTaken(existingOrderRefs, normalizedOrderNumber)
  ) {
    return {
      row,
      status: "DUPLICATE_ORDER",
      reason: `PO ${normalizedOrderNumber} already exists in PDF Orders or Historical Materials`,
      category,
      siteId,
    };
  }

  /**
   * Check for a previously imported BuildSmart transaction using:
   *
   * - site
   * - source
   * - external reference
   * - ledger code
   *
   * Including siteId avoids treating the same payroll or batch reference
   * used on different sites as one duplicate.
   */
  if (normalizedExternalRef) {
    const existingExternalReference = await prisma.historicalSiteCost.findFirst(
      {
        where: {
          siteId,
          source: "BUILDSMART",
          externalRef: normalizedExternalRef,
          ledgerCode: normalizedLedgerCode,
        },
        select: {
          id: true,
        },
      },
    );

    if (existingExternalReference) {
      return {
        row,
        status: "DUPLICATE_IMPORTED",
        reason:
          "Already imported using the same site, external reference and ledger code",
        category,
        siteId,
      };
    }
  }

  /**
   * Fallback duplicate protection for rows without a reliable externalRef.
   */
  const exactMatch = await prisma.historicalSiteCost.findFirst({
    where: {
      siteId,
      source: "BUILDSMART",
      ledgerCode: normalizedLedgerCode,
      transactionDate,
      amount,
    },
    select: {
      id: true,
    },
  });

  if (exactMatch) {
    return {
      row,
      status: "DUPLICATE_IMPORTED",
      reason:
        "Already imported using the same site, ledger code, transaction date and amount",
      category,
      siteId,
    };
  }

  /**
   * This safeguard is normally unreachable because rows from the app
   * cutover date (per category) are rejected above.
   *
   * It is retained in case the permitted BuildSmart window is extended
   * later without removing overlap protection.
   */
  if (transactionDate >= cutoverDate) {
    const overlaps = await appRecordExists(
      siteId,
      category,
      transactionDate,
      amount,
    );

    if (overlaps) {
      return {
        row,
        status: "DUPLICATE_EXISTING_APP",
        reason:
          "Similar record found in the live app within ±14 days and ±15% of the amount",
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
      transactionDate,
      externalRef: normalizedExternalRef,
      batchRef: normalizedBatchRef,
      ledgerCode: normalizedLedgerCode,
      description: normalizedDescription ?? ledgerLabel(normalizedLedgerCode),
      amount,
    },
  });

  /**
   * Add the imported order reference to the in-memory set immediately.
   *
   * This stops duplicate PO rows contained in the same upload from being
   * imported more than once.
   */
  if (normalizedOrderNumber) {
    existingOrderRefs.add(normalizedOrderNumber);
  }

  return {
    row,
    status: "NEW_HISTORICAL",
    category,
    siteId,
  };
}

/**
 * Loads all required lookup information once before processing rows.
 */
async function loadImportContext(rows: BuildSmartRow[]): Promise<{
  siteMap: Map<string, string>;
  existingOrderRefs: Set<string>;
}> {
  const siteCodes = [
    ...new Set(
      rows
        .map((row) => row.siteCode?.trim())
        .filter((siteCode): siteCode is string => Boolean(siteCode)),
    ),
  ];

  const sites = await prisma.site.findMany({
    where: {
      code: {
        in: siteCodes,
      },
    },
    select: {
      id: true,
      code: true,
    },
  });

  const siteMap = new Map<string, string>();

  for (const site of sites) {
    if (site.code) {
      siteMap.set(site.code.trim(), site.id);
    }
  }

  const existingOrderRefs = await loadExistingOrderReferences();

  return {
    siteMap,
    existingOrderRefs,
  };
}

export interface ImportOptions {
  /**
   * The date used to resolve the current fortnight for the labour cutover
   * boundary (see resolveLabourCutover). Defaults to now. Pass an explicit
   * date to make an import deterministic/reproducible regardless of when
   * it's actually run.
   */
  asOfDate?: Date;
}

/**
 * Imports all supplied BuildSmart rows and returns the completed results.
 */
export async function importBuildSmartRows(
  rows: BuildSmartRow[],
  options: ImportOptions = {},
): Promise<ImportResult[]> {
  if (rows.length === 0) {
    return [];
  }

  const asOfDate = options.asOfDate ?? new Date();
  const { cutoverDate: labourCutoverDate, lastValidDate: labourLastValidDate } =
    await resolveLabourCutover(asOfDate);

  const results: ImportResult[] = [];

  const { siteMap, existingOrderRefs } = await loadImportContext(rows);

  for (const row of rows) {
    const result = await processBuildSmartRow(
      row,
      siteMap,
      existingOrderRefs,
      labourCutoverDate,
      labourLastValidDate,
    );

    results.push(result);
  }

  return results;
}

/**
 * Imports BuildSmart rows one at a time and yields progress after every row.
 */
export async function* importBuildSmartRowsStream(
  rows: BuildSmartRow[],
  options: ImportOptions = {},
): AsyncGenerator<
  {
    total: number;
    done: number;
    result: ImportResult;
  },
  void,
  unknown
> {
  if (rows.length === 0) {
    return;
  }

  const asOfDate = options.asOfDate ?? new Date();
  const { cutoverDate: labourCutoverDate, lastValidDate: labourLastValidDate } =
    await resolveLabourCutover(asOfDate);

  const { siteMap, existingOrderRefs } = await loadImportContext(rows);

  let done = 0;

  for (const row of rows) {
    const result = await processBuildSmartRow(
      row,
      siteMap,
      existingOrderRefs,
      labourCutoverDate,
      labourLastValidDate,
    );

    done += 1;

    yield {
      total: rows.length,
      done,
      result,
    };
  }
}
