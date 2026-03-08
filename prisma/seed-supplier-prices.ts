/**
 * Seed / Import script for ProcurementProduct + SupplierProductPrice rows.
 *
 * Usage:
 *   npx tsx prisma/seed-supplier-prices.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ProductUom } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// ─── Constants ───────────────────────────────────────────────────────────────

const PLASCON_SUPPLIER_ID = "cmmdxdol60009w8plpxqwnxct";
const DULUX_SUPPLIER_ID = "cmmeftzq4000009l2msbxss71";
const PAINTS_CATEGORY_ID = "cmmdxbuw40008w8plm4urs9ae";

const STARTS_ON = new Date("2026-03-01T00:00:00.000Z");

// ─── Types ───────────────────────────────────────────────────────────────────

type ImportRow = {
  name: string;
  sku?: string | null;
  supplierId: string;
  categoryId: string;
  variants: Array<{
    unitSize?: number | null;
    uom?: "L" | "KG" | null;
    price: number;
  }>;
};

type ManualReviewEntry = {
  row: ImportRow;
  reason: string;
};

// ─── Normalization ───────────────────────────────────────────────────────────

function normalizeSku(value: string | null | undefined): string {
  if (!value) return "";
  let s = value.toUpperCase().trim();
  // collapse repeated spaces
  s = s.replace(/\s{2,}/g, " ");

  // remove spaces around / and -
  s = s.replace(/\s*\/\s*/g, "/");
  s = s.replace(/\s*-\s*/g, "-");

  // standardize semicolons
  s = s.replace(/\s*;\s*/g, ";");

  // compact known letter+number codes: "SN 176" -> "SN176", "UC 2" -> "UC2", etc.
  // Pattern: 1-4 letters followed by a space then digits (optionally more letter suffix)
  // but NOT purely numeric family codes like "10 19 03"
  s = s.replace(/^([A-Z]{1,4})\s+(\d[\dA-Z]*)$/g, "$1$2");

  // Also handle within compound codes separated by /
  // e.g. transform each segment
  s = s.replace(/(?<=^|[/;])([A-Z]{1,4})\s+(\d[\dA-Z]*)(?=$|[/;])/g, "$1$2");

  // Handle "PEM 800" -> "PEM800", "PU 800" -> "PU800" etc inside longer strings
  // Use \b to avoid mangling mid-word like "TRADE 65" (5-letter word)
  s = s.replace(/\b([A-Z]{1,4})\s+(\d{2,})/g, "$1$2");

  // "PP 700" -> "PP700"
  s = s.replace(/\b([A-Z]{1,4})\s+(\d+)/g, "$1$2");

  return s;
}

function normalizeName(value: string): string {
  let s = value.toUpperCase().trim();
  // collapse multiple spaces
  s = s.replace(/\s{2,}/g, " ");

  // OCR / brochure fixes
  s = s.replace(/\bGENAMEL\b/g, "ENAMEL");
  s = s.replace(/\bMASSONARY\b/g, "MASONRY");
  s = s.replace(/\bMASSONRY\b/g, "MASONRY");
  s = s.replace(/\bMASONARY\b/g, "MASONRY");
  s = s.replace(/\bW\/BASE\b/g, "WATER-BASED");
  s = s.replace(/\bW\s+BASE\b/g, "WATER-BASED");

  return s;
}

/** Strip colour/tint suffixes for fuzzy matching only (not for saving). */
function nameForFuzzyMatch(name: string): string {
  let s = normalizeName(name);
  // remove trailing colour/tint descriptors
  s = s.replace(
    /\s*-\s*(WHITE|BLACK|PASTEL|DEEP|TRANSPARENT|GREY|RED OXIDE|RED|GREEN|TERRACOTTA|NAVY LIGHT GREY|CLEAR|YELLOW|KHAKI DAWN|SUPER WHITE|TAWNY MINK\s*\d*L?)$/g,
    "",
  );
  // remove trailing size like "5L", "20L", "4L", "23KG", "1.75ML" etc
  s = s.replace(/\s*-?\s*\d+(\.\d+)?\s*(L|KG|ML)$/g, "");
  // remove trailing tint-base descriptors
  s = s.replace(
    /\s*-\s*(PASTEL|DEEP|TRANSPARENT|MEDIUM)\s*(BASE)?\s*\d*$/g,
    "",
  );
  // remove trailing base-number references like "Base 7", "Base 8"
  s = s.replace(/\s*-?\s*BASE\s*\d+$/g, "");
  return s.trim();
}

/** Extract the "family" prefix from a SKU (letters before digits). */
function skuFamily(sku: string): string {
  const norm = normalizeSku(sku);
  const m = norm.match(/^([A-Z]+)/);
  return m ? m[1] : norm;
}

// ─── Index Building ──────────────────────────────────────────────────────────

type ExistingProduct = {
  id: string;
  name: string;
  sku: string | null;
  supplierId: string | null;
  categoryId: string | null;
};

type Indexes = {
  bySku: Map<string, ExistingProduct[]>;
  byName: Map<string, ExistingProduct[]>;
  byFuzzyName: Map<string, ExistingProduct[]>;
  bySkuFamily: Map<string, ExistingProduct[]>;
};

