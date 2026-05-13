/**
 * migrate-color-variants.ts
 *
 * One-shot migration script that:
 *   1. Scans all ProcurementProduct records
 *   2. Parses each name with parseBuildSmartProduct (improved parser)
 *   3. Cleans polluted names (prices, SKUs, noise) → updates product.name
 *   4. Assigns parsed SKU to product.sku if it is currently empty
 *   5. Creates ProductColorVariant records for any detected color
 *   6. Identifies products whose normalized names collide → safe-merge candidates
 *
 * This script is NON-DESTRUCTIVE:
 *   - It never deletes a ProcurementProduct
 *   - It never moves orderItems, supplierPrices, or variantStocks
 *   - Duplicate products are listed in the output as MERGE CANDIDATES
 *     but NOT merged automatically — a human must review them first
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/migrate-color-variants.ts
 *
 * Or with tsx:
 *   npx tsx scripts/migrate-color-variants.ts
 */

import "dotenv/config";
import { prisma } from "@/lib/prisma";
import {
  parseBuildSmartProduct,
  normalizeProductName,
  canMergeColorVariants,
} from "@/lib/product-color-parser";

// ── helpers ──────────────────────────────────────────────────────────────────

function log(msg: string) {
  process.stdout.write(msg + "\n");
}

function logSection(title: string) {
  log(`\n${"─".repeat(60)}`);
  log(title);
  log("─".repeat(60));
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  log("Starting color variant migration…");

  // ── 1. Load all products ─────────────────────────────────────────────────
  const products = await prisma.procurementProduct.findMany({
    select: { id: true, name: true, sku: true },
    orderBy: { name: "asc" },
  });
  log(`Loaded ${products.length} products`);

  // Existing color variants (to avoid duplicates)
  const existingVariants = await prisma.productColorVariant.findMany({
    select: { id: true, productId: true, colorName: true, baseType: true },
  });
  const variantKey = (productId: string, colorName: string, baseType: string) =>
    `${productId}::${colorName.toLowerCase()}::${baseType}`;
  const existingVariantKeys = new Set(
    existingVariants.map((v) => variantKey(v.productId, v.colorName, v.baseType)),
  );

  // SKU ownership map
  const skuOwner = new Map<string, string>();
  for (const p of products) {
    if (p.sku) skuOwner.set(p.sku, p.id);
  }

  // ── 2. Parse every product ───────────────────────────────────────────────
  const stats = {
    scanned: products.length,
    nameUpdated: 0,
    skuSet: 0,
    variantsCreated: 0,
    variantsAlreadyExist: 0,
    skipped: 0,
    errors: 0,
  };

  const nameChanges: { id: string; before: string; after: string }[] = [];
  const variantChanges: {
    productId: string;
    productName: string;
    colorName: string;
    baseType: string;
    isTinted: boolean;
  }[] = [];

  // Normalized-name → productId[] map for duplicate detection
  const byNormalizedName = new Map<string, string[]>();

  for (const product of products) {
    const parsed = parseBuildSmartProduct(product.name);
    const { cleanName, sku: parsedSku, colorName, baseType, isTinted } = parsed;

    const normalized = normalizeProductName(cleanName || product.name);
    const existing = byNormalizedName.get(normalized) ?? [];
    existing.push(product.id);
    byNormalizedName.set(normalized, existing);

    let didSomething = false;

    try {
      // ── Name update ────────────────────────────────────────────────────
      const nameChanged = cleanName.length > 0 && cleanName !== product.name;
      let newSku = product.sku;

      if (!product.sku && parsedSku) {
        const owner = skuOwner.get(parsedSku);
        if (!owner || owner === product.id) {
          newSku = parsedSku;
          skuOwner.set(parsedSku, product.id);
        }
      }
      const skuChanged = newSku !== product.sku;

      if (nameChanged || skuChanged) {
        await prisma.procurementProduct.update({
          where: { id: product.id },
          data: {
            ...(nameChanged ? { name: cleanName } : {}),
            ...(skuChanged ? { sku: newSku } : {}),
          },
        });
        if (nameChanged) {
          stats.nameUpdated++;
          nameChanges.push({ id: product.id, before: product.name, after: cleanName });
        }
        if (skuChanged) stats.skuSet++;
        didSomething = true;
      }

      // ── Color variant creation ──────────────────────────────────────────
      if (colorName) {
        const key = variantKey(product.id, colorName, baseType);
        if (existingVariantKeys.has(key)) {
          stats.variantsAlreadyExist++;
        } else {
          await prisma.productColorVariant.create({
            data: { productId: product.id, colorName, baseType, isTinted },
          });
          existingVariantKeys.add(key);
          stats.variantsCreated++;
          variantChanges.push({
            productId: product.id,
            productName: cleanName || product.name,
            colorName,
            baseType,
            isTinted,
          });
          didSomething = true;
        }
      }

      if (!didSomething) stats.skipped++;
    } catch (err) {
      stats.errors++;
      log(`  ERROR on product ${product.id} ("${product.name}"): ${err}`);
    }
  }

  // ── 3. Report ────────────────────────────────────────────────────────────
  logSection("SUMMARY");
  log(`  Products scanned:        ${stats.scanned}`);
  log(`  Names cleaned:           ${stats.nameUpdated}`);
  log(`  SKUs assigned:           ${stats.skuSet}`);
  log(`  Variants created:        ${stats.variantsCreated}`);
  log(`  Variants already existed:${stats.variantsAlreadyExist}`);
  log(`  Products unchanged:      ${stats.skipped}`);
  log(`  Errors:                  ${stats.errors}`);

  if (nameChanges.length > 0) {
    logSection("NAME CHANGES (first 40)");
    for (const c of nameChanges.slice(0, 40)) {
      log(`  [${c.id}]`);
      log(`    BEFORE: ${c.before}`);
      log(`    AFTER:  ${c.after}`);
    }
    if (nameChanges.length > 40) {
      log(`  … and ${nameChanges.length - 40} more`);
    }
  }

  if (variantChanges.length > 0) {
    logSection("COLOR VARIANTS CREATED (first 40)");
    for (const v of variantChanges.slice(0, 40)) {
      log(`  Product: "${v.productName}" (${v.productId})`);
      log(`    → colorName="${v.colorName}"  baseType=${v.baseType}  isTinted=${v.isTinted}`);
    }
    if (variantChanges.length > 40) {
      log(`  … and ${variantChanges.length - 40} more`);
    }
  }

  // ── 4. Detect merge candidates ───────────────────────────────────────────
  const mergeCandidates: { normalizedName: string; productIds: string[] }[] = [];
  for (const [norm, ids] of byNormalizedName) {
    if (ids.length > 1) mergeCandidates.push({ normalizedName: norm, productIds: ids });
  }

  if (mergeCandidates.length > 0) {
    logSection(`MERGE CANDIDATES — ${mergeCandidates.length} groups (review manually before merging)`);
    for (const group of mergeCandidates) {
      log(`  Normalized: "${group.normalizedName}"`);
      for (const id of group.productIds) {
        const p = products.find((x) => x.id === id)!;
        log(`    [${id}] "${p.name}"`);
      }
    }
  } else {
    logSection("No merge candidates found");
  }

  log("\nMigration complete.");
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
