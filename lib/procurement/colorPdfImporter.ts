/**
 * Color & price extraction from BuildSmart PO PDFs and Plascon/Dulux price lists.
 *
 * Order PDFs contain item descriptions like:
 *   "Prof Superior Low Sheen Acrylic T/Base Pastel - GR-B09 BERLIN BLOCK"
 *   "Prof. Super Matt T/Base Pastel - BERLIN BLOCK GR-B09"
 *   "Prof Superior Low Sheen Acrylic T/Base Pastel - GARDEN SEAT G1-E1-1"
 *   "FRESH COTE - WHITE"
 *   "Prof.Waterproofing Compound Off-White"
 *
 * Price list PDFs (Plascon / Dulux) contain rows like:
 *   "TLS1000 PASTEL 803,08 R 437,30 R ..."
 *   "DLX ACRYLIC PVA - TRANSP - BASE 9 1 400,00 R 1 335,67 R 4,82%"
 */

import { createRequire } from "node:module";
import type { ColorBaseType } from "@/generated/prisma/client";
import { parsePdfBuffer } from "@/lib/buildsmart-parser";
import { normalizeSupplierName } from "@/lib/buildsmart-import-mappings";
import {
  inferBuildSmartProductCode,
  normalizeSkuKey,
} from "@/lib/procurement/buildsmartProductCodes";

const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");

// ── Public types ────────────────────────────────────────────────────────────

export type ExtractedColor = {
  sourceFile: string;
  orderNumber: string | null;
  vendorName: string | null;
  vendorCode: string | null;
  rawDescription: string;
  baseType: ColorBaseType;
  colorName: string | null;
  colorCode: string | null;
  isTinted: boolean;
};

export type ExtractedPriceRow = {
  sourceFile: string;
  brand: "PLASCON" | "DULUX";
  productCode: string | null;
  productLabel: string;
  baseType: ColorBaseType;
  unitSizeL: number | null;
  priceZar: number | null;
};

// ── Base-type label maps ────────────────────────────────────────────────────
// Patterns are tested most-specific first.

type BaseRule = { match: RegExp; baseType: ColorBaseType };

const BASE_RULES: BaseRule[] = [
  // Compound supplier-specific labels
  { match: /transp(?:arent)?\s*-\s*base\s*9/i, baseType: "CLEAR" },
  { match: /pastel\s*-?\s*base\s*7/i, baseType: "PASTEL" },
  { match: /deep\s*-?\s*base\s*8/i, baseType: "DEEP" },
  { match: /medium\s*-?\s*8/i, baseType: "DEEP" },
  { match: /u[\.\/]?\s*deep\s*-?\s*6/i, baseType: "DEEP" },
  { match: /\bbase\s*6\b/i, baseType: "DEEP" },
  { match: /\bbase\s*7\b/i, baseType: "PASTEL" },
  { match: /\bbase\s*8\b/i, baseType: "DEEP" },
  { match: /\bbase\s*9\b/i, baseType: "CLEAR" },
  // Standalone T/Base markers
  { match: /t\s*\/\s*base\s+pastel/i, baseType: "PASTEL" },
  { match: /t\s*\/\s*base\s+deep/i, baseType: "DEEP" },
  { match: /t\s*\/\s*base\s+(?:transparent|transp|clear)/i, baseType: "CLEAR" },
  { match: /t\s*\/\s*base\s+neutral/i, baseType: "NEUTRAL" },
  { match: /t\s*\/\s*base\s+(?:medium|natural)/i, baseType: "NEUTRAL" },
  // Generic single words
  { match: /\bpastel\b/i, baseType: "PASTEL" },
  { match: /\bdeep\s*base\b/i, baseType: "DEEP" },
  { match: /\bdeep\b/i, baseType: "DEEP" },
  { match: /\b(?:transparent|transp|clear)\b/i, baseType: "CLEAR" },
  { match: /\b(?:neutral|natural)\b/i, baseType: "NEUTRAL" },
  { match: /\boff[-\s]?white\b/i, baseType: "WHITE" },
  { match: /\bpure\s+white\b/i, baseType: "WHITE" },
  { match: /\bbright\s+white\b/i, baseType: "WHITE" },
  { match: /\bwhite\b/i, baseType: "WHITE" },
];

