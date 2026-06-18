/**
 * BuildSmart PDF importer mapping rules.
 *
 * These rules normalize supplier names and product descriptions so the
 * importer can resolve them to existing procurement products/suppliers
 * even when the PDF text doesn't exactly match our DB records.
 */
import type { ProductUom } from "@/generated/prisma/client";

// ── Supplier name aliases ────────────────────────────────────────────────────
// Map variations found in BuildSmart PDFs → canonical supplier name in our DB.
// All comparisons are case-insensitive.

const SUPPLIER_ALIASES: Record<string, string> = {
  // Soudal
  "soudal sa (pty) ltd": "Soudal",
  "soudal sa": "Soudal",
  soudal: "Soudal",

  // TimberLife
  timberlife: "TimberLife",
  "timber life": "TimberLife",
  "timberlife pty ltd": "TimberLife",
  "timberlife (pty) ltd": "TimberLife",

  // DIY Savoy — Plascon arm
  "diy savoy plascon": "DIY Savoy Plascon",
  "diy savoy - plascon": "DIY Savoy Plascon",

  // DIY Savoy — Consumables arm
  "diy savoy consumables": "DIY Savoy Consumables",
  "diy savoy - consumables": "DIY Savoy Consumables",

  // Generic Savoy catch-all
  "diy savoy": "DIY Savoy",

  // Marmoran
  marmoran: "Marmoran",
  "marmoran (pty) ltd": "Marmoran",
  "marmoran sa": "Marmoran",

  // Urochem
  "urochem trading": "Urochem Trading (Pty) Ltd",
  "urochem trading (pty) ltd": "Urochem Trading (Pty) Ltd",
  urochem: "Urochem Trading (Pty) Ltd",
};

/**
 * Given a vendor name from a BuildSmart PDF, return the canonical supplier
 * name from our DB.  Falls back to the original name if no alias matches.
 */
export function normalizeSupplierName(pdfVendorName: string): string {
  const key = pdfVendorName.trim().toLowerCase();

  // Exact alias hit
  if (SUPPLIER_ALIASES[key]) return SUPPLIER_ALIASES[key];

  // Substring match — e.g. "Soudal SA (Pty) Ltd t/a Soudal" still contains
  // known aliases.
  for (const [alias, canonical] of Object.entries(SUPPLIER_ALIASES)) {
    if (key.includes(alias)) return canonical;
  }

  return pdfVendorName.trim();
}

// ── Product description → base product mapping ─────────────────────────────
// Explicit mappings from raw BuildSmart descriptions to the canonical product
// name we store in `procurementProduct.name`.
// Matched case-insensitively against the full rawDescription.

type ProductMapping = {
  /** Substring or regex that matches the PDF rawDescription (case-insensitive) */
  pattern: string | RegExp;
  /** Canonical product name to look up in procurementProduct.name */
  canonicalName: string;
};

const PRODUCT_MAPPINGS: ProductMapping[] = [
  // ── Soudal ──
  {
    pattern: /smx\s*35.*white.*600\s*ml/i,
    canonicalName: "SMX35 - WHITE 600ML",
  },

  // ── TimberLife ──  (tinted variants → base product)
  {
    pattern: /timberlife\s+ultracare\s+gold/i,
    canonicalName: "TimberLife Ultracare Gold 25L",
  },

  // ── DIY Savoy Plascon ── (color variants → base product)
  {
    pattern: /prof\s+waterproofing\s+compound.*20\s*l/i,
    canonicalName: "Prof Waterproofing Compound 20L",
  },
  {
    pattern:
      /(?:tls\s*0*1000|tls001000)?.*prof\.?\s+superior\s+(?:low\s+sheen|l\/s|ls)/i,
    canonicalName: "Prof. Superior L/S White",
  },
  {
    pattern: /(?:pp\s*0*700|pp700)?.*prof\.?\s+plaster\s+primer/i,
    canonicalName: "PROF PLASTER PRIMER",
  },
  {
    pattern: /^pp\s*0*700$/i,
    canonicalName: "PROF PLASTER PRIMER",
  },

  // ── DIY Savoy Consumables ──
  {
    pattern: /sandpaper\s+p\s*40\s+50\s*m/i,
    canonicalName: "Sandpaper P40 50m",
  },
  {
    pattern: /sandpaper\s+p\s*80\s+50\s*m/i,
    canonicalName: "Sandpaper P80 50m",
  },
];

/**
 * Try to find a canonical product name from explicit mapping rules.
 * Returns `undefined` if no rule matches.
 */
export function mapDescriptionToProduct(
  rawDescription: string,
): string | undefined {
  const desc = rawDescription.trim();
  for (const rule of PRODUCT_MAPPINGS) {
    if (typeof rule.pattern === "string") {
      if (desc.toLowerCase().includes(rule.pattern.toLowerCase())) {
        return rule.canonicalName;
      }
    } else {
      if (rule.pattern.test(desc)) {
        return rule.canonicalName;
      }
    }
  }
  return undefined;
}

// ── Color / variant stripping ────────────────────────────────────────────────
// Common color/tint words found in BuildSmart product descriptions that should
// be stripped when trying to match to a base product.

