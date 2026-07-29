/**
 * Backfill `SiteProductOrderItem.rawDescription` (and `SitePaintColor`) for
 * orders that were seeded by buildsmartMaterialOrderImporter.ts BEFORE it
 * started persisting the per-line source text.
 *
 * Root cause of the bad data: SiteProductOrderItem only ever stored a
 * `productId` FK. Tint-base SKUs (e.g. TMX00105020L, TLS001000) are shared
 * across many different final colors, so every order using that SKU pointed
 * at the SAME ProcurementProduct row, and the UI displayed that shared
 * product's `name` — whichever description happened to create the row first
 * — instead of what was actually ordered on each specific line.
 *
 * This script re-parses the ORIGINAL source PDF(s) (the same "Detail
 * Contract Cost Report" files the orders were originally seeded from), and
 * for each DEL-batch material line, re-derives the correct per-line
 * description and matches it back onto the existing order/item that was
 * created from it — WITHOUT creating any new orders or items.
 *
 * Matching strategy:
 *   1. Group parsed lines by (siteCode, orderNumber) — identical grouping to
 *      buildGroupsAndSiteMap() in buildsmartMaterialOrderImporter.ts.
 *   2. Find the existing SiteProductOrder by site + reference. Only orders
 *      with note "Seeded from BuildSmart historical cost report" are
 *      touched, so a manually created order sharing a reference number by
 *      coincidence is never modified.
 *   3. Require the existing item count to exactly match the freshly parsed
 *      line count for that order — if it doesn't, the order is skipped and
 *      reported instead of guessed at.
 *   4. Pair items[i] with parsedLines[i], in (createdAt, id) order, which is
 *      the closest available proxy for original insertion order (items were
 *      created sequentially, in file order, inside one transaction).
 *   5. Only ever SET rawDescription where it is currently NULL — never
 *      overwrites data. Re-running this script is always safe.
 *
 * Usage:
 *   tsx scripts/backfill-order-item-raw-descriptions.ts <file...> [--apply] [--site CODE]
 *
 *   <file...>   One or more "Detail Contract Cost Report" PDFs, or .txt
 *               files containing already-extracted report text.
 *   --apply     Without this flag the script only prints a dry-run report.
 *   --site      Optional: restrict to a single site code (e.g. --site 6317).
 */
import "dotenv/config";

import fs from "node:fs";
import path from "node:path";

import { prisma } from "../lib/prisma";
import {
  parseCostReportBuffer,
  parseCostReportText,
  type ParsedMaterialLine,
} from "../lib/buildsmart-cost-parser";
import { parseBuildSmartProduct } from "../lib/product-color-parser";

const SEEDED_NOTE = "Seeded from BuildSmart historical cost report";

function normalizeSiteCode(value: string): string {
  return value.replace(/\s+/g, " ").trim().toUpperCase();
}