export function detectBaseType(text: string): {
  baseType: ColorBaseType | null;
  matched: string | null;
} {
  for (const rule of BASE_RULES) {
    const m = text.match(rule.match);
    if (m) return { baseType: rule.baseType, matched: m[0] };
  }
  return { baseType: null, matched: null };
}

// ── Color name + code extraction ────────────────────────────────────────────

// Colour code patterns:
//   • Plascon  : 2-3 dash-separated segments, each 1-4 alnum (GR-B09, G1-E1-1, AL-YO3)
//   • Dulux    : <digits><letters><digits>/<digits>           (68YR28/701, 06YY08/048, 00NN83/000)
const DULUX_CODE_RE = /\b\d{1,2}[A-Z]{1,3}\d{1,3}\/\d{1,4}\b/;
const PLASCON_CODE_RE = /\b[A-Z0-9]{1,4}(?:-[A-Z0-9]{1,4}){1,2}\b/;
const COLOR_CODE_RE = new RegExp(
  `(${DULUX_CODE_RE.source}|${PLASCON_CODE_RE.source})`,
);
const COLOR_CODE_RE_GLOBAL = new RegExp(COLOR_CODE_RE.source, "g");

// Trailing trailing noise we don't want in the color name (size, quantity).
const TRAILING_SIZE_RE = /\s*\b\d+\s*(?:L|ML|KG|G)\b\s*$/i;
const TRAILING_QTY_RE = /\s+\d+\s*$/;