const COLOR_WORDS = new Set([
  "white",
  "off-white",
  "offwhite",
  "black",
  "grey",
  "gray",
  "charcoal",
  "cream",
  "ivory",
  "beige",
  "brown",
  "dark brown",
  "light brown",
  "burnt amber",
  "amber",
  "mahogany",
  "walnut",
  "teak",
  "oak",
  "natural",
  "clear",
  "transparent",
  "red",
  "blue",
  "green",
  "yellow",
  "orange",
  "purple",
  "pink",
  "terracotta",
  "sandstone",
  "slate",
  "meranti",
  "imbuia",
]);

/**
 * Strip known color/tint/variant tokens from a product description so it
 * can be matched against a base product name.
 *
 * Example: "TIMBERLIFE ULTRACARE GOLD BURNT AMBER X2 25L"
 *       →  "TIMBERLIFE ULTRACARE GOLD X2 25L"
 *
 * Also strips "x2", "x4" multiplier prefixes commonly seen on tinted products.
 */
export function stripColorTokens(description: string): string {
  return description
    .split(/\s+/)
    .filter((token) => {
      const lower = token.toLowerCase().replace(/[^a-z-]/g, "");
      return lower.length > 0 && !COLOR_WORDS.has(lower);
    })
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ── Product name parser ───────────────────────────────────────────────────────
// BuildSmart product descriptions often embed a numeric/alphanumeric SKU at the
// front and trailing size + pack suffixes that are irrelevant to the base name.
//
// Examples:
//   "1010022251 Polycell Polyfilla Interior 12KG Pack 1"
//     → { cleanName: "Polycell Polyfilla Interior", sku: "1010022251" }
//   "10MM BACKING CORDPack 1"
//     → { cleanName: "10MM BACKING CORD", sku: null }

export function parseProductName(rawName: string): {
  cleanName: string;
  sku: string | null;
} {
  let name = rawName.trim();
  let sku: string | null = null;

  // Extract numeric SKU
  const numericSkuMatch = name.match(/^(\d{7,})\s+(.+)$/);

  if (numericSkuMatch) {
    sku = numericSkuMatch[1];
    name = numericSkuMatch[2].trim();
  } else {
    // Extract alpha-numeric SKU
    const alphaSkuMatch = name.match(/^([A-Z]{2,}\d{4,})\s+(.+)$/i);

    if (alphaSkuMatch) {
      sku = alphaSkuMatch[1];
      name = alphaSkuMatch[2].trim();
    }
  }

  // Remove trailing price only
  name = name.replace(/\s+R\s?\d+[.,]?\d*$/i, "");

  // Remove ONLY explicit "Pack N" at the very end
  name = name.replace(/\bPack\s+\d+\s*$/i, "").trim();

  // Remove ONLY isolated size suffixes at the very end
  // but preserve names like "Mix Masala 500ML"
  const protectedWords = ["mix masala", "masala mix"];

  const lower = name.toLowerCase();

  const isProtected = protectedWords.some((w) => lower.includes(w));

  if (!isProtected) {
    name = name.replace(
      /\s+\d+(?:\.\d+)?\s*(KG|G|L|ML|LTR|M2|M3|MM|CM|M)\s*$/i,
      "",
    );
  }

  // cleanup spaces
  name = name.replace(/\s{2,}/g, " ").trim();

  return {
    cleanName: name || rawName.trim(),
    sku,
  };
}

// ── Unit token parser ─────────────────────────────────────────────────────────
// Converts a size/unit token extracted from a BuildSmart line (e.g. "20L", "25L",
// "5L", "kg") into the structured uom + size fields on SiteProductOrderItem.
//
// "20L" → { uomAtOrder: "L", unitSizeAtOrder: 20 }
// "kg"  → { uomAtOrder: "KG", unitSizeAtOrder: null }

const UOM_ALIASES: Record<string, ProductUom> = {
  l: "L",
  ltr: "L",
  ml: "ML",
  g: "G",
  kg: "KG",
  m: "M",
  m2: "M2",
  m3: "M3",
  mm: "MM",
  cm: "CM",
  each: "EACH",
  ea: "EACH",
  pc: "PIECE",
  pcs: "PIECE",
  bag: "BAG",
  bags: "BAG",
};

export function parseUnitToken(unit: string | null): {
  uomAtOrder: ProductUom | null;
  unitSizeAtOrder: number | null;
} {
  if (!unit) return { uomAtOrder: null, unitSizeAtOrder: null };

  // Combined size+uom token: "20L", "5L", "25KG", "500ML"
  const combined = unit.match(/^(\d+(?:\.\d+)?)(L|ML|KG|G|M2|M3|MM|CM|M)$/i);
  if (combined) {
    const uomKey = combined[2].toLowerCase();
    const uom = UOM_ALIASES[uomKey] ?? null;
    return { uomAtOrder: uom, unitSizeAtOrder: parseFloat(combined[1]) };
  }

  // Standalone unit word: "kg", "each", "bag"
  const uom = UOM_ALIASES[unit.toLowerCase()] ?? null;
  return { uomAtOrder: uom, unitSizeAtOrder: null };
}
