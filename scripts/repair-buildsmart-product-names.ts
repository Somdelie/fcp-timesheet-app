/**
 * Repair existing BuildSmart product names/colours in the DB using the fixed
 * parsing/matching logic (see lib/product-color-parser.ts,
 * lib/procurement/buildsmartProductMatcher.ts,
 * lib/procurement/buildsmartMaterialOrderImporter.ts).
 *
 * Groups ProcurementProduct / MasterCatalogueProduct rows by corrected
 * identity, merges true duplicates onto one surviving row (reassigning every
 * reference, then deactivating the duplicate — never hard-deleting a product
 * row), applies the corrected name/sku, and merges ProductColorVariant rows
 * the same way.
 *
 * Defaults to a read-only DRY RUN that prints a full report. Pass --apply to
 * actually write changes.
 *
 *   npx tsx scripts/repair-buildsmart-product-names.ts            (dry run)
 *   npx tsx scripts/repair-buildsmart-product-names.ts --apply    (writes)
 */
import "dotenv/config";

import { prisma } from "../lib/prisma";
import { parseBuildSmartProduct } from "../lib/product-color-parser";
import { getCanonicalFamily } from "../lib/procurement/buildsmartProductMatcher";
import {
  normalizeCatalogueName,
  extractBaseLabel,
  normalizeBaseName,
} from "../lib/procurement/buildsmartMaterialOrderImporter";

const APPLY = process.argv.includes("--apply");

// ── Reporting ─────────────────────────────────────────────────────────────

const report = {
  procurementGroups: 0,
  procurementDupesDeactivated: 0,
  masterGroups: 0,
  masterDupesDeactivated: 0,
  colorVariantGroups: 0,
  colorVariantDupesDeleted: 0,
  colorVariantsPreserved: 0,
  basesPreserved: 0,
  reassignedByTable: new Map<string, number>(),
  renamedSamples: [] as { from: string; to: string }[],
  manualReview: [] as string[],
};

function bump(table: string, n: number) {
  if (n <= 0) return;
  report.reassignedByTable.set(table, (report.reassignedByTable.get(table) ?? 0) + n);
}

// ── Corrected identity helpers ───────────────────────────────────────────

function correctedIdentity(name: string, supplierName: string | null) {
  const family = getCanonicalFamily(name, supplierName);
  const parsed = parseBuildSmartProduct(name);
  // Only let a canonical family override the name for genuinely
  // one-product-many-variants families (BASE_TINTABLE). Broad brand-level
  // families (e.g. "Plascon Velvaglo") are matching hints, not authoritative
  // names — using them here would merge distinct products (Velvaglo Satin
  // vs Velvaglo Non-Drip) into one.
  const correctedName = (
    (family?.kind === "BASE_TINTABLE" ? family.canonicalName : null) ??
    parsed.cleanName ??
    name
  ).trim();
  return {
    correctedName,
    normalizedName: normalizeCatalogueName(correctedName),
    family,
  };
}

/**
 * The variant this specific row's original name represents — a base label
 * for BASE_TINTABLE families, otherwise the parsed colour name, falling back
 * to the base-type keyword itself (White/Pastel/Clear/Neutral) when that's
 * all that was found. Mirrors resolveProduct()'s logic in
 * buildsmartMaterialOrderImporter.ts so merges don't lose what a rename would
 * otherwise discard.
 */
function rowVariant(name: string, familyKind: "BASE_TINTABLE" | "PRETINTED" | undefined) {
  const parsed = parseBuildSmartProduct(name);
  const baseLabel = familyKind === "BASE_TINTABLE" ? extractBaseLabel(name) : null;
  const colorName =
    (familyKind === "BASE_TINTABLE" ? (baseLabel ?? parsed.colorName) : parsed.colorName) ??
    (parsed.baseType !== "DEEP"
      ? parsed.baseType.charAt(0) + parsed.baseType.slice(1).toLowerCase()
      : null);
  return { colorName, baseType: parsed.baseType, baseLabel };
}