function normalizeOrderNumber(value: string | null): string | null {
  const normalized = value
    ? value
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^PO[\s:#-]*/i, "")
        .replace(/\s+/g, "")
        .toUpperCase()
    : "";

  return normalized || null;
}

type MaterialLineWithSite = ParsedMaterialLine & {
  siteCode: string;
  orderNumber: string | null;
};

function groupBySiteAndOrder(
  lines: MaterialLineWithSite[],
): Map<string, MaterialLineWithSite[]> {
  const groups = new Map<string, MaterialLineWithSite[]>();

  for (const line of lines) {
    const key = `${line.siteCode}::${line.orderNumber ?? "__NO_ORDER__"}`;
    const arr = groups.get(key) ?? [];
    arr.push(line);
    groups.set(key, arr);
  }

  return groups;
}

async function loadReportLines(
  filePath: string,
): Promise<MaterialLineWithSite[]> {
  const ext = path.extname(filePath).toLowerCase();

  const report =
    ext === ".txt"
      ? parseCostReportText(fs.readFileSync(filePath, "utf8"))
      : await parseCostReportBuffer(fs.readFileSync(filePath));

  for (const warning of report.warnings) {
    console.warn(`  [warn] ${path.basename(filePath)}: ${warning}`);
  }

  return report.materialLines.map((line) => ({
    ...line,
    siteCode: normalizeSiteCode(line.siteCode),
    orderNumber: normalizeOrderNumber(line.orderNumber),
  }));
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");

  const siteFlagIndex = args.indexOf("--site");
  const siteFilter =
    siteFlagIndex !== -1
      ? normalizeSiteCode(args[siteFlagIndex + 1] ?? "")
      : null;

  const files = args.filter(
    (a, i) =>
      !a.startsWith("--") &&
      !(siteFlagIndex !== -1 && i === siteFlagIndex + 1),
  );

  if (files.length === 0) {
    console.error(
      "Usage: tsx scripts/backfill-order-item-raw-descriptions.ts <file...> [--apply] [--site CODE]",
    );
    process.exit(1);
  }

  console.log(`Mode: ${apply ? "APPLY" : "DRY_RUN"}`);
  if (siteFilter) console.log(`Site filter: ${siteFilter}`);

  let allLines: MaterialLineWithSite[] = [];
  for (const file of files) {
    console.log(`Parsing ${file}...`);
    const lines = await loadReportLines(file);
    allLines = allLines.concat(lines);
  }

  if (siteFilter) {
    allLines = allLines.filter((l) => l.siteCode === siteFilter);
  }

  const groups = groupBySiteAndOrder(allLines);
  console.log(`Parsed ${allLines.length} material line(s) in ${groups.size} order group(s).`);

  let matchedOrders = 0;
  let updatedItems = 0;
  let createdColors = 0;
  let skippedNoOrder = 0;
  let skippedNotSeeded = 0;
  let skippedCountMismatch = 0;
  let skippedAlreadyBackfilled = 0;

  for (const [key, groupLines] of groups) {
    const [siteCode, orderNumber] = key.split("::");
    if (!orderNumber || orderNumber === "__NO_ORDER__") continue;

    const site = await prisma.site.findUnique({
      where: { code: siteCode },
      select: { id: true, name: true },
    });

    if (!site) {
      console.log(`  [skip] ${key}: no site found for code ${siteCode}`);
      skippedNoOrder += 1;
      continue;
    }

    const order = await prisma.siteProductOrder.findFirst({
      where: { siteId: site.id, reference: orderNumber },
      select: {
        id: true,
        note: true,
        items: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: { id: true, rawDescription: true, productId: true },
        },
      },
    });

    if (!order) {
      console.log(`  [skip] ${key}: no matching SiteProductOrder`);
      skippedNoOrder += 1;
      continue;
    }

    if (order.note !== SEEDED_NOTE) {
      console.log(
        `  [skip] ${key}: order ${order.id} note is not "${SEEDED_NOTE}" — refusing to touch a non-historical-import order`,
      );
      skippedNotSeeded += 1;
      continue;
    }

    if (order.items.length !== groupLines.length) {
      console.log(
        `  [skip] ${key}: item count mismatch (DB has ${order.items.length}, PDF has ${groupLines.length}) — cannot confidently pair lines`,
      );
      skippedCountMismatch += 1;
      continue;
    }

    matchedOrders += 1;

    const pending: {
      itemId: string;
      productId: string;
      description: string;
    }[] = [];

    for (let i = 0; i < order.items.length; i++) {
      const item = order.items[i];
      const line = groupLines[i];

      if (item.rawDescription) {
        skippedAlreadyBackfilled += 1;
        continue;
      }

      pending.push({
        itemId: item.id,
        productId: item.productId,
        description: line.description,
      });
    }

    if (pending.length === 0) continue;

    console.log(
      `  [match] ${key}: order ${order.id} — ${pending.length} item(s) to backfill`,
    );

    for (const p of pending) {
      console.log(`      ${p.itemId} -> "${p.description}"`);
    }

    if (!apply) continue;

    await prisma.$transaction(async (tx) => {
      for (const p of pending) {
        await tx.siteProductOrderItem.update({
          where: { id: p.itemId },
          data: { rawDescription: p.description },
        });
        updatedItems += 1;

        const { colorName, colorCode, baseType, isTinted } =
          parseBuildSmartProduct(p.description);

        if (!colorName) continue;

        const existingColor = await tx.sitePaintColor.findFirst({
          where: { sourceOrderItemId: p.itemId },
          select: { id: true },
        });

        if (existingColor) continue;

        await tx.sitePaintColor.create({
          data: {
            siteId: site.id,
            productId: p.productId,
            sourceOrderId: order.id,
            sourceOrderItemId: p.itemId,
            orderReference: orderNumber,
            rawDescription: p.description,
            colorName,
            colorCode: colorCode ?? undefined,
            baseType,
            isTinted,
          },
        });
        createdColors += 1;
      }
    });
  }

  console.log("\n── Summary ──");
  console.log(`Matched orders:            ${matchedOrders}`);
  console.log(`Items already backfilled:  ${skippedAlreadyBackfilled}`);
  console.log(`Items updated:             ${apply ? updatedItems : "(dry run)"}`);
  console.log(`SitePaintColor rows added: ${apply ? createdColors : "(dry run)"}`);
  console.log(`Skipped (no order found):  ${skippedNoOrder}`);
  console.log(`Skipped (not historical):  ${skippedNotSeeded}`);
  console.log(`Skipped (count mismatch):  ${skippedCountMismatch}`);

  if (!apply) {
    console.log("\nDry run only — re-run with --apply to write changes.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