function buildIndexes(products: ExistingProduct[]): Indexes {
  const bySku = new Map<string, ExistingProduct[]>();
  const byName = new Map<string, ExistingProduct[]>();
  const byFuzzyName = new Map<string, ExistingProduct[]>();
  const bySkuFamily = new Map<string, ExistingProduct[]>();

  for (const p of products) {
    // by normalized SKU
    if (p.sku) {
      const ns = normalizeSku(p.sku);
      if (ns) {
        const arr = bySku.get(ns) ?? [];
        arr.push(p);
        bySku.set(ns, arr);
      }

      // by SKU family
      const fam = skuFamily(p.sku);
      if (fam) {
        const arr2 = bySkuFamily.get(fam) ?? [];
        arr2.push(p);
        bySkuFamily.set(fam, arr2);
      }
    }

    // by normalized name
    const nn = normalizeName(p.name);
    {
      const arr = byName.get(nn) ?? [];
      arr.push(p);
      byName.set(nn, arr);
    }

    // by fuzzy name
    const fn = nameForFuzzyMatch(p.name);
    {
      const arr = byFuzzyName.get(fn) ?? [];
      arr.push(p);
      byFuzzyName.set(fn, arr);
    }
  }

  return { bySku, byName, byFuzzyName, bySkuFamily };
}

// ─── Matching ────────────────────────────────────────────────────────────────

type MatchResult =
  | { kind: "exact-sku"; product: ExistingProduct }
  | { kind: "exact-name"; product: ExistingProduct }
  | { kind: "fuzzy"; product: ExistingProduct; reason: string }
  | { kind: "manual-review"; reason: string }
  | { kind: "create" };

function findBestMatch(row: ImportRow, indexes: Indexes): MatchResult {
  const importSku = normalizeSku(row.sku);
  const importName = normalizeName(row.name);
  const importFuzzy = nameForFuzzyMatch(row.name);

  // 1) Exact normalized SKU match
  if (importSku) {
    const skuMatches = indexes.bySku.get(importSku);
    if (skuMatches && skuMatches.length === 1) {
      return { kind: "exact-sku", product: skuMatches[0] };
    }
    if (skuMatches && skuMatches.length > 1) {
      // multiple products share the same normalized SKU — check if one belongs to same supplier
      const sameSupplier = skuMatches.filter(
        (p) => p.supplierId === row.supplierId || !p.supplierId,
      );
      if (sameSupplier.length === 1) {
        return { kind: "exact-sku", product: sameSupplier[0] };
      }
      return {
        kind: "manual-review",
        reason: `Multiple existing products share normalized SKU "${importSku}": ${skuMatches.map((p) => `${p.name} (${p.sku})`).join(", ")}`,
      };
    }
  }

  // 2) Exact normalized name match
  {
    const nameMatches = indexes.byName.get(importName);
    if (nameMatches && nameMatches.length === 1) {
      return { kind: "exact-name", product: nameMatches[0] };
    }
    if (nameMatches && nameMatches.length > 1) {
      const sameSupplier = nameMatches.filter(
        (p) => p.supplierId === row.supplierId || !p.supplierId,
      );
      if (sameSupplier.length === 1) {
        return { kind: "exact-name", product: sameSupplier[0] };
      }
    }
  }

  // 3) Same supplier + strong fuzzy SKU-family / name-family match
  if (importSku) {
    const fam = skuFamily(importSku);
    const familyMatches = indexes.bySkuFamily.get(fam);
    if (familyMatches) {
      const sameSupplier = familyMatches.filter(
        (p) => p.supplierId === row.supplierId || !p.supplierId,
      );
      // If the import SKU is MORE specific (e.g. TCA1000 vs TCA), we should create new
      // Only reuse if the existing product has the EXACT same normalized SKU
      // Since we already checked exact SKU above, arriving here means the SKU differs
      // For tint-base variants (TCA1000 vs TCA), we should create new products
      // Only consider fuzzy match for near-exact SKU differences (like PEM 800 vs PEM800 —
      // but those would already be caught by normalized SKU)
      if (sameSupplier.length === 1) {
        const existing = sameSupplier[0];
        const existingSku = normalizeSku(existing.sku);
        // Only fuzzy-match if the existing SKU is a prefix of the import SKU
        // AND the existing product is generic (no number suffix in SKU)
        // But we should NOT merge variant-specific imports onto generic parents
        // unless the generic IS the only product
        const existingHasNumbers = /\d/.test(existingSku);
        const importHasNumbers = /\d/.test(importSku);

        // If existing is generic (e.g. "TCA") and import is specific (e.g. "TCA1000"),
        // create new — do not merge
        if (
          !existingHasNumbers &&
          importHasNumbers &&
          importSku !== existingSku
        ) {
          return { kind: "create" };
        }
      }
    }
  }

  // 4) Fuzzy name match (same supplier)
  {
    const fuzzyMatches = indexes.byFuzzyName.get(importFuzzy);
    if (fuzzyMatches) {
      const sameSupplier = fuzzyMatches.filter(
        (p) => p.supplierId === row.supplierId || !p.supplierId,
      );
      if (sameSupplier.length === 1) {
        return {
          kind: "fuzzy",
          product: sameSupplier[0],
          reason: `Fuzzy name match: "${importFuzzy}"`,
        };
      }
      if (sameSupplier.length > 1) {
        return {
          kind: "manual-review",
          reason: `Multiple fuzzy name matches for "${importFuzzy}": ${sameSupplier.map((p) => `${p.name} (${p.sku})`).join(", ")}`,
        };
      }
    }
  }

  // 5) No match — create
  return { kind: "create" };
}

// ─── Import Data ─────────────────────────────────────────────────────────────

