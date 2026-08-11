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
// BuildSmart invoice references (INV31666, INV0004623, IN342859, INB64486, INC20163, ...):
// 2-3 leading letters starting with "IN" directly followed by digits, no space.
const LEADING_INVOICE_REF_RE = /^IN[A-Z]{0,2}\d{3,}\s+/i;
// Real product SKUs are usually written with no space between the letter prefix
// and the digits (PEM00060020, TSA001010, ACC192694), though a spaced form
// (rare) is also accepted.
const LEADING_PRODUCT_CODE_RE = /^[A-Z]{1,4}\s*\d{4,}[A-Z0-9]*\s+/i;
const TBASE_RE = /\bT\/Base\b\s*/gi;
const PACK_RE = /\bPack\s+\d+\s*$/i;
const BOX_COUNT_SUFFIX_RE = /\s*[-–—]?\s*\(\s*\d+\s*boxe?s?\s*\)\s*$/i;
const TRAILING_3DIGIT_RE = /\s+\d{3,}\s*$/;
const TRAILING_SIZE_RE =
  /\s+\d+(?:\.\d+)?\s*(?:KG|G|L|ML|LTR|M2|M3|MM|CM|M)\s*$/i;
const TRAILING_PRICE_RE = /\s+R\s?\d+[.,]?\d*\s*$/i;
const TRAILING_DASH_COLOR_CODE_RE =
  /^(?<product>.+?)\s+[-–—]\s+(?<color>[A-Za-z][A-Za-z0-9\s]{1,80}?)\s+(?<code>(?:\d{1,2}[A-Z]{1,3}\d{1,3}\/\d{1,4}|[A-Z0-9]{1,5}(?:-[A-Z0-9]{1,5}){1,2}))\s*$/i;
const TBASE_COLOR_RE =
  /^(?<product>.+?)\bT\/Base\s+(?<base>Pastel|Deep|Transparent|Transp|Clear|Neutral|Medium|Natural)\s*[-–—]\s*(?<colorPortion>.+?)\s*$/i;
const TRAILING_DULUX_COLOR_CODE_RE =
  /^(?<product>.+?)\s*[-–—]?\s+(?<color>[A-Za-z][A-Za-z0-9\s]{1,80}?)\s+(?<code>\d{1,2}[A-Z]{1,3}\d{1,3}\/\d{1,4})\s*$/i;
const LEADING_PLASCON_COLOR_CODE_RE =
  /^(?<code>[A-Z0-9]{1,5}(?:-[A-Z0-9]{1,5}){1,2})\s+(?<color>[A-Za-z][A-Za-z0-9\s]{1,80}?)\s*$/i;
const TRAILING_PLASCON_COLOR_CODE_RE =
  /^(?<color>[A-Za-z][A-Za-z0-9\s]{1,80}?)\s+(?<code>[A-Z0-9]{1,5}(?:-[A-Z0-9]{1,5}){1,2})\s*$/i;

const PROTECTED_WORDS = ["mix masala", "masala mix"];

// Plascon/Marmoran-style colour code token (GS10255, GS09392-2, AS006, ...):
// 1-3 letters directly followed by 2-6 digits, optional "-digit" suffix.
const COLOR_CODE_TOKEN_RE = /^[A-Z]{1,3}\d{2,6}(?:-\d{1,3})?$/i;

// Product SKUs that happen to share the letters+digits shape of a colour
// code, but aren't one (e.g. Soudal Multibond sealant "SMX35"). Extend this
// list when another non-colour code is found to false-positive.
const NON_COLOR_CODE_TOKEN_RE = /^SMX\d+$/i;

function baseTypeFromTBaseLabel(label: string): ColorBaseType {
  const normalized = label.trim().toLowerCase();
  if (normalized === "pastel") return "PASTEL";
  if (["transparent", "transp", "clear"].includes(normalized)) return "CLEAR";
  if (["neutral", "medium", "natural"].includes(normalized)) return "NEUTRAL";
  return "DEEP";
}

function extractColorNameAndCode(colorPortion: string): {
  colorName: string;
  colorCode: string | null;
} {
  const trimmed = colorPortion.trim();
  const leadingCode = trimmed.match(LEADING_PLASCON_COLOR_CODE_RE);
  if (leadingCode?.groups) {
    return {
      colorName: leadingCode.groups.color.trim().toUpperCase(),
      colorCode: leadingCode.groups.code.trim().toUpperCase(),
    };
  }

  const trailingDashCode = trimmed.match(TRAILING_DASH_COLOR_CODE_RE);
  if (trailingDashCode?.groups) {
    return {
      colorName: trailingDashCode.groups.color.trim().toUpperCase(),
      colorCode: trailingDashCode.groups.code.trim().toUpperCase(),
    };
  }

  const trailingDuluxCode = trimmed.match(TRAILING_DULUX_COLOR_CODE_RE);
  if (trailingDuluxCode?.groups) {
    return {
      colorName: trailingDuluxCode.groups.color.trim().toUpperCase(),
      colorCode: trailingDuluxCode.groups.code.trim().toUpperCase(),
    };
  }

  const trailingPlasconCode = trimmed.match(TRAILING_PLASCON_COLOR_CODE_RE);
  if (trailingPlasconCode?.groups) {
    return {
      colorName: trailingPlasconCode.groups.color.trim().toUpperCase(),
      colorCode: trailingPlasconCode.groups.code.trim().toUpperCase(),
    };
  }

  return { colorName: trimmed.toUpperCase(), colorCode: null };
}