function cleanColorName(raw: string): string {
  return raw
    .replace(COLOR_CODE_RE_GLOBAL, "")
    .replace(TRAILING_SIZE_RE, "")
    .replace(TRAILING_QTY_RE, "")
    .replace(/[-–—]+\s*$/, "")
    .replace(/^[-–—\s]+/, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .toUpperCase();
}

/**
 * Extract the color portion from a raw item description.
 *
 * Strategy:
 *   1. If the description has "T/Base <Base> - <Color portion>", isolate the
 *      color portion after the dash.
 *   2. Otherwise look for a trailing UPPERCASE NAME + optional CODE pattern.
 */
export function extractColorAndBase(rawDescription: string): {
  baseType: ColorBaseType;
  colorName: string | null;
  colorCode: string | null;
  isTinted: boolean;
} {
  const text = rawDescription.replace(/\s+/g, " ").trim();

  // 1. Find base type anywhere in the text
  const baseHit = detectBaseType(text);
  const baseType: ColorBaseType = baseHit.baseType ?? "DEEP";

  // 2. Isolate the color portion (text after a T/Base ... dash, if present)
  let colorPortion: string | null = null;

  const tbaseDashMatch = text.match(
    /t\s*\/\s*base\s+\w+\s*-\s*(.+?)(?:\s+\d+\s*(?:L|ML|KG|G)\b.*)?$/i,
  );
  if (tbaseDashMatch && tbaseDashMatch[1]) {
    colorPortion = tbaseDashMatch[1].trim();
  }

  // Fallback: take everything trailing the last " - " (handles "FRESH COTE - WHITE")
  if (!colorPortion) {
    const lastDash = text.match(/.*[\-–—]\s*([^\-–—]+?)\s*(?:\d+\s*(?:L|ML|KG|G))?\s*$/i);
    if (lastDash && lastDash[1]) {
      colorPortion = lastDash[1].trim();
    }
  }

  let colorCode: string | null = null;
  let colorName: string | null = null;

  if (colorPortion) {
    const codeMatch = colorPortion.match(COLOR_CODE_RE);
    if (codeMatch) {
      colorCode = codeMatch[1];
      colorName = cleanColorName(colorPortion);
    } else {
      colorName = cleanColorName(colorPortion);
    }
  }

  // If the only thing we got is the base label itself (e.g. "WHITE", "PASTEL"),
  // that's not a real tint — keep colorName as that label but mark untinted.
  let isTinted = false;
  if (colorName) {
    const isOnlyBaseLabel = BASE_RULES.some((r) =>
      new RegExp(`^${r.match.source}$`, "i").test(colorName!),
    );
    isTinted = !isOnlyBaseLabel && !!colorCode;
  }

  // If we have no base hit AND no real color, return null colorName.
  if (!baseHit.baseType && !colorName) {
    return { baseType, colorName: null, colorCode: null, isTinted: false };
  }

  return { baseType, colorName, colorCode, isTinted };
}

// ── PDF text extraction helper ──────────────────────────────────────────────

async function readPdfText(buffer: Buffer): Promise<string | null> {
  if (!buffer || buffer.length === 0) return null;
  try {
    const parser = new PDFParse({ data: buffer } as { data: Buffer });
    const result = await parser.getText();
    await parser.destroy();
    return (result.text ?? "").replace(/\r/g, "\n");
  } catch {
    return null;
  }
}

// ── Order PDF → extracted colors ────────────────────────────────────────────

export async function extractColorsFromOrderPdf(
  buffer: Buffer,
  fileName: string,
): Promise<ExtractedColor[]> {
  const parsed = await parsePdfBuffer(buffer);
  if (!parsed) return [];

  const results: ExtractedColor[] = [];
  for (const item of parsed.items) {
    const { baseType, colorName, colorCode, isTinted } = extractColorAndBase(
      item.rawDescription,
    );
    // Skip non-paint items (no color extracted AND nothing base-y)
    if (!colorName && !colorCode) continue;

    results.push({
      sourceFile: fileName,
      orderNumber: parsed.orderNumber,
      vendorName: parsed.vendorName,
      vendorCode: parsed.vendorCode,
      rawDescription: item.rawDescription,
      baseType,
      colorName,
      colorCode,
      isTinted,
    });
  }

  return results;
}

// ── Price list PDF → supplier prices ────────────────────────────────────────
// The Plascon/Dulux price list is a 2-column layout. We split each line into
// a Plascon side and a Dulux side, then extract (product, base, prices).

const NUMERIC_PRICE_RE = /([0-9]{1,3}(?:[  ][0-9]{3})*,[0-9]{2})/g;

function parseZar(num: string): number {
  return Number(num.replace(/[\s ]/g, "").replace(",", "."));
}

function detectSizesFromHeader(text: string): { has20L: boolean; has5L: boolean } {
  return {
    has20L: /20\s*LITRES?/i.test(text),
    has5L: /5\s*LITRES?/i.test(text),
  };
}

function classifyPriceLine(line: string): {
  brand: "PLASCON" | "DULUX" | null;
  plasconSide: string;
  duluxSide: string;
} {
  // Heuristic: Plascon products tend to start with codes like TLS, TSA, PEM, TAP,
  // TDV, TVG, TVW, PWC, PEM, NY, G, EMS, AW, TH, WUP, UC, GIP, EPL, BBO, TMX, VLO,
  // VLW. Dulux products tend to have "TRADE", "DULUX", "LUX SILK", "DLX", "BERGER".
  const PLASCON_PREFIX = /^(TLS|TSA|PEM|TAP|TDV|TVG|TVW|PWC|NY|EMS|AW|TH|WUP|UC|GIP|EPL|BBO|TMX|VLO|VLW|PU|PSB|PSI|G\b|PP\d|UC2|PGS1|PEM)/i;

  // Try to split on long tab/whitespace runs to separate the two columns
  const split = line.split(/\s{2,}|\t+/).filter(Boolean);
  let plasconSide = "";
  let duluxSide = "";

  for (const chunk of split) {
    if (
      /\b(TRADE|DULUX|LUX SILK|DLX|BERGER|WEATHER|RAINSHIELD|DAMPSHIELD|SMOOTHOVER|ECOSURE|PEARLGLO|WOOD PRIMER|GALVANISED|ALKALI)\b/i.test(
        chunk,
      )
    ) {
      duluxSide += " " + chunk;
    } else if (PLASCON_PREFIX.test(chunk.trim())) {
      plasconSide += " " + chunk;
    } else if (plasconSide && !duluxSide) {
      plasconSide += " " + chunk;
    } else if (duluxSide) {
      duluxSide += " " + chunk;
    } else {
      plasconSide += " " + chunk;
    }
  }

  let brand: "PLASCON" | "DULUX" | null = null;
  if (plasconSide.trim()) brand = "PLASCON";
  if (duluxSide.trim() && !brand) brand = "DULUX";

  return { brand, plasconSide: plasconSide.trim(), duluxSide: duluxSide.trim() };
}

function extractRowFromSide(
  side: string,
  brand: "PLASCON" | "DULUX",
  sourceFile: string,
): ExtractedPriceRow[] {
  const rows: ExtractedPriceRow[] = [];
  if (!side.trim()) return rows;

  // Capture the product code (alphanumeric leading token, e.g. TLS1000, PEM 900)
  const codeMatch = side.match(/^([A-Z]{1,4}\d?(?:\s*\d{2,4})?[A-Z0-9]*)/i);
  const productCode = codeMatch ? codeMatch[1].replace(/\s+/g, "") : null;

  // The base type sits in the readable part before the prices
  const beforePrices = side.split(NUMERIC_PRICE_RE)[0] ?? side;
  const baseHit = detectBaseType(beforePrices);
  if (!baseHit.baseType) return rows;

  // Pull every "R xxx,yy" price token (or just the numeric)
  const prices = Array.from(side.matchAll(NUMERIC_PRICE_RE)).map((m) =>
    parseZar(m[1]),
  );

  // Typical layout: 20L_price, 5L_price, %inc — sometimes just one price.
  // We emit one row per detected price, alternating size 20L / 5L.
  // If only one price we assume 20L.
  const sizes: (number | null)[] = [20, 5];
  let sizeIdx = 0;
  for (let i = 0; i < prices.length && sizeIdx < sizes.length; i++) {
    const p = prices[i];
    if (!Number.isFinite(p)) continue;
    if (p <= 5) {
      // a percentage like 3,00 — skip, do not consume size slot
      continue;
    }
    rows.push({
      sourceFile,
      brand,
      productCode,
      productLabel: beforePrices.trim(),
      baseType: baseHit.baseType,
      unitSizeL: sizes[sizeIdx],
      priceZar: p,
    });
    sizeIdx++;
  }

  return rows;
}

export async function extractPricesFromPriceListPdf(
  buffer: Buffer,
  fileName: string,
): Promise<ExtractedPriceRow[]> {
  const text = await readPdfText(buffer);
  if (!text) return [];

  const rows: ExtractedPriceRow[] = [];
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    // Need at least one ZAR-style number to be a candidate price row
    if (!NUMERIC_PRICE_RE.test(line)) continue;
    NUMERIC_PRICE_RE.lastIndex = 0;

    const { plasconSide, duluxSide } = classifyPriceLine(line);

    if (plasconSide) {
      rows.push(...extractRowFromSide(plasconSide, "PLASCON", fileName));
    }
    if (duluxSide) {
      rows.push(...extractRowFromSide(duluxSide, "DULUX", fileName));
    }
  }

  return rows;
}