const importRows: ImportRow[] = [
  // ===== PLASCON =====
  {
    name: "Wood Primer",
    sku: "UC2",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [
      { unitSize: 20, uom: "L", price: 1021.94 },
      { unitSize: 5, uom: "L", price: 380.26 },
    ],
  },
  {
    name: "Prof Plaster Primer",
    sku: "PP700",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 616.15 }],
  },
  {
    name: "Prof W/Base Gypsum & Plaster Primer",
    sku: "PGS1",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [
      { unitSize: 20, uom: "L", price: 1915.03 },
      { unitSize: 5, uom: "L", price: 468.16 },
    ],
  },
  {
    name: "Metalcare Galvanised Iron Primer - Yellow",
    sku: "GIP",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [
      { unitSize: 20, uom: "L", price: 1729.99 },
      { unitSize: 5, uom: "L", price: 455.26 },
    ],
  },
  {
    name: "Plascofase-18 Primer Red Oxide",
    sku: "EMS18",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [
      { unitSize: 20, uom: "L", price: 1861.86 },
      { unitSize: 5, uom: "L", price: 436.21 },
    ],
  },
  {
    name: "Epiwash Stron. Chrom. Primer - Yellow 10L",
    sku: "AW255",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 10, uom: "L", price: 1360.35 }],
  },
  {
    name: "Plascon Epiwash Thinner",
    sku: "TH128",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 764.84 }],
  },
  {
    name: "Multi-Surface Primer - White",
    sku: "WUP1",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 394.34 }],
  },
  {
    name: "Contractors Matt - White",
    sku: "PEM600",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 447.56 }],
  },
  {
    name: "Contractors Matt Tint Base - Pastel",
    sku: "TCP1000",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 736.48 }],
  },
  {
    name: "Prof Matt - White",
    sku: "PEM800",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 838.8 }],
  },
  {
    name: "Super Matt White",
    sku: "PEM900",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [
      { unitSize: 20, uom: "L", price: 672.66 },
      { unitSize: 5, uom: "L", price: 304.04 },
    ],
  },
  {
    name: "Super Matt Tint Base - Pastel",
    sku: "TSA1010",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [
      { unitSize: 20, uom: "L", price: 719.74 },
      { unitSize: 5, uom: "L", price: 304.08 },
    ],
  },
  {
    name: "Super Matt Tint Base - Deep",
    sku: "TSA2010",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [
      { unitSize: 20, uom: "L", price: 707.01 },
      { unitSize: 5, uom: "L", price: 324.81 },
    ],
  },
  {
    name: "Super Matt Tint Base - Transparent",
    sku: "TSA3010",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [
      { unitSize: 20, uom: "L", price: 852.98 },
      { unitSize: 5, uom: "L", price: 345.93 },
    ],
  },
  {
    name: "Low Sheen White",
    sku: "PEM1000",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [
      { unitSize: 20, uom: "L", price: 921.88 },
      { unitSize: 5, uom: "L", price: 437.35 },
    ],
  },
  {
    name: "Low Sheen Tint Base - Pastel",
    sku: "TLS1000",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [
      { unitSize: 20, uom: "L", price: 803.08 },
      { unitSize: 5, uom: "L", price: 437.3 },
    ],
  },
  {
    name: "Low Sheen Tint Base - Deep",
    sku: "TLS2000",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [
      { unitSize: 20, uom: "L", price: 1006.64 },
      { unitSize: 5, uom: "L", price: 465.91 },
    ],
  },
  {
    name: "Low Sheen Tint Base - Transparent",
    sku: "TLS3010",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [
      { unitSize: 20, uom: "L", price: 1124.89 },
      { unitSize: 5, uom: "L", price: 494.16 },
    ],
  },
  {
    name: "Polvin Super Acrylic - White",
    sku: "EPL30",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1026.17 }],
  },
  {
    name: "Polvin Super Acrylic - Pastel",
    sku: "TAP1000",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 974.82 }],
  },
  {
    name: "Polvin Super Acrylic - Deep",
    sku: "TAP2000",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1042.62 }],
  },
  {
    name: "Polvin Super Acrylic - Transparent",
    sku: "TAP3000",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1094.83 }],
  },
  {
    name: "Double Velvet - White & Vel 2 Tawny Mink 5L",
    sku: "TDV",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [
      { unitSize: 20, uom: "L", price: 1432.34 },
      { unitSize: 5, uom: "L", price: 562.32 },
    ],
  },
  {
    name: "Double Velvet - Pastel",
    sku: "TDV1000",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [
      { unitSize: 20, uom: "L", price: 1432.19 },
      { unitSize: 5, uom: "L", price: 562.19 },
    ],
  },
  {
    name: "Double Velvet - Deep",
    sku: "TDV2000",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1555.46 }],
  },
  {
    name: "PWC 520",
    sku: "PWC520",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 827.51 }],
  },
  {
    name: "Prof Damp Plaster Paint",
    sku: "PSB600",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1488.35 }],
  },
  {
    name: "All Purpose Undercoat",
    sku: "PU800",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [
      { unitSize: 20, uom: "L", price: 940.58 },
      { unitSize: 5, uom: "L", price: 253.9 },
    ],
  },
  {
    name: "Super Universal Enamel - Super White",
    sku: "NY1",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 384.36 }],
  },
  {
    name: "Super Universal Enamel - G2, G7, G15",
    sku: "G",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 436.24 }],
  },
  {
    name: "Super Universal Genamel - G13 - Pastel Base",
    sku: "TGE",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 457.82 }],
  },
  {
    name: "Super Universal Genamel - G13 - Deep Base",
    sku: "TGE",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 409.09 }],
  },
  {
    name: "Super Universal Genamel - G13 - Transparent Base",
    sku: "TGE",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 537.26 }],
  },
  {
    name: "Velvaglo White & Black",
    sku: "VLO",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 504.98 }],
  },
  {
    name: "Velvaglo Pastel - Solvent Base",
    sku: "TVG1000",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 530.94 }],
  },
  {
    name: "Velvaglo Deep - Solvent Base",
    sku: "TVG2000",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 591.36 }],
  },
  {
    name: "Velvaglo Transparent - Solvent Base",
    sku: "TVG3010",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 600.83 }],
  },
  {
    name: "Waterbase Velvaglo - White",
    sku: "VLW1",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 482.48 }],
  },
  {
    name: "Waterbase Velvaglo - Black",
    sku: "VLW2",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 489.83 }],
  },
  {
    name: "Waterbase Velvaglo - Pastel Base",
    sku: "TVW1",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 482.44 }],
  },
  {
    name: "Waterbase Velvaglo - Deep Base",
    sku: "TVW2",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 498.5 }],
  },
  {
    name: "Waterbase Velvaglo - Transparent Base",
    sku: "TVW",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 522.67 }],
  },
  {
    name: "Plascon Skimcoat Interior - 23KG",
    sku: "PSI",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 23, uom: "KG", price: 509.89 }],
  },
  {
    name: "Micatex - White & All Colours",
    sku: "BBO",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 1063.9 }],
  },
  {
    name: "Micatex - Pastel Base",
    sku: "TMX1050",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 1117.13 }],
  },
  {
    name: "Micatex - Deep Base",
    sku: "TMX2050",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 1223.55 }],
  },
  {
    name: "Plascon Nuroof Cool - White & All Colours",
    sku: "TRP",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 1143.43 }],
  },
  {
    name: "Plascon Nuroof Cool - Khaki Dawn",
    sku: "TRP",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 1152.44 }],
  },
  {
    name: "Wall & All - White",
    sku: "WAA1",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [
      { unitSize: 20, uom: "L", price: 1672.22 },
      { unitSize: 5, uom: "L", price: 567.22 },
    ],
  },
  {
    name: "Wall & All - Pastel",
    sku: "TWA1000",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1672.21 }],
  },
  {
    name: "Wall & All - Deep",
    sku: "TWA2000",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1834.93 }],
  },
  {
    name: "Wall & All - Transparent",
    sku: "TWA3000",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1965.47 }],
  },
  {
    name: "WoodCare Sunproof - Ext Gloss - Clear",
    sku: "WSP1-28",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 489.85 }],
  },
  {
    name: "Woodcare Brickseal - Clear",
    sku: "WBS1",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 621.35 }],
  },
  {
    name: "Plascon Brick & Slasto Dressing - Clear",
    sku: "TBD1",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 657.62 }],
  },
  {
    name: "Plascoguard-75 - Red Oxide 4L",
    sku: "PEX750B",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 4, uom: "L", price: 609.85 }],
  },
  {
    name: "Plascotuff 3500 - Grey 4L",
    sku: "PEX3500",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 4, uom: "L", price: 1092.62 }],
  },
  {
    name: "Plascotuff 3500 Hardener 1L",
    sku: "PEH3500",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 1, uom: "L", price: 291.37 }],
  },
  {
    name: "P/Thane-9000 Hardener 1.75ML",
    sku: "PRH",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 1.75, uom: "L", price: 210.4 }],
  },
  {
    name: "P/Thane-9000 T/Base-Pastel 4.2L",
    sku: "PRT0001",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 4.2, uom: "L", price: 637.42 }],
  },
  {
    name: "P/Thane-9000 T/Base-Trans 3.9L",
    sku: "PRT0003",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 3.9, uom: "L", price: 558.39 }],
  },
  {
    name: "Cashmere - White",
    sku: "CAS1",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [
      { unitSize: 20, uom: "L", price: 1649.4 },
      { unitSize: 5, uom: "L", price: 582.06 },
    ],
  },
  {
    name: "Cashmere - Pastel",
    sku: "TCA1000",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [
      { unitSize: 20, uom: "L", price: 1298.71 },
      { unitSize: 5, uom: "L", price: 581.99 },
    ],
  },
  {
    name: "Cashmere - Deep",
    sku: "TCA2000",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [
      { unitSize: 20, uom: "L", price: 1841.08 },
      { unitSize: 5, uom: "L", price: 1787.46 },
    ],
  },
  {
    name: "Prof Super Matt - White",
    sku: "PEM950",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1453.72 }],
  },
  {
    name: "Prof Super Matt T/Base - Pastel",
    sku: "TPM1000",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1509.6 }],
  },
  {
    name: "Prof Super Matt T/Base - Deep",
    sku: "TPM2000",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1565.5 }],
  },
  {
    name: "Prof Elastoshield - White",
    sku: "PES1",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1553.13 }],
  },
  {
    name: "Elastoshield Pastel",
    sku: "TED1000",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1553.17 }],
  },
  {
    name: "Elastoshield Deep",
    sku: "TED2000",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1682.59 }],
  },
  {
    name: "Metal Care Silvershine Aluminium",
    sku: "ASS1",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 864.99 }],
  },
  {
    name: "Plascotuff Pitch Coat Black DL",
    sku: "EPD1",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 933.28 }],
  },
  {
    name: "Stoep Enamel Black",
    sku: "SP1",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 432.5 }],
  },
  {
    name: "Stoep Enamel Green",
    sku: "SP2",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 432.5 }],
  },
  {
    name: "Stoep Enamel Red",
    sku: "SP3",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 432.5 }],
  },
  {
    name: "Stoep Enamel Grey",
    sku: "SP7",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 432.5 }],
  },
  {
    name: "Stoep Enamel Terracotta",
    sku: "SP13",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 432.5 }],
  },
  {
    name: "Stoep Enamel Navy Light Grey",
    sku: "SP16",
    supplierId: PLASCON_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 432.5 }],
  },

  // ===== DULUX =====
  {
    name: "Dulux Wood Primer",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [
      { unitSize: 20, uom: "L", price: 1050.0 },
      { unitSize: 5, uom: "L", price: 460.0 },
    ],
  },
  {
    name: "Dulux Trade Alkali Resistant Primer",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 905.0 }],
  },
  {
    name: "Dulux Ecosure Plaster Primer",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 905.0 }],
  },
  {
    name: "Dulux Trade Steel Primer Grey",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 530.0 }],
  },
  {
    name: "Dulux Galvanised Iron Primer",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 720.0 }],
  },
  {
    name: "Dulux Rust Shield W/Base - Red Oxide",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 550.0 }],
  },
  {
    name: "Dulux Rust Shield W/Base - Black",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 550.0 }],
  },
  {
    name: "Dulux Rust Shield W/Base - Grey",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [
      { unitSize: 20, uom: "L", price: 2150.0 },
      { unitSize: 5, uom: "L", price: 550.0 },
    ],
  },
  {
    name: "Dulux Supergrip Primer WB White",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 750.0 }],
  },
  {
    name: "Dulux Berger Nukote White",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 530.0 }],
  },
  {
    name: "Dulux Smooth Ripple Finish - White",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1520.0 }],
  },
  {
    name: "Trade 65 White",
    sku: "Trade 65 White",
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 750.0 }],
  },
  {
    name: "Trade 65 - Pastel 7",
    sku: "Pastel7",
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 780.0 }],
  },
  {
    name: "Trade 65 - Medium 8",
    sku: "Medium 8",
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 860.0 }],
  },
  {
    name: "Trade 65 - Deep 9",
    sku: "Deep 9",
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 980.0 }],
  },
  {
    name: "Trade 100 Lowsheen White",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1080.0 }],
  },
  {
    name: "Trade 100 Lowsheen - Pastel 7",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1130.0 }],
  },
  {
    name: "Trade100 Lowsheen - Medium 8",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1200.0 }],
  },
  {
    name: "Trade100 Lowsheen - Deep 9",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1300.0 }],
  },
  {
    name: "Trade100 Lowsheen - U. Deep 6",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1500.0 }],
  },
  {
    name: "DLX Acrylic PVA - All Std Colours",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1200.0 }],
  },
  {
    name: "DLX Acrylic PVA - White",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 980.0 }],
  },
  {
    name: "DLX Acrylic PVA - Patel - Base 7",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1160.0 }],
  },
  {
    name: "DLX Acrylic PVA - Deep - Base 8",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1270.0 }],
  },
  {
    name: "DLX Acrylic PVA - Transp - Base 9",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1400.0 }],
  },
  {
    name: "DLX Acrylic PVA - Base 6 - (4x5l - R1500)",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1700.0 }],
  },
  {
    name: "Lux Silk Brilliant White",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1490.0 }],
  },
  {
    name: "Lux Silk - Pastel 7",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1530.0 }],
  },
  {
    name: "Lux Silk - Medium 8",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1630.0 }],
  },
  {
    name: "Lux Silk - Deep 9",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1730.0 }],
  },
  {
    name: "Lux Silk - U/Deep 6",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1950.0 }],
  },
  {
    name: "Rainshield (White & Grey)",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1100.0 }],
  },
  {
    name: "Dampshield",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1150.0 }],
  },
  {
    name: "Trade Universal Undercoat",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1030.0 }],
  },
  {
    name: "Dulux Gloss Std Colours",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 500.0 }],
  },
  {
    name: "Dulux Gloss Enamel - White",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [
      { unitSize: 20, uom: "L", price: 1900.0 },
      { unitSize: 5, uom: "L", price: 500.0 },
    ],
  },

  // ===== EXTRA DULUX =====
  {
    name: "Dulux Gloss Enamel - Base 6",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 610.0 }],
  },
  {
    name: "Dulux Gloss Enamel - Base 7",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 480.0 }],
  },
  {
    name: "Dulux Gloss Enamel - Base 8",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 500.0 }],
  },
  {
    name: "Dulux Gloss Enamel - Base 9",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 535.0 }],
  },

  {
    name: "Solvent Base Pearlglo White",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 620.0 }],
  },
  {
    name: "Solvent Base Pearlglo - Base 7",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 640.0 }],
  },
  {
    name: "Solvent Base Pearlglo - Base 8",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 660.0 }],
  },
  {
    name: "Solvent Base Pearlglo - Base 9",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 680.0 }],
  },
  {
    name: "Solvent Base Pearlglo - Base 6",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 750.0 }],
  },

  {
    name: "Waterbase Pearlglo - White",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 510.0 }],
  },
  {
    name: "Waterbase Pearlglo - Pebble Black",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 510.0 }],
  },
  {
    name: "Waterbased Pearlglo - Base 7",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 490.0 }],
  },
  {
    name: "Waterbased Pearlglo - Base 8",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 510.0 }],
  },
  {
    name: "Waterbased Pearlglo - Base 9",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 530.0 }],
  },
  {
    name: "Waterbased Pearlglo - Base 6",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 570.0 }],
  },

  {
    name: "Prepaint Smoothover Int/Ext 35KG",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 35, uom: "KG", price: 630.0 }],
  },

  {
    name: "Weatherguard Fine Textured - White & Std Colours",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 930.0 }],
  },
  {
    name: "Weatherguard Fine Textured - Base 7",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1190.0 }],
  },
  {
    name: "Weatherguard Fine Textured - Base 8",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1300.0 }],
  },
  {
    name: "Weatherguard Fine Textured - Base 9",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1400.0 }],
  },
  {
    name: "Weatherguard Fine Textured - Base 6",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1670.0 }],
  },

  {
    name: "DLX Roofguard - White & All Colours",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1080.0 }],
  },

  {
    name: "DLX Wallguard - Base 6",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 2050.0 }],
  },
  {
    name: "DLX Wallguard - Base 7",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1600.0 }],
  },
  {
    name: "DLX Wallguard - Base 8",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1700.0 }],
  },
  {
    name: "DLX Wallguard - Base 9",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1800.0 }],
  },

  {
    name: "Timba Preservative Clear - All Colours",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 540.0 }],
  },
  {
    name: "WG Timbavarnish Int/Ext - Clear & All Colours",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 560.0 }],
  },
  {
    name: "Woodgard Rubbol Clear & All Colours",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 1400.0 }],
  },

  {
    name: "Brick/Slasto Dressing S/B",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 600.0 }],
  },

  {
    name: "Floorcote SB Black",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 600.0 }],
  },
  {
    name: "Floorcote SB Brilliant Grn",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 600.0 }],
  },
  {
    name: "Floorcote SB Chrom Oxid Grn",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 600.0 }],
  },
  {
    name: "Floorcote SB Dark Sea Grey",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 600.0 }],
  },
  {
    name: "Floorcote SB Red Oxide",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 600.0 }],
  },

  {
    name: "Trade Wallclad White",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1630.0 }],
  },
  {
    name: "Trade Wallclad Base 7",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1670.0 }],
  },
  {
    name: "Trade Wallclad Base 8",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1740.0 }],
  },
  {
    name: "Trade Wallclad Base 9",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1900.0 }],
  },
  {
    name: "Trade Wallclad Base 6",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 2200.0 }],
  },

  {
    name: "Weatherguard Ultra Smooth Base 7",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1320.0 }],
  },
  {
    name: "Weatherguard Ultra Smooth Base 8",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1430.0 }],
  },
  {
    name: "Weatherguard Ultra Smooth Base 9",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1540.0 }],
  },
  {
    name: "Weatherguard Ultra Smooth Base 6",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1850.0 }],
  },

  {
    name: "Tuffcote Epoxy WB Light Grey",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1350.0 }],
  },
  {
    name: "Tuffcote Epoxy WB Dairy White",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 20, uom: "L", price: 1350.0 }],
  },

  {
    name: "Trade Sterishield - Diamond Matt White",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 930.0 }],
  },
  {
    name: "Sterishield Diamond Eggshell White",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 930.0 }],
  },
  {
    name: "Sterishield Diamond E/Shell Light Tinted",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 930.0 }],
  },
  {
    name: "Sterishield Diamond E/Shell Medium Tint",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 940.0 }],
  },
  {
    name: "Sterishield Diamond E/Shell Ex/Deep Tint",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 960.0 }],
  },

  {
    name: "TR Hi-Chem Enamel S/B - Brilliant Green",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 1280.0 }],
  },
  {
    name: "TR Hi-Chem Enamel S/B - Light Grey",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 1280.0 }],
  },
  {
    name: "TR Hi-Chem Enamel S/B - Dark Grey",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 1280.0 }],
  },
  {
    name: "TR Hi-Chem Enamel S/B - White",
    sku: null,
    supplierId: DULUX_SUPPLIER_ID,
    categoryId: PAINTS_CATEGORY_ID,
    variants: [{ unitSize: 5, uom: "L", price: 1280.0 }],
  },
];

