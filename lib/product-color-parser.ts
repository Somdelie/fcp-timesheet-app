/**
 * Color variant extraction and product name cleaning utilities
 * for BuildSmart procurement product imports.
 */

import type { ColorBaseType } from "@/generated/prisma/client";
import {
  inferBuildSmartProductCode,
  isNumericCostCode,
} from "@/lib/procurement/buildsmartProductCodes";

// ── Base type indicators ─────────────────────────────────────────────────────
// These words signal the paint BASE TYPE, not a specific tint color.
// Listed most-specific first so the first match wins.

const BASE_TYPE_KEYWORDS: { term: string; baseType: ColorBaseType }[] = [
  { term: "pastel base", baseType: "PASTEL" },
  { term: "pastel", baseType: "PASTEL" },
  { term: "pure white", baseType: "WHITE" },
  { term: "bright white", baseType: "WHITE" },
  { term: "off-white", baseType: "WHITE" },
  { term: "off white", baseType: "WHITE" },
  { term: "white", baseType: "WHITE" },
  { term: "clear base", baseType: "CLEAR" },
  { term: "clear", baseType: "CLEAR" },
  { term: "transparent", baseType: "CLEAR" },
  { term: "neutral base", baseType: "NEUTRAL" },
  { term: "neutral", baseType: "NEUTRAL" },
  { term: "natural", baseType: "NEUTRAL" },
  { term: "deep base", baseType: "DEEP" },
  { term: "deep", baseType: "DEEP" },
];

// ── Specific tint colors ─────────────────────────────────────────────────────
// These are actual tint/colour names that identify a specific shade.
// Multi-word entries must come before any single-word sub-terms they contain.
// These are NOT treated as base-type keywords.

const TINT_COLORS = [
  // Named Plascon / industry tints
  "offshore 50",
  "light stone 68",
  "mumbai pink",
  "dark stone",
  "light stone",
  // Common specific shades
  "sandstone",
  "terracotta",
  "charcoal",
  "burgundy",
  "turquoise",
  "champagne",
  "mahogany",
  "taupe",
  "ivory",
  "cream",
  "beige",
  "maroon",
  "brown",
  "coral",
  "olive",
  "slate",
  "teal",
  "navy",
  "gold",
  "grey",
  "gray",
  "blue",
  "green",
  "yellow",
  "orange",
  "purple",
  "red",
  "black",
  "silver",
  "pink",
];

// ── Noise patterns for cleanProductName ─────────────────────────────────────
// Applied in the order listed; trim after each significant removal.

const LEADING_SIZE_RE = /^\d+(?:\.\d+)?\s*(?:L|KG|G|ML|LTR|M2|M3|MM|CM|M)\s+/i;

const LEADING_QTY_RE = /^\d{1,3}\s+/; // short bare number at start

// Prices: 1,234.56  or  1234.56  (two decimal places — currency)
const EMBEDDED_PRICE_RE = /\b\d{1,3}(?:,\d{3})*\.\d{2}\b/g;

const TLS_CODE_RE = /\bTLS\d+\b\s*/gi;
const TKM_CODE_RE = /\bTKM\s+\S+\s*/gi;
const LEADING_PRODUCT_CODE_RE = /^[A-Z]{1,4}\s+\d{4,}[A-Z0-9]*\s+/i;
const TBASE_RE = /\bT\/Base\b\s*/gi;
const PACK_RE = /\bPack\s+\d+\s*$/i;
const TRAILING_3DIGIT_RE = /\s+\d{3,}\s*$/;
const TRAILING_SIZE_RE =
  /\s+\d+(?:\.\d+)?\s*(?:KG|G|L|ML|LTR|M2|M3|MM|CM|M)\s*$/i;
const TRAILING_PRICE_RE = /\s+R\s?\d+[.,]?\d*\s*$/i;
const TRAILING_DASH_COLOR_CODE_RE =
  /^(?<product>.+?)\s+[-–—]\s+(?<color>[A-Za-z][A-Za-z0-9\s]{1,80}?)\s+(?<code>(?:\d{1,2}[A-Z]{1,3}\d{1,3}\/\d{1,4}|[A-Z0-9]{1,5}(?:-[A-Z0-9]{1,5}){1,2}))\s*$/i;

const PROTECTED_WORDS = ["mix masala", "masala mix"];

// ── cleanProductName ─────────────────────────────────────────────────────────