// ── Supplier-name normalisation export (re-exported for convenience) ────────

export { normalizeSupplierName };

// ── Tint catalogue product (shared placeholder) ─────────────────────────────
// All "standalone" colour variants (not tied to a real procurement product)
// attach to this single placeholder product so the existing colors UI can
// dedupe by colorName+baseType across both real products and standalone
// catalogue entries.

export const TINT_CATALOGUE_PRODUCT_SKU = "__TINT_CATALOGUE__";
export const TINT_CATALOGUE_PRODUCT_NAME = "Paint Tint Catalogue";

// Detect "size NL" tokens (e.g. "5L", "20L") in a description.
export function detectUnitSizeL(text: string): number | null {
  const m = text.match(/\b(\d+(?:\.\d+)?)\s*L\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ── Price-row → product matching (with duplicate handling) ──────────────────

export type MatchableProduct = {
  id: string;
  name: string;
  sku: string | null;
  normalizedName?: string | null;
};

// Plascon codes: TLS, TSA, TCP, PEM, TAP, TWA, TCA, TDV, TGE, TVG, TVW, TMX, WAA, etc.
const PLASCON_CODE_PREFIXES = new Set([
  "TLS", "TSA", "TCP", "PEM", "TAP", "TDV", "TVG", "TVW", "TMX",
  "TWA", "TCA", "TGE", "PWC", "PSB", "PSI", "BBO", "VLO", "VLW",
  "MAR", "WAA", "TPM", "PES", "TED", "EPL", "ASS", "GW", "WSP", "FPR",
  "TRP", "PRH", "PRT", "PEX", "PEH", "EPD", "GIP", "EMS", "UC", "PP",
  "PGS", "AW", "TH", "WUP", "NY", "TBD", "WBS", "SP", "TVN",
]);

// Dulux/Trade product name keywords (positive)
const DULUX_NAME_KEYWORDS = [
  "TRADE", "DULUX", "LUX SILK", "DLX", "BERGER", "RAINSHIELD",
  "DAMPSHIELD", "ROOFGUARD", "WALLGUARD", "WEATHERSHIELD",
  "WEATHERGUARD", "EASYCARE", "STERISHIELD", "WALLCLAD", "FLOORCOTE",
  "PEARLGLO", "SMOOTHOVER", "ECOSURE", "TIMBA",
];

// Tokens that imply a colour-tinted variant in the product NAME (these should
// be filtered out when matching base-product prices, since prices apply to the
// base product not a specific colour).
const VARIANT_TOKENS_IN_NAME = [
  // Plascon colour codes
  /\b[A-Z]{1,3}-[A-Z0-9]{1,4}(?:-[A-Z0-9]{1,4})?\b/,
  // Dulux colour codes
  /\b\d{2}[A-Z]{2}\d{2}\/\d{3}\b/,
  // Year-stamp tags
  /\b20\d{2}\/\d{1,2}\/\d{1,2}\b/,
];

function looksLikeTintedVariantName(name: string): boolean {
  for (const re of VARIANT_TOKENS_IN_NAME) {
    if (re.test(name)) return true;
  }
  return false;
}

/**
 * Match a price-list row to every relevant ProcurementProduct in the catalogue.
 *
 * Strategy:
 *   1. Normalise the price-row code (e.g. "TLS1000" → "TLS001000",
 *      "PEM 900" → "PEM000900") via inferBuildSmartProductCode + normalizeSkuKey.
 *   2. Find the canonical product whose normalised SKU equals that key. Sizes
 *      belong on SupplierProductPrice, so size-suffixed product rows like
 *      "TLS00100020L" must not receive their own duplicate price rows.
 *   3. Drop products whose name embeds a specific tint code (those are
 *      colour-tinted rows that shouldn't get the base price).
 *   4. If brand=DULUX and no Plascon-style code was given, fall back to
 *      matching product name keywords (TRADE/DULUX/etc.).
 */
export function matchPriceRowToProducts(
  row: ExtractedPriceRow,
  products: MatchableProduct[],
): MatchableProduct[] {
  if (!products.length) return [];

  const matches: MatchableProduct[] = [];
  const seenIds = new Set<string>();

  const pushCanonicalSkuMatches = (
    candidates: MatchableProduct[],
    targetKey: string,
  ) => {
    const exact = candidates.filter(
      (p) => p.sku && normalizeSkuKey(p.sku) === targetKey,
    );
    const pool = exact.length > 0 ? exact : candidates;
    pool
      .sort((left, right) => {
        const leftSku = normalizeSkuKey(left.sku);
        const rightSku = normalizeSkuKey(right.sku);
        return (
          leftSku.length - rightSku.length ||
          left.name.localeCompare(right.name) ||
          left.id.localeCompare(right.id)
        );
      })
      .slice(0, 1)
      .forEach((p) => {
        if (seenIds.has(p.id)) return;
        matches.push(p);
        seenIds.add(p.id);
      });
  };

  // ── Plascon: SKU-based matching ──
  if (row.productCode) {
    const inferred = inferBuildSmartProductCode(row.productCode, null);
    const canonicalKey = normalizeSkuKey(inferred ?? row.productCode);
    if (canonicalKey.length >= 4) {
      const prefix3 = canonicalKey.slice(0, 3);
      const isPlasconPrefix = PLASCON_CODE_PREFIXES.has(prefix3);

      // Tier 1: exact canonical SKU. Do not fan out to size-suffixed products;
      // those sizes are represented by SupplierProductPrice.unitSize.
      const exactCandidates = products.filter((p) => {
        if (!p.sku) return false;
        const sk = normalizeSkuKey(p.sku);
        if (sk !== canonicalKey) return false;
        if (sk === prefix3) return false; // skip bare-prefix catalogue stubs
        if (looksLikeTintedVariantName(p.name)) return false;
        if (row.brand === "PLASCON" && !isPlasconPrefix) return false;
        return true;
      });
      pushCanonicalSkuMatches(exactCandidates, canonicalKey);

      // Tier 2: family-base fallback. Price-list codes like "TAP3000" don't
      // always exist verbatim in the DB (which may store "TAP003010" for the
      // same transparent base). Fall back to matching on prefix + family-base
      // digit and keep the shortest/canonical SKU in that family.
      if (matches.length === 0 && canonicalKey.length >= 6) {
        const familyKey = canonicalKey.slice(0, 6); // 3 letters + 3 digits
        const familyCandidates = products.filter((p) => {
          if (!p.sku) return false;
          const sk = normalizeSkuKey(p.sku);
          if (sk === prefix3) return false;
          if (!sk.startsWith(familyKey)) return false;
          const tail = sk.slice(familyKey.length);
          if (tail.length > 3) return false;
          if (looksLikeTintedVariantName(p.name)) return false;
          if (row.brand === "PLASCON" && !isPlasconPrefix) return false;
          return true;
        });
        pushCanonicalSkuMatches(familyCandidates, canonicalKey);
      }
    }
  }

  // ── Dulux / fallback: name-keyword matching ──
  if (matches.length === 0 && row.brand === "DULUX") {
    const labelUp = row.productLabel.toUpperCase();
    const labelTokens = labelUp.split(/[\s\-]+/).filter((w) => w.length >= 4);

    for (const p of products) {
      if (seenIds.has(p.id)) continue;
      const nameUp = p.name.toUpperCase();
      if (looksLikeTintedVariantName(p.name)) continue;
      const isDuluxFamily = DULUX_NAME_KEYWORDS.some((k) => nameUp.includes(k));
      if (!isDuluxFamily) continue;
      // Require at least one significant 4+ char keyword overlap
      const overlap = labelTokens.filter(
        (t) =>
          DULUX_NAME_KEYWORDS.includes(t) ||
          (nameUp.includes(t) && t.length >= 5),
      );
      if (overlap.length === 0) continue;
      matches.push(p);
      seenIds.add(p.id);
    }
  }

  return matches;
}