// ─── Core Logic ──────────────────────────────────────────────────────────────

function mapUom(uom: "L" | "KG" | null | undefined): ProductUom | null {
  if (!uom) return null;
  switch (uom) {
    case "L":
      return ProductUom.L;
    case "KG":
      return ProductUom.KG;
    default:
      return null;
  }
}

async function main() {
  console.log("=== Supplier Price Seed Script ===\n");

  // ── 1. Load existing data ────────────────────────────────────────────────
  const existingProducts = await prisma.procurementProduct.findMany({
    select: {
      id: true,
      name: true,
      sku: true,
      supplierId: true,
      categoryId: true,
    },
  });
  console.log(`Loaded ${existingProducts.length} existing ProcurementProducts`);

  const existingPrices = await prisma.supplierProductPrice.findMany({
    where: {
      supplierId: {
        in: [PLASCON_SUPPLIER_ID, DULUX_SUPPLIER_ID],
      },
    },
    select: {
      id: true,
      supplierId: true,
      productId: true,
      unitSize: true,
      uom: true,
      startsOn: true,
      price: true,
    },
  });
  console.log(
    `Loaded ${existingPrices.length} existing SupplierProductPrice rows\n`,
  );

  // Build a lookup key for existing prices
  const existingPriceMap = new Map<string, (typeof existingPrices)[0]>();
  for (const ep of existingPrices) {
    const key = [
      ep.supplierId,
      ep.productId,
      ep.unitSize?.toString() ?? "",
      ep.uom ?? "",
      ep.startsOn.toISOString(),
    ].join("|");
    existingPriceMap.set(key, ep);
  }

  // ── 2. Build indexes ─────────────────────────────────────────────────────
  const indexes = buildIndexes(existingProducts);

  // ── 3. Process import rows ────────────────────────────────────────────────
  const stats = {
    matchedExisting: 0,
    correctedExisting: 0,
    createdProducts: 0,
    createdPrices: 0,
    updatedPrices: 0,
    skippedVariants: 0,
  };
  const manualReview: ManualReviewEntry[] = [];

  // Deduplicate TGE and TRP rows: same SKU, different names/variants.
  // We handle them by tracking which product was resolved per import SKU+name combo.
  const resolvedProducts = new Map<string, string>(); // "sku|name" -> productId

  for (const row of importRows) {
    const rowKey = `${normalizeSku(row.sku)}|${normalizeName(row.name)}`;

    // Skip rows with no valid variants
    const validVariants = row.variants.filter(
      (v) =>
        v.price != null &&
        v.price > 0 &&
        v.unitSize != null &&
        v.unitSize > 0 &&
        v.uom != null,
    );
    if (validVariants.length === 0) {
      console.log(`  SKIP (no valid variants): ${row.name}`);
      continue;
    }

    const match = findBestMatch(row, indexes);

    let productId: string;

    switch (match.kind) {
      case "exact-sku": {
        const existing = match.product;
        productId = existing.id;
        stats.matchedExisting++;
        console.log(
          `  MATCH (exact SKU "${normalizeSku(row.sku)}"): "${row.name}" -> existing "${existing.name}" [${existing.id}]`,
        );

        // Possibly correct name if the import name is clearly better
        const updates: Record<string, unknown> = {};

        // Update categoryId if missing
        if (!existing.categoryId) {
          updates.categoryId = row.categoryId;
        }
        // Update supplierId if missing
        if (!existing.supplierId) {
          updates.supplierId = row.supplierId;
        }

        // Correct malformed name: only if existing name is clearly worse
        // (shorter, or has known OCR issues)
        const existingNorm = normalizeName(existing.name);
        const importNorm = normalizeName(row.name);
        if (
          existingNorm !== importNorm &&
          shouldCorrectName(existing.name, row.name, normalizeSku(row.sku))
        ) {
          updates.name = row.name;
          stats.correctedExisting++;
          console.log(`    CORRECT name: "${existing.name}" -> "${row.name}"`);
        }

        // Correct SKU formatting (e.g. "PEM 800" -> "PEM800")
        const existingSkuNorm = normalizeSku(existing.sku);
        const importSkuNorm = normalizeSku(row.sku);
        if (
          existing.sku &&
          row.sku &&
          existingSkuNorm === importSkuNorm &&
          existing.sku !== row.sku
        ) {
          // The import has a cleaner SKU (no spaces) — prefer it
          if (existing.sku.includes(" ") && !row.sku.includes(" ")) {
            updates.sku = row.sku;
            console.log(`    CORRECT sku: "${existing.sku}" -> "${row.sku}"`);
          }
        }

        if (Object.keys(updates).length > 0) {
          await prisma.procurementProduct.update({
            where: { id: existing.id },
            data: updates,
          });
        }
        break;
      }

      case "exact-name": {
        const existing = match.product;
        productId = existing.id;
        stats.matchedExisting++;
        console.log(
          `  MATCH (exact name): "${row.name}" -> existing "${existing.name}" [${existing.id}]`,
        );

        const updates: Record<string, unknown> = {};
        if (!existing.categoryId) updates.categoryId = row.categoryId;
        if (!existing.supplierId) updates.supplierId = row.supplierId;
        // Set SKU if existing has none and import has one
        if (!existing.sku && row.sku) {
          updates.sku = row.sku;
          console.log(`    SET sku: "${row.sku}"`);
        }
        if (Object.keys(updates).length > 0) {
          await prisma.procurementProduct.update({
            where: { id: existing.id },
            data: updates,
          });
        }
        break;
      }

      case "fuzzy": {
        const existing = match.product;
        productId = existing.id;
        stats.matchedExisting++;
        console.log(
          `  MATCH (fuzzy: ${match.reason}): "${row.name}" -> existing "${existing.name}" [${existing.id}]`,
        );

        const updates: Record<string, unknown> = {};
        if (!existing.categoryId) updates.categoryId = row.categoryId;
        if (!existing.supplierId) updates.supplierId = row.supplierId;
        if (Object.keys(updates).length > 0) {
          await prisma.procurementProduct.update({
            where: { id: existing.id },
            data: updates,
          });
        }
        break;
      }

      case "manual-review": {
        manualReview.push({ row, reason: match.reason });
        console.log(
          `  MANUAL REVIEW: "${row.name}" (${row.sku ?? "no sku"}) — ${match.reason}`,
        );
        // Still try to create prices if we can resolve to a single product later
        // For now, skip
        continue;
      }

      case "create": {
        // Check if we already created a product for this exact SKU in this run
        if (row.sku) {
          const alreadyCreatedKey = normalizeSku(row.sku);
          // Check newly-created products in the index (they would be added after creation)
          const freshLookup = indexes.bySku.get(alreadyCreatedKey);
          if (freshLookup && freshLookup.length > 0) {
            // We already created this product for another row — reuse it
            productId = freshLookup[0].id;
            stats.matchedExisting++;
            console.log(
              `  REUSE (already created in this run): "${row.name}" -> [${productId}]`,
            );
            break;
          }
        }

        // Create new ProcurementProduct
        const created = await prisma.procurementProduct.create({
          data: {
            name: row.name,
            sku: row.sku ?? undefined,
            supplierId: row.supplierId,
            categoryId: row.categoryId,
            isActive: true,
          },
        });
        productId = created.id;
        stats.createdProducts++;
        console.log(
          `  CREATE: "${row.name}" (${row.sku ?? "no sku"}) -> [${created.id}]`,
        );

        // Add to indexes so subsequent rows can find it
        const newProduct: ExistingProduct = {
          id: created.id,
          name: row.name,
          sku: row.sku ?? null,
          supplierId: row.supplierId,
          categoryId: row.categoryId,
        };
        if (row.sku) {
          const ns = normalizeSku(row.sku);
          const arr = indexes.bySku.get(ns) ?? [];
          arr.push(newProduct);
          indexes.bySku.set(ns, arr);
        }
        const nn = normalizeName(row.name);
        const arr2 = indexes.byName.get(nn) ?? [];
        arr2.push(newProduct);
        indexes.byName.set(nn, arr2);
        break;
      }
    }

    // Track resolved productId for dedup
    resolvedProducts.set(rowKey, productId);

    // ── Upsert supplier prices ──────────────────────────────────────────
    for (const v of validVariants) {
      const uom = mapUom(v.uom);
      const priceKey = [
        row.supplierId,
        productId,
        v.unitSize?.toString() ?? "",
        uom ?? "",
        STARTS_ON.toISOString(),
      ].join("|");

      const existingPrice = existingPriceMap.get(priceKey);
      if (existingPrice) {
        // Update if price differs
        const existingPriceNum = Number(existingPrice.price);
        if (Math.abs(existingPriceNum - v.price) > 0.005) {
          await prisma.supplierProductPrice.update({
            where: { id: existingPrice.id },
            data: { price: v.price },
          });
          stats.updatedPrices++;
          console.log(
            `    UPDATE price: ${v.unitSize}${v.uom} ${existingPriceNum} -> ${v.price}`,
          );
        } else {
          // Price is the same, skip
        }
      } else {
        // Create new price row
        const created = await prisma.supplierProductPrice.create({
          data: {
            supplierId: row.supplierId,
            productId,
            uom: uom ?? undefined,
            unitSize: v.unitSize ?? undefined,
            price: v.price,
            startsOn: STARTS_ON,
            isActive: true,
          },
        });
        stats.createdPrices++;
        console.log(`    CREATE price: ${v.unitSize}${v.uom} @ R${v.price}`);

        // Add to price map so duplicate variants in same run don't re-create
        existingPriceMap.set(priceKey, {
          id: created.id,
          supplierId: row.supplierId,
          productId,
          unitSize: created.unitSize,
          uom: created.uom,
          startsOn: STARTS_ON,
          price: created.price,
        } as any);
      }
    }
  }

  // ── 4. Summary ────────────────────────────────────────────────────────────
  console.log("\n=== SUMMARY ===");
  console.log(`Matched existing products:  ${stats.matchedExisting}`);
  console.log(`Corrected existing products: ${stats.correctedExisting}`);
  console.log(`Created new products:       ${stats.createdProducts}`);
  console.log(`Created supplier prices:    ${stats.createdPrices}`);
  console.log(`Updated supplier prices:    ${stats.updatedPrices}`);
  console.log(`Manual review rows:         ${manualReview.length}`);

  if (manualReview.length > 0) {
    console.log("\n=== MANUAL REVIEW ITEMS ===");
    for (const mr of manualReview) {
      console.log(
        `  - "${mr.row.name}" (SKU: ${mr.row.sku ?? "none"}) — ${mr.reason}`,
      );
    }
  }
}