// Tables (other than ProductColorVariant, handled separately) that carry a
// direct FK to ProcurementProduct.
const PROCUREMENT_RELATIONS: {
  table: string;
  field: string;
  model: keyof typeof prisma;
}[] = [
  { table: "SupplierProductPrice", field: "productId", model: "supplierProductPrice" },
  { table: "SitePaintColor", field: "productId", model: "sitePaintColor" },
  { table: "SiteProductOrderItem", field: "productId", model: "siteProductOrderItem" },
  { table: "SiteMaterial", field: "productId", model: "siteMaterial" },
  {
    table: "SiteFinishingScheduleItem",
    field: "procurementProductId",
    model: "siteFinishingScheduleItem",
  },
  {
    table: "ProcurementProductCoverage",
    field: "productId",
    model: "procurementProductCoverage",
  },
  {
    table: "ProcurementProductPackSize",
    field: "productId",
    model: "procurementProductPackSize",
  },
  { table: "SitePaintPlan", field: "productId", model: "sitePaintPlan" },
  { table: "SitePlantAssignment", field: "productId", model: "sitePlantAssignment" },
  { table: "ForemanPpeOrderItem", field: "productId", model: "foremanPpeOrderItem" },
  { table: "PlantTransfer", field: "productId", model: "plantTransfer" },
  { table: "ProductVariantStock", field: "productId", model: "productVariantStock" },
];

/**
 * Move every row referencing `fromId` in each relation table onto `toId`.
 * Tries a bulk updateMany first; if that trips a unique constraint, falls
 * back to per-row updates so a single colliding row doesn't block the rest
 * (the colliding row is logged under manual review instead).
 */
async function reassignProcurementReferences(
  fromId: string,
  toId: string,
  label: string,
) {
  for (const rel of PROCUREMENT_RELATIONS) {
    const model = prisma[rel.model] as any;
    const rows = await model.findMany({
      where: { [rel.field]: fromId },
      select: { id: true },
    });
    if (rows.length === 0) continue;

    if (!APPLY) {
      bump(rel.table, rows.length);
      continue;
    }

    try {
      const result = await model.updateMany({
        where: { [rel.field]: fromId },
        data: { [rel.field]: toId },
      });
      bump(rel.table, result.count);
    } catch {
      let moved = 0;
      for (const row of rows) {
        try {
          await model.update({
            where: { id: row.id },
            data: { [rel.field]: toId },
          });
          moved++;
        } catch {
          report.manualReview.push(
            `${label}: ${rel.table} row ${row.id} could not be reassigned from ${fromId} to ${toId} (unique constraint) — left pointing at the deactivated duplicate.`,
          );
        }
      }
      bump(rel.table, moved);
    }
  }
}

// ── Phase A: ProcurementProduct merge ────────────────────────────────────