/**
 * Remove BuildSmart noise from a product description:
 *   - Leading 6+ digit SKU/code
 *   - Leading size token (e.g. "2.5L ", "500ML ")
 *   - Embedded prices (e.g. "58.70", "2,451.95")
 *   - Leading short quantity (bare 1-3 digit number)
 *   - TLS / TKM supplier codes
 *   - "T/Base" suffix
 *   - Trailing "Pack N", trailing size, trailing 3+ digit codes
 */
export function cleanProductName(rawName: string): string {
  let name = rawName.trim();

  // 1. Remove leading 6+ digit SKU/code
  name = name.replace(/^\d{6,}\s+/, "");

  // 1b. Remove leading BuildSmart product codes from the display name
  name = name.replace(LEADING_PRODUCT_CODE_RE, "").trim();

  // 2. Remove leading size token before cleaning prices
  name = name.replace(LEADING_SIZE_RE, "").trim();

  // 3. Remove embedded prices (must precede leading-qty removal so that a
  //    bare leading price like "764.10" is gone before step 4 fires)
  name = name
    .replace(EMBEDDED_PRICE_RE, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  // 4. Remove leading short bare quantity (e.g. "1 ", "2 ") that remains
  //    after price removal — stop at the product name proper
  name = name.replace(LEADING_QTY_RE, "").trim();

  // 5. Remove supplier/internal codes
  name = name.replace(TLS_CODE_RE, "").trim();
  name = name.replace(TKM_CODE_RE, "").trim();

  // 6. Remove T/Base marker
  name = name.replace(TBASE_RE, "").trim();

  // 7. Remove trailing "Pack N"
  name = name.replace(PACK_RE, "").trim();

  // 8. Remove trailing standalone 3+ digit numeric code (e.g. "292")
  name = name.replace(TRAILING_3DIGIT_RE, "").trim();

  // 9. Remove trailing size suffix, unless the name is a protected product
  const lower = name.toLowerCase();
  if (!PROTECTED_WORDS.some((w) => lower.includes(w))) {
    name = name.replace(TRAILING_SIZE_RE, "").trim();
  }

  // 10. Remove trailing R-prefixed price
  name = name.replace(TRAILING_PRICE_RE, "").trim();

  // Final cleanup
  name = name.replace(/\s{2,}/g, " ").trim();

  return name || rawName.trim();
}

// ── extractColorVariant ──────────────────────────────────────────────────────

/**
 * Separate concerns:
 *   1. Detect the BASE TYPE from keywords (pastel, white, clear, neutral, deep)
 *   2. Detect the specific TINT COLOR (offshore 50, grey, sandstone, …)
 *
 * CRITICAL: Only return a colorName if we found BOTH a base-type keyword AND
 * an actual color (either from TINT_COLORS or from the uppercase pattern).
 * This prevents false positives like "acetone" being treated as a color.
 *
 * If a specific tint is found, it becomes the colorName (alongside baseType).
 * If only an uppercase pattern is found with a base-type, use that.
 * Otherwise, colorName is null (not a paint color).
 */
export function extractColorVariant(rawDescription: string): {
  cleanName: string;
  colorName: string | null;
  baseType: ColorBaseType;
  isTinted: boolean;
  colorCode?: string | null;
} {
  const dashColorMatch = rawDescription.match(TRAILING_DASH_COLOR_CODE_RE);
  if (dashColorMatch?.groups) {
    return {
      cleanName: dashColorMatch.groups.product.trim(),
      colorName: dashColorMatch.groups.color.trim().toUpperCase(),
      baseType: "DEEP",
      isTinted: true,
      colorCode: dashColorMatch.groups.code.trim().toUpperCase(),
    };
  }

  const lower = rawDescription.toLowerCase();

  // 1. Detect base type
  let baseType: ColorBaseType = "DEEP";
  let baseTypeTerm: string | null = null;
  for (const { term, baseType: bt } of BASE_TYPE_KEYWORDS) {
    if (lower.includes(term)) {
      baseType = bt;
      baseTypeTerm = term;
      break;
    }
  }

  // 2. Detect specific tint color (more granular than base type)
  let colorName: string | null = null;
  let isTinted = false;
  let colorCode: string | null = null;
  for (const tint of TINT_COLORS) {
    if (lower.includes(tint)) {
      colorName = tint;
      isTinted = true;
      break;
    }
  }

  // 2b. Heuristic: detect trailing UPPERCASE color name followed by code
  // Examples: "SMOKEY WINGS B6-E1-3"  -> name: "smokey wings", code: "B6-E1-3"
  //           "SERIOUS 37" -> name: "serious", code: "37"
  if (!colorName) {
    const m = rawDescription.match(
      /([A-Z][A-Z\s]{1,80}?)\s+([A-Z0-9]+(?:-[A-Z0-9]+)*)\s*$/,
    );
    if (m) {
      const candidateName = m[1].trim();
      const candidateCode = m[2].trim();
      // require candidateName to be mostly uppercase (heuristic)
      const uppercaseRatio =
        candidateName.replace(/[^A-Z\s]/g, "").length / candidateName.length;
      if (uppercaseRatio > 0.6) {
        colorName = candidateName.toLowerCase();
        colorCode = candidateCode;
        isTinted = true;
      }
    }
  }

  // 3. CRITICAL: Only return colorName if we detected a base-type keyword.
  // This prevents false positives (e.g., "acetone" as a color).
  if (colorName && !baseTypeTerm) {
    colorName = null;
    isTinted = false;
    colorCode = null;
  }

  // 4. Remove detected terms from the raw description
  let cleanName = rawDescription;

  if (colorName && colorName !== baseTypeTerm) {
    cleanName = cleanName
      .replace(
        new RegExp(
          `\\b${colorName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
          "gi",
        ),
        "",
      )
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  if (baseTypeTerm) {
    cleanName = cleanName
      .replace(
        new RegExp(
          `\\b${baseTypeTerm.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`,
          "gi",
        ),
        "",
      )
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  return { cleanName, colorName, baseType, isTinted, colorCode };
}

// ── parseBuildSmartProduct ───────────────────────────────────────────────────

/**
 * Full pipeline for a raw BuildSmart product description:
 *   1. Extract leading 6-10 digit SKU/code
 *   2. Extract color variant (base type + specific tint)
 *   3. Clean remaining noise (prices, codes, sizes)
 *
 * Examples:
 *   "622759 58.70 292 Acrylic Silicone WHITE"
 *     → { cleanName: "Acrylic Silicone", colorName: "white", baseType: WHITE, isTinted: false }
 *
 *   "2.5L 2,451.95 TKM 10002.5L Bathroom Plus Pastel OFFSHORE 50"
 *     → { cleanName: "Bathroom Plus", colorName: "offshore 50", baseType: PASTEL, isTinted: true }
 *
 *   "1 764.10 TLS001000 Prof Superior Low Sheen Acrylic T/Base"
 *     → { cleanName: "Prof Superior Low Sheen Acrylic", colorName: null, baseType: DEEP, isTinted: false }
 */
export function parseBuildSmartProduct(rawDescription: string): {
  cleanName: string;
  colorName: string | null;
  baseType: ColorBaseType;
  isTinted: boolean;
  sku: string | null;
  colorCode?: string | null;
} {
  const productCode = inferBuildSmartProductCode(rawDescription);

  // Step 1: strip leading cost code (6-10 digits) from the display name.
  // Plain numeric BuildSmart prefixes are cost codes, not product SKUs.
  const skuMatch = rawDescription.match(/^(\d{6,10})\s+(.+)$/);
  const numericPrefix = skuMatch ? skuMatch[1] : null;
  const sku =
    productCode ??
    (numericPrefix && !isNumericCostCode(numericPrefix) ? numericPrefix : null);
  const withoutSku = skuMatch ? skuMatch[2] : rawDescription;

  // Step 2: extract color variant (operates on the full remaining text so it
  // can see base-type keywords even when they appear after price noise)
  const {
    cleanName: afterColor,
    colorName,
    baseType,
    isTinted,
    colorCode,
  } = extractColorVariant(withoutSku);

  // Step 3: clean remaining noise
  const cleanName = cleanProductName(afterColor);

  return { cleanName, colorName, baseType, isTinted, sku, colorCode };
}

// ── normalizeProductName ─────────────────────────────────────────────────────

/**
 * Reduce a name to a comparable form for duplicate detection.
 */
export function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

/**
 * True iff two product names normalise to the same string.
 */
export function canMergeProducts(name1: string, name2: string): boolean {
  const n1 = normalizeProductName(name1);
  const n2 = normalizeProductName(name2);
  return n1 === n2 && n1.length > 0;
}

/**
 * True iff two color variants can be safely merged (same colorName + baseType).
 * Explicitly rejects White vs Off-White, Deep vs Pastel, etc.
 */
export function canMergeColorVariants(
  a: { colorName: string; baseType: ColorBaseType },
  b: { colorName: string; baseType: ColorBaseType },
): boolean {
  const color1 = normalizeProductName(a.colorName);
  const color2 = normalizeProductName(b.colorName);
  return color1 === color2 && a.baseType === b.baseType;
}