// ── cleanProductName ─────────────────────────────────────────────────────────

/**
 * Remove BuildSmart noise from a product description:
 *   - Leading invoice reference (e.g. "INV31666 ", "INB64486 ")
 *   - Leading 4+ digit bare SKU/line-item code
 *   - Leading BuildSmart product code (spaced or unspaced, e.g. "PEM00060020")
 *   - Leading size token (e.g. "2.5L ", "500ML ")
 *   - Embedded prices (e.g. "58.70", "2,451.95")
 *   - Leading short quantity (bare 1-3 digit number)
 *   - TLS / TKM supplier codes
 *   - "T/Base" suffix
 *   - Trailing "Pack N", trailing size, trailing 3+ digit codes, trailing pack-count note
 */
export function cleanProductName(rawName: string): string {
  let name = rawName.trim();

  // -1. Remove a leading list-index prefix (e.g. "1-INV31666 ...", "2-INV33335 ...")
  name = name.replace(/^\d{1,2}-\s*/, "");

  // 0. Remove leading invoice reference (INV31666, INV0004623, INB64486, ...)
  //    — this is a per-invoice number, not part of the product identity, and
  //    left in place it splits one product into many duplicates.
  name = name.replace(LEADING_INVOICE_REF_RE, "").trim();

  // 1. Remove leading 4+ digit bare SKU/line-item code (e.g. "58551 ", "622759 ")
  name = name.replace(/^\d{4,}\s+/, "");

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

  // 8. Remove trailing standalone 3+ digit numeric code (e.g. "292"), unless
  //    the number is actually the product line's name (e.g. "Trade 100",
  //    "Trade 65") rather than a noise code.
  if (!/\bTRADE\s*\d{2,4}\s*$/i.test(name)) {
    name = name.replace(TRAILING_3DIGIT_RE, "").trim();
  }

  // 9. Remove trailing size suffix, unless the name is a protected product
  const lower = name.toLowerCase();
  if (!PROTECTED_WORDS.some((w) => lower.includes(w))) {
    name = name.replace(TRAILING_SIZE_RE, "").trim();
  }

  // 10. Remove trailing R-prefixed price
  name = name.replace(TRAILING_PRICE_RE, "").trim();

  // 11. Remove trailing pack-count note, e.g. "(5boxes)", "- (2 boxes)"
  name = name.replace(BOX_COUNT_SUFFIX_RE, "").trim();

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
  const tbaseColorMatch = rawDescription.match(TBASE_COLOR_RE);
  if (tbaseColorMatch?.groups) {
    const { colorName, colorCode } = extractColorNameAndCode(
      tbaseColorMatch.groups.colorPortion,
    );
    return {
      cleanName: tbaseColorMatch.groups.product.trim(),
      colorName,
      baseType: baseTypeFromTBaseLabel(tbaseColorMatch.groups.base),
      isTinted: true,
      colorCode,
    };
  }

  const dashColorMatch = rawDescription.match(TRAILING_DASH_COLOR_CODE_RE);
  if (dashColorMatch?.groups) {
    return {
      cleanName: dashColorMatch.groups.product.trim(),
      colorName: dashColorMatch.groups.color.trim().toUpperCase(),
      baseType: "NEUTRAL",
      isTinted: true,
      colorCode: dashColorMatch.groups.code.trim().toUpperCase(),
    };
  }

  const trailingDuluxColorMatch = rawDescription.match(
    TRAILING_DULUX_COLOR_CODE_RE,
  );
  if (trailingDuluxColorMatch?.groups) {
    return {
      cleanName: trailingDuluxColorMatch.groups.product.trim(),
      colorName: trailingDuluxColorMatch.groups.color.trim().toUpperCase(),
      baseType: "NEUTRAL",
      isTinted: true,
      colorCode: trailingDuluxColorMatch.groups.code.trim().toUpperCase(),
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

  // 2c. Fallback: a Plascon/Marmoran-style colour code appears somewhere in
  // the description, with no base-type keyword nearby (e.g. "Permasuede
  // GS10255 Elephant Tail 46yy", "Permacrete GS09392-2"). Unlike the tint
  // words above, an actual code token is specific enough that it doesn't
  // need the base-type guard below — treat everything from the first such
  // token onward as the colour, keeping the text before it as the name.
  // Skip for sandpaper: "P60"/"P80"/"P100" etc are grit sizes, not colours.
  if (!colorName && !/sandpaper/i.test(rawDescription)) {
    const tokens = rawDescription.trim().split(/\s+/);
    const codeIdx = tokens.findIndex(
      (t) => COLOR_CODE_TOKEN_RE.test(t) && !NON_COLOR_CODE_TOKEN_RE.test(t),
    );
    // A bare "Name - CODE" (nothing but a dash between name and code) is the
    // existing "name plus SKU reference" display convention, not a colour —
    // leave it untouched rather than mistaking the SKU for a tint.
    const isBareSkuReference = codeIdx > 0 && tokens[codeIdx - 1] === "-";
    if (codeIdx > 0 && !isBareSkuReference) {
      return {
        cleanName: tokens.slice(0, codeIdx).join(" "),
        colorName: tokens.slice(codeIdx).join(" ").toUpperCase(),
        baseType,
        isTinted: true,
        colorCode: null,
      };
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