async function mergeProcurementProducts() {
  const products = await prisma.procurementProduct.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      sku: true,
      normalizedName: true,
      supplierId: true,
      masterCatalogueProductId: true,
      createdAt: true,
      supplier: { select: { name: true } },
      _count: { select: { orderItems: true } },
    },
  });

  type P = (typeof products)[number];
  const groups = new Map<string, P[]>();

  for (const p of products) {
    const { normalizedName } = correctedIdentity(p.name, p.supplier?.name ?? null);
    const key = `${p.supplierId ?? "none"}::${normalizedName}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  const survivorIds = new Map<string, string>(); // old procurementProduct id -> survivor id (identity map for dupes too)

  for (const group of groups.values()) {
    if (group.length === 0) continue;

    const survivor = [...group].sort((a, b) => {
      if (b._count.orderItems !== a._count.orderItems)
        return b._count.orderItems - a._count.orderItems;
      return a.createdAt.getTime() - b.createdAt.getTime();
    })[0];

    survivorIds.set(survivor.id, survivor.id);

    const { correctedName, family } = correctedIdentity(
      survivor.name,
      survivor.supplier?.name ?? null,
    );
    const correctedNormalized = normalizeCatalogueName(correctedName);

    if (correctedName !== survivor.name) {
      report.renamedSamples.push({ from: survivor.name, to: correctedName });
    }

    if (APPLY) {
      await prisma.procurementProduct.update({
        where: { id: survivor.id },
        data: { name: correctedName, normalizedName: correctedNormalized },
      });
    }

    const dupes = group.filter((p) => p.id !== survivor.id);
    if (dupes.length > 0) report.procurementGroups++;

    // Before collapsing rows onto the survivor, capture whatever colour/base
    // each original row's name represented — otherwise a rename that strips
    // "White"/"Base 6"/etc silently loses that distinction.
    for (const row of group) {
      const variant = rowVariant(row.name, family?.kind);
      if (!variant.colorName) continue;

      if (!APPLY) {
        report.colorVariantsPreserved++;
        continue;
      }

      const existing = await prisma.productColorVariant.findFirst({
        where: {
          productId: survivor.id,
          colorName: { equals: variant.colorName, mode: "insensitive" },
          baseType: variant.baseType,
        },
        select: { id: true },
      });
      if (!existing) {
        await prisma.productColorVariant.create({
          data: {
            productId: survivor.id,
            colorName: variant.colorName,
            baseType: variant.baseType,
            isTinted: true,
          },
        });
      }
      report.colorVariantsPreserved++;
    }

    for (const dupe of dupes) {
      survivorIds.set(dupe.id, survivor.id);
      await reassignProcurementReferences(
        dupe.id,
        survivor.id,
        `ProcurementProduct "${dupe.name}" -> "${survivor.name}"`,
      );

      if (APPLY) {
        await prisma.procurementProduct.update({
          where: { id: dupe.id },
          data: { isActive: false },
        });
      }
      report.procurementDupesDeactivated++;
    }
  }

  return survivorIds;
}

// ── ProductColorVariant merge (run after ProcurementProduct merge, per surviving product) ──

async function mergeColorVariants(procurementProductIds: string[]) {
  for (const productId of procurementProductIds) {
    const variants = await prisma.productColorVariant.findMany({
      where: { productId },
      select: {
        id: true,
        colorName: true,
        colorCode: true,
        baseType: true,
        _count: { select: { sitePaintColors: true, supplierPrices: true } },
      },
    });
    if (variants.length < 2) continue;

    const groups = new Map<string, typeof variants>();
    for (const v of variants) {
      const key = `${normalizeCatalogueName(v.colorName)}::${v.baseType}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(v);
    }

    for (const group of groups.values()) {
      if (group.length < 2) continue;
      report.colorVariantGroups++;

      const survivor = [...group].sort(
        (a, b) =>
          b._count.sitePaintColors +
          b._count.supplierPrices -
          (a._count.sitePaintColors + a._count.supplierPrices),
      )[0];

      for (const dupe of group) {
        if (dupe.id === survivor.id) continue;

        if (!APPLY) {
          bump("ProductColorVariant.SupplierProductPrice", dupe._count.supplierPrices);
          bump("ProductColorVariant.SitePaintColor", dupe._count.sitePaintColors);
          report.colorVariantDupesDeleted++;
          continue;
        }

        await prisma.supplierProductPrice.updateMany({
          where: { colorVariantId: dupe.id },
          data: { colorVariantId: survivor.id },
        });
        await prisma.sitePaintColor.updateMany({
          where: { colorVariantId: dupe.id },
          data: { colorVariantId: survivor.id },
        });
        await prisma.productColorVariant.delete({ where: { id: dupe.id } });
        report.colorVariantDupesDeleted++;
      }
    }
  }
}

// ── Phase B: MasterCatalogueProduct merge ────────────────────────────────