// ─── Name correction heuristic ───────────────────────────────────────────────

/**
 * Decide whether to overwrite the existing product name with the import name.
 * Only do this when the existing name is clearly worse (OCR artifacts, generic, etc.)
 * and the import name is more specific/correct.
 */
function shouldCorrectName(
  existingName: string,
  importName: string,
  normalizedSku: string,
): boolean {
  const eNorm = normalizeName(existingName);
  const iNorm = normalizeName(importName);

  // If normalized forms are the same, no correction needed
  if (eNorm === iNorm) return false;

  // Known corrections: existing has OCR/generic issues, import is better
  const corrections: Array<{ sku: string; existingPattern: RegExp }> = [
    // "Plascosafe 18 Primer" -> "Plascofase-18 Primer Red Oxide"
    { sku: "EMS18", existingPattern: /PLASCOSAFE/i },
    // "Water-based Gypsum & Masonary Sealer" -> spelling fix
    { sku: "PGS1", existingPattern: /MASONARY|MASSONARY/i },
    // "All Purpose Matt" with PEM800 -> "Prof Matt - White"
    { sku: "PEM800", existingPattern: /ALL PURPOSE MATT$/i },
    // "Superior Matt" with PEM950 -> "Prof Super Matt - White"
    { sku: "PEM950", existingPattern: /SUPERIOR MATT$/i },
    // "Damp Plaster Paint" -> "Prof Damp Plaster Paint"
    { sku: "PSB600", existingPattern: /^DAMP PLASTER PAINT$/i },
    // "Skim Coats - Interior" -> "Plascon Skimcoat Interior - 23KG"
    { sku: "PSI", existingPattern: /^SKIM COATS?/i },
    // "Silvershine Aluminium Paint" -> "Metal Care Silvershine Aluminium"
    { sku: "ASS1", existingPattern: /^SILVERSHINE/i },
    // "Brickseal" -> "Woodcare Brickseal - Clear"
    { sku: "WBS1", existingPattern: /^BRICKSEAL$/i },
    // "Super Matt (Professional)" -> "Super Matt White"
    { sku: "PEM900", existingPattern: /SUPER MATT \(PROFESSIONAL\)/i },
    // "Nuroof Cool Acrylic Roof Paint" -> "Plascon Nuroof Cool - White & All Colours"
    { sku: "TRP", existingPattern: /NUROOF COOL ACRYLIC ROOF PAINT/i },
    // "All Purpose Undercoat" exact match — keep as-is (name is fine)
    // "Wood Primer" exact match — keep as-is (name is fine)
  ];

  for (const c of corrections) {
    if (normalizedSku === c.sku && c.existingPattern.test(existingName)) {
      return true;
    }
  }

  // General heuristic: if the import name is significantly longer and contains
  // the existing name's key words, it's likely more descriptive
  // But be conservative — only correct if the existing is clearly generic
  return false;
}

// ─── Run ─────────────────────────────────────────────────────────────────────

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("\nDone.");
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