async function mergeMasterCatalogueProducts(
  procurementSurvivorIds: Map<string, string>,
) {
  const products = await prisma.masterCatalogueProduct.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      normalizedName: true,
      supplierId: true,
      createdAt: true,
      supplier: { select: { name: true } },
      legacyProcurementProduct: {
        select: { id: true, _count: { select: { orderItems: true } } },
      },
    },
  });

  type M = (typeof products)[number];
  const groups = new Map<string, M[]>();

  for (const p of products) {
    const { normalizedName } = correctedIdentity(p.name, p.supplier?.name ?? null);
    const key = `${p.supplierId}::${normalizedName}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  for (const group of groups.values()) {
    if (group.length === 0) continue;

    const survivor = [...group].sort((a, b) => {
      const ao = a.legacyProcurementProduct?._count.orderItems ?? 0;
      const bo = b.legacyProcurementProduct?._count.orderItems ?? 0;
      if (bo !== ao) return bo - ao;
      return a.createdAt.getTime() - b.createdAt.getTime();
    })[0];

    const { correctedName, family } = correctedIdentity(
      survivor.name,
      survivor.supplier?.name ?? null,
    );
    const correctedNormalized = normalizeCatalogueName(correctedName);

    if (correctedName !== survivor.name) {
      report.renamedSamples.push({ from: survivor.name, to: correctedName });
    }

    if (APPLY) {
      await prisma.masterCatalogueProduct.update({
        where: { id: survivor.id },
        data: { name: correctedName, normalizedName: correctedNormalized },
      });
    }

    // Preserve each original row's base label (Base 6/8/9, Transparent/Deep/
    // Pastel Base, ...) as a MasterProductBase on the survivor before it's
    // renamed away — only meaningful for BASE_TINTABLE families.
    if (family?.kind === "BASE_TINTABLE") {
      for (const row of group) {
        const baseLabel = extractBaseLabel(row.name);
        if (!baseLabel) continue;

        if (!APPLY) {
          report.basesPreserved++;
          continue;
        }

        const normalizedBaseName = normalizeBaseName(baseLabel);
        const existing = await prisma.masterProductBase.findUnique({
          where: {
            productId_normalizedName: {
              productId: survivor.id,
              normalizedName: normalizedBaseName,
            },
          },
          select: { id: true },
        });
        if (!existing) {
          await prisma.masterProductBase.create({
            data: {
              productId: survivor.id,
              name: baseLabel,
              normalizedName: normalizedBaseName,
            },
          });
        }
        report.basesPreserved++;
      }
    }

    const dupes = group.filter((p) => p.id !== survivor.id);
    if (dupes.length > 0) report.masterGroups++;

    for (const dupe of dupes) {
      // Bases / finishes / prices
      const bases = await prisma.masterProductBase.findMany({
        where: { productId: dupe.id },
        select: { id: true, name: true, normalizedName: true },
      });
      for (const base of bases) {
        const existing = await prisma.masterProductBase.findFirst({
          where: { productId: survivor.id, normalizedName: base.normalizedName },
          select: { id: true },
        });
        if (!APPLY) {
          bump("MasterProductBase", 1);
          continue;
        }
        if (existing) {
          await prisma.masterProductPrice.updateMany({
            where: { baseId: base.id },
            data: { baseId: existing.id },
          });
          await prisma.masterProductBase.delete({ where: { id: base.id } });
        } else {
          await prisma.masterProductBase.update({
            where: { id: base.id },
            data: { productId: survivor.id },
          });
        }
        bump("MasterProductBase", 1);
      }

      const finishes = await prisma.masterProductFinish.findMany({
        where: { productId: dupe.id },
        select: { id: true, normalizedName: true },
      });
      for (const finish of finishes) {
        const existing = await prisma.masterProductFinish.findFirst({
          where: { productId: survivor.id, normalizedName: finish.normalizedName },
          select: { id: true },
        });
        if (!APPLY) {
          bump("MasterProductFinish", 1);
          continue;
        }
        if (existing) {
          await prisma.masterProductPrice.updateMany({
            where: { finishId: finish.id },
            data: { finishId: existing.id },
          });
          await prisma.masterProductFinish.delete({ where: { id: finish.id } });
        } else {
          await prisma.masterProductFinish.update({
            where: { id: finish.id },
            data: { productId: survivor.id },
          });
        }
        bump("MasterProductFinish", 1);
      }

      const remainingPrices = await prisma.masterProductPrice.count({
        where: { productId: dupe.id },
      });
      bump("MasterProductPrice", remainingPrices);
      if (APPLY && remainingPrices > 0) {
        await prisma.masterProductPrice.updateMany({
          where: { productId: dupe.id },
          data: { productId: survivor.id },
        });
      }

      // Reconcile the bridged ProcurementProduct. By construction, Phase A
      // already merged any ProcurementProduct rows that share this same
      // corrected identity, so at most one active ProcurementProduct should
      // remain across the whole group.
      if (dupe.legacyProcurementProduct) {
        const mappedId =
          procurementSurvivorIds.get(dupe.legacyProcurementProduct.id) ??
          dupe.legacyProcurementProduct.id;
        if (APPLY) {
          const stillExists = await prisma.procurementProduct.findUnique({
            where: { id: mappedId },
            select: { id: true, masterCatalogueProductId: true },
          });
          if (stillExists && stillExists.masterCatalogueProductId !== survivor.id) {
            const conflict = await prisma.procurementProduct.findUnique({
              where: { masterCatalogueProductId: survivor.id },
              select: { id: true },
            });
            if (!conflict) {
              await prisma.procurementProduct.update({
                where: { id: mappedId },
                data: { masterCatalogueProductId: survivor.id },
              });
            } else if (conflict.id !== mappedId) {
              report.manualReview.push(
                `MasterCatalogueProduct "${dupe.name}": linked ProcurementProduct ${mappedId} could not be re-bridged to survivor ${survivor.id} — survivor already bridged to ${conflict.id}.`,
              );
            }
          }
        }
      }

      if (APPLY) {
        await prisma.masterCatalogueProduct.update({
          where: { id: dupe.id },
          data: { isActive: false },
        });
      }
      report.masterDupesDeactivated++;
    }
  }
}

// ── Base label backfill for BASE_TINTABLE survivors ──────────────────────

async function backfillBases() {
  const products = await prisma.masterCatalogueProduct.findMany({
    where: { isActive: true },
    select: { id: true, name: true, supplier: { select: { name: true } } },
  });

  let created = 0;
  for (const p of products) {
    const family = getCanonicalFamily(p.name, p.supplier?.name ?? null);
    if (family?.kind !== "BASE_TINTABLE") continue;

    const baseLabel = extractBaseLabel(p.name);
    if (!baseLabel) continue;

    const normalizedBaseName = normalizeBaseName(baseLabel);
    const existing = await prisma.masterProductBase.findUnique({
      where: {
        productId_normalizedName: { productId: p.id, normalizedName: normalizedBaseName },
      },
      select: { id: true },
    });
    if (existing) continue;

    created++;
    if (APPLY) {
      await prisma.masterProductBase.create({
        data: { productId: p.id, name: baseLabel, normalizedName: normalizedBaseName },
      });
    }
  }
  bump("MasterProductBase (backfilled)", created);
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY (writing changes)" : "DRY RUN (read-only)"}`);
  console.log("");

  const procurementSurvivorIds = await mergeProcurementProducts();
  await mergeColorVariants([...new Set(procurementSurvivorIds.values())]);
  await mergeMasterCatalogueProducts(procurementSurvivorIds);
  await backfillBases();

  console.log("=== Summary ===");
  console.log(`ProcurementProduct duplicate groups: ${report.procurementGroups}`);
  console.log(`ProcurementProduct rows deactivated: ${report.procurementDupesDeactivated}`);
  console.log(`MasterCatalogueProduct duplicate groups: ${report.masterGroups}`);
  console.log(`MasterCatalogueProduct rows deactivated: ${report.masterDupesDeactivated}`);
  console.log(`ProductColorVariant duplicate groups: ${report.colorVariantGroups}`);
  console.log(`ProductColorVariant rows deleted (post-reassignment): ${report.colorVariantDupesDeleted}`);
  console.log(`Colour variants preserved from merged rows: ${report.colorVariantsPreserved}`);
  console.log(`Base labels preserved from merged rows: ${report.basesPreserved}`);
  console.log("");
  console.log("Rows reassigned per relation table:");
  for (const [table, count] of [...report.reassignedByTable.entries()].sort()) {
    console.log(`  ${table}: ${count}`);
  }
  console.log("");
  console.log(`Sample renames (${Math.min(40, report.renamedSamples.length)} of ${report.renamedSamples.length}):`);
  for (const r of report.renamedSamples.slice(0, 40)) {
    console.log(`  "${r.from}" -> "${r.to}"`);
  }
  console.log("");
  console.log(`Needs manual review (${report.manualReview.length}):`);
  for (const m of report.manualReview.slice(0, 40)) {
    console.log(`  ${m}`);
  }

  if (!APPLY) {
    console.log("");
    console.log("Dry run only — re-run with --apply to write these changes.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
