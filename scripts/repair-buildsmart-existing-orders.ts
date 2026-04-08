import "dotenv/config";

import fs from "node:fs";
import path from "node:path";

import { prisma } from "../lib/prisma";
import {
  classifyProductMode,
  getCanonicalFamily,
  matchBuildSmartProduct,
  normalizeImportedProductName,
  shouldCreateNewProduct,
  type MatchableProcurementProduct,
  type ProductMatch,
} from "../lib/procurement/buildsmartProductMatcher";
import { mapDescriptionToProduct } from "../lib/buildsmart-import-mappings";
import { resolveUnitPrice } from "../lib/procurement/resolveUnitPrice";
import { recalcOrderTotal } from "../lib/procurement/recalcOrderTotal";
import { STRICT_CANONICAL_PRODUCT_OVERRIDES } from "./buildsmart-canonical-repair-overrides";
import { STRICT_SHOP_ITEM_CODE_OVERRIDES } from "./buildsmart-shop-item-repair-overrides";

type RepairMode = "DRY_RUN" | "APPLY";

type RepairChange = {
  orderId: string;
  orderReference: string | null;
  orderSupplier: string | null;
  itemId: string;
  rawName: string;
  mode: string;
  reason: string;
  oldProductId: string;
  oldProductName: string;
  newProductId: string;
  newProductName: string;
  oldPrice: string;
  newPrice: string;
};

type ManualReviewRow = {
  orderId: string;
  orderReference: string | null;
  itemId: string;
  rawName: string;
  currentProductId: string;
  currentProductName: string;
  currentPrice: string;
  mode: string;
  reason: string;
};

type InactiveCandidate = {
  productId: string;
  name: string;
  description: string | null;
};

type ProductLike = {
  name?: string | null;
  description?: string | null;
  sku?: string | null;
};

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function toPriceString(value: unknown): string {
  return toNumber(value).toFixed(2);
}

const VARIANT_NOISE_PATTERNS = [
  /\bWHITE(?:\s+TINT)?\b/g,
  /\bCLEAR\s+BASE(?:\s+TINT)?\b/g,
  /\bCLEAR\b/g,
  /\bPASTEL(?:\s*\d+)?\b/g,
  /\bMEDIUM(?:\s*\d+)?\b/g,
  /\bDEEP(?:\s*\d+)?\b/g,
  /\bBASE\s*[6789]\b/g,
  /\bU\s+DEEP\b/g,
  /\bEX\s+DEEP\b/g,
  /\bTINT\b/g,
  /\bALL\s+COLOU?RS\b/g,
  /\bSTANDARD\s+COLOU?RS\b/g,
];

const BRAND_TOKENS = new Set(["DULUX", "PLASCON", "PROMINENT", "TRADE"]);

const STRICT_CANONICAL_REPAIR_KEYS = new Set([
  "DULUX_TRADE_100_LOWSHEEN",
  "DULUX_WATERBASED_PEARLGLO",
  "DULUX_SOLVENT_BASE_PEARLGLO",
  "DULUX_TRADE_WALLCLAD",
  "DULUX_TRADE_STERISHIELD_DIAMOND_MATT",
  "PLASCON_PEM_900",
  "PLASCON_TSA_1010",
  "PLASCON_TCA_1000",
  "PLASCON_VELVAGLO",
  "DULUX_ROOFGUARD",
  "DULUX_DURA100",
  "DULUX_TRADE65",
  "DULUX_LUX_SILK",
  "POLYCELL_POLYFILLA",
  "PLASCON_CODED_TINT_PRODUCTS",
  "PROMINENT_SELECT_SHEEN",
  "PROMINENT_SATIN_SILK",
  "PROMINENT_MATT",
  "PROMINENT_NEUKLAD",
  "PROMINENT_ULTRASHEEN",
]);

const STRICT_CANONICAL_TARGET_HINTS: Record<string, RegExp[]> = {
  DULUX_TRADE_100_LOWSHEEN: [
    /^TRADE\s*100\s*LOWSHEEN\s*-\s*PASTEL\s*7$/i,
    /^DULUX\s+TRADE\s+100\s+LOWSHEEN\s+BASE\s+7\b/i,
    /^TRADE\s*100\s*LOWSHEEN\s+WHITE$/i,
  ],
  DULUX_WATERBASED_PEARLGLO: [
    /^WATERBASED\s+PEARLGLO\s*-\s*BASE\s*7$/i,
    /^WATERBASE\s+PEARLGLO\s*-\s*WHITE$/i,
  ],
  DULUX_SOLVENT_BASE_PEARLGLO: [
    /^SOLVENT\s+BASE\s+PEARLGLO\s*-\s*BASE\s*7$/i,
    /^SOLVENT\s+BASE\s+PEARLGLO\s+WHITE$/i,
  ],
  DULUX_TRADE_WALLCLAD: [/^TRADE\s+WALLCLAD\b/i],
  DULUX_TRADE_STERISHIELD_DIAMOND_MATT: [
    /^TRADE\s+STERISHIELD\s+DIAMOND\s+MATT\b/i,
  ],
  PLASCON_PEM_900: [/\bPEM\s*900\b/i],
  PLASCON_TSA_1010: [/\bTSA\s*1010\b/i],
  PLASCON_TCA_1000: [/\bTCA\s*1000\b/i],
  PROMINENT_SELECT_SHEEN: [/^SELECT\s+SHEEN$/i],
  PROMINENT_SATIN_SILK: [/^SATIN\s+SILK$/i],
  PROMINENT_MATT: [/^MATT$/i],
  PROMINENT_NEUKLAD: [/^NEUKLAD$/i],
  PROMINENT_ULTRASHEEN: [/^ULTRASHEEN$/i],
};

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isCodeOnlyIdentity(value: string) {
  const text = clean(String(value ?? "")).toUpperCase();
  if (!text) return true;

  // Bare code token without descriptive words
  return /^(?:[A-Z]{1,6}\d{2,}[A-Z0-9]*|\d{6,}[A-Z0-9]*)$/.test(text);
}

function isInvalidProductRecord(product: ProductLike) {
  const name = clean(String(product.name ?? ""));
  const description = clean(String(product.description ?? ""));
  const sku = clean(String(product.sku ?? ""));

  if (name.length < 5) return true;
  if (
    /buildsmart\s+import/i.test(name) ||
    /buildsmart\s+import/i.test(description)
  )
    return true;

  const hasDescriptiveText =
    /[A-Z]/i.test(description) && description.length >= 8;
  const codeOnlyName = isCodeOnlyIdentity(name);
  if (codeOnlyName && !hasDescriptiveText) return true;

  // Clearly incomplete short labels, e.g. "VLW"
  if (/^[A-Z]{1,4}$/.test(name)) return true;

  if (sku && isCodeOnlyIdentity(name) && !hasDescriptiveText) return true;

  return false;
}

function stripVariantNoise(value: string) {
  let output = ` ${value} `;
  for (const pattern of VARIANT_NOISE_PATTERNS)
    output = output.replace(pattern, " ");
  return clean(output);
}

function tokens(value: string) {
  return clean(value)
    .split(" ")
    .filter(Boolean)
    .filter((token) => !BRAND_TOKENS.has(token));
}

function compact(value: string) {
  return value.replace(/[^A-Z0-9]/g, "");
}

function extractTrustedCode(rawName: string): string | null {
  const source = clean(rawName).toUpperCase();
  if (!source) return null;

  // Prefer explicit long product-like code near the front of the line.
  const front = source.slice(0, 40);
  const explicit = front.match(/\b[A-Z]*\d[A-Z0-9\-/]{5,}\b/);
  if (explicit) return explicit[0];

  // Fallback: pure numeric catalog code (8+ digits) often used in BuildSmart lines.
  const numeric = source.match(/\b\d{8,}\b/);
  if (numeric) return numeric[0];

  return null;
}

function stripPackagingNoise(raw: string) {
  return clean(
    String(raw ?? "")
      .toUpperCase()
      .replace(/(\d(?:ML|L|KG|G|MM|CM|M))(PACKS?|ROLLS?|BOXES?)\b/g, "$1 $2")
      .replace(/\bPACKS?\s*\d+\b/g, " ")
      .replace(/\bROLLS?\s*\d+\b/g, " ")
      .replace(/\bBOXES?\s*\d+\b/g, " "),
  );
}

function normalizeFamilySynonyms(raw: string) {
  return clean(
    String(raw ?? "")
      .toUpperCase()
      .replace(/\bTRADE65\b/g, "TRADE 65")
      .replace(/\bTRADE100\b/g, "TRADE 100")
      .replace(/\bLUXURIOUS\s+SILK\b/g, "LUX SILK")
      .replace(/\bQUITE\s+HIDEAWAY\b/g, "QUIET HIDEAWAY")
      .replace(/\bROOFGUARD\s+BASIC\s+BLACK\b/g, "ROOFGUARD BLACK")
      .replace(/\bVELVAGLO\s+WB\b/g, "VELVAGLO NON DRIP WATERBASED ENAMEL")
      .replace(
        /\bVELVAGLO\b[\s\-/]*\bNON[\s\-/]*DRIP\b[\s\-/]*\bWATERBASED\b(?:[\s\-/]*BLACK)?/g,
        "VELVAGLO NON DRIP WATERBASED ENAMEL",
      )
      .replace(
        /\bVELVAGLO\s+NON\s+DRIP\s+WATERBASED\s+BLACK\b/g,
        "VELVAGLO NON DRIP WATERBASED ENAMEL",
      )
      .replace(/\bVLW\b/g, "VELVAGLO NON DRIP WATERBASED ENAMEL")
      .replace(
        /\bPROF\.?\s*EGGSHELL\s+ENAMEL\b/g,
        "EGGSHELL ENAMEL PROFESSIONAL",
      )
      .replace(
        /\bEGGSHELL\s+ENAMEL\s+\(PROFESSIONAL\)\b/g,
        "EGGSHELL ENAMEL PROFESSIONAL",
      )
      .replace(/\bTEG\d+[A-Z0-9]*\b/g, "EGGSHELL ENAMEL PROFESSIONAL")
      .replace(/\bPOLVIN\s+SUPER\s+ACRYLIC\b/g, "POLVIN SUPER ACRYLIC")
      .replace(
        /\bPOLVIN\s+T\/?B\s+(PASTEL|DEEP|TRANS(?:PARENT)?)\b/g,
        "POLVIN SUPER ACRYLIC",
      )
      .replace(/\bTAP\d+[A-Z0-9]*\b/g, "POLVIN SUPER ACRYLIC")
      .replace(/\bBASIC\s+BLACK\b/g, "BLACK"),
  );
}

function normalizeForRepair(raw: string) {
  return clean(
    normalizeImportedProductName(
      normalizeFamilySynonyms(stripPackagingNoise(raw)),
    ),
  );
}

function extractLeadingSku(raw: string): string | null {
  const s = String(raw ?? "")
    .toUpperCase()
    .trim();
  if (!s) return null;

  const patterns = [
    /^\d{10}\b/, // 1010022251
    /^[A-Z]{2,5}\s?\d{3,}[A-Z0-9-]*\b/, // TP 0000545L, VLW 000002
    /^[A-Z]{3}\d{6,}[A-Z0-9-]*\b/, // TAP0010105L, TEG00100020L
  ];

  for (const rx of patterns) {
    const m = s.match(rx);
    if (m) return m[0].replace(/\s+/g, "");
  }

  return null;
}

function extractSkuAnywhere(raw: string): string | null {
  const s = String(raw ?? "")
    .toUpperCase()
    .trim();
  if (!s) return null;

  const patterns = [
    /\b\d{10}\b/, // 1010022251
    /\b[A-Z]{2,5}\s?\d{3,}[A-Z0-9-]*\b/, // TP 0000545L, VLW 000002
    /\b[A-Z]{3}\d{6,}[A-Z0-9-]*\b/, // TAP0010105L, TEG00100020L
  ];

  for (const rx of patterns) {
    const m = s.match(rx);
    if (m) return m[0].replace(/\s+/g, "");
  }

  return null;
}

function extractSizeSignature(raw: string) {
  const source = normalizeFamilySynonyms(stripPackagingNoise(raw));
  const matches = [
    ...source.matchAll(/\b\d+(?:\.\d+)?\s*(ML|L|KG|G|MM|CM|M)\b/g),
  ];
  return [...new Set(matches.map((m) => clean(m[0])))]
    .sort((a, b) => a.localeCompare(b))
    .join("|");
}

function extractDiameterMm(raw: string): string | null {
  const source = normalizeFamilySynonyms(stripPackagingNoise(raw));
  const match = source.match(/\b(\d+(?:\.\d+)?)\s*MM\b/);
  return match ? `${match[1]}MM` : null;
}

function detectRepairFamilyKey(raw: string): string | null {
  const s = normalizeFamilySynonyms(stripPackagingNoise(raw));
  if (/\bVELVAGLO\b/.test(s)) return "PLASCON_VELVAGLO";
  if (/\bROOFGUARD\b/.test(s)) return "DULUX_ROOFGUARD";
  if (/\bDURA\s*100\b|\bDURA100\b/.test(s)) return "DULUX_DURA100";
  if (/\bTRADE\s*65\b/.test(s)) return "DULUX_TRADE65";
  if (/\bLUX\s+SILK\b/.test(s)) return "DULUX_LUX_SILK";
  if (/\bPOLYCELL\b.*\bPOLYFILLA\b|\bPOLYFILLA\b/.test(s))
    return "POLYCELL_POLYFILLA";
  if (/\b(TAP\d{4,}|TEG\d{4,}|GW\d{4,}|VLW\s*\d{3,}|TP\s*\d{4,})\b/.test(s))
    return "PLASCON_CODED_TINT_PRODUCTS";
  return null;
}

function stripShadeNoise(raw: string) {
  return clean(
    normalizeFamilySynonyms(stripPackagingNoise(raw))
      .replace(/\bRAL\s*\d{3,4}\b/g, " ")
      .replace(/\b\d{2}[A-Z]{1,3}\d{2}\/\d{2,3}\b/g, " ")
      .replace(/\b[A-Z]{1,3}-[A-Z]\d-\d{2}\b/g, " ")
      .replace(/\bSPECIAL\s+REF\s+\d+\b/g, " "),
  );
}

function isUnsafeCrossMatch(sourceRaw: string, candidateRaw: string) {
  const source = normalizeFamilySynonyms(stripPackagingNoise(sourceRaw));
  const candidate = normalizeFamilySynonyms(stripPackagingNoise(candidateRaw));

  const hasInteriorSource = /\bINTERIOR\b/.test(source);
  const hasInteriorCandidate = /\bINTERIOR\b/.test(candidate);
  if (hasInteriorSource !== hasInteriorCandidate) return true;

  const hasExteriorSource = /\bEXTERIOR\b/.test(source);
  const hasExteriorCandidate = /\bEXTERIOR\b/.test(candidate);
  if (hasExteriorSource !== hasExteriorCandidate) return true;

  const sourceSize = extractSizeSignature(source);
  const candidateSize = extractSizeSignature(candidate);
  if (sourceSize && sourceSize !== candidateSize) return true;

  const sourceDiameter = extractDiameterMm(source);
  const candidateDiameter = extractDiameterMm(candidate);
  if (sourceDiameter && sourceDiameter !== candidateDiameter) return true;

  if (/\bROADMARKING\s+PAINT\b/.test(source)) {
    const sourceColour =
      source.match(/\b(BLACK|WHITE|YELLOW|RED|GREEN|BLUE|GREY|GRAY)\b/)?.[1] ??
      null;
    const candidateColour =
      candidate.match(
        /\b(BLACK|WHITE|YELLOW|RED|GREEN|BLUE|GREY|GRAY)\b/,
      )?.[1] ?? null;
    if (sourceColour && candidateColour && sourceColour !== candidateColour)
      return true;
  }

  return false;
}

function pickByCodeIdentity(
  code: string,
  sourceRaw: string,
  supplierName: string | null | undefined,
  existingProducts: MatchableProcurementProduct[],
) {
  const normalizedCode = code.replace(/[^A-Z0-9]/g, "");
  if (!normalizedCode) return null;

  const supplierHint = clean(String(supplierName ?? "")).toUpperCase();
  const sourceNorm = normalizeForRepair(sourceRaw);
  const sourceStripped = stripVariantNoise(stripShadeNoise(sourceNorm));

  const candidates = existingProducts
    .filter((product) => !isInvalidProductRecord(product))
    .filter((product) => {
      const skuCode = String(product.sku ?? "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
      const nameCode = normalizeFamilySynonyms(
        stripPackagingNoise(product.name),
      ).replace(/[^A-Z0-9]/g, "");
      return (
        skuCode === normalizedCode ||
        nameCode.startsWith(normalizedCode) ||
        normalizedCode.startsWith(nameCode)
      );
    })
    .filter((product) => !isUnsafeCrossMatch(sourceRaw, product.name))
    .map((product) => {
      const productNorm = normalizeForRepair(
        product.normalizedName ?? product.name,
      );
      const productStripped = stripVariantNoise(stripShadeNoise(productNorm));
      let score = 0;
      if (productStripped === sourceStripped) score += 80;
      if (productNorm === sourceNorm) score += 60;
      if (
        supplierHint &&
        product.supplier?.name?.toUpperCase().includes(supplierHint)
      )
        score += 8;
      if (/buildsmart import/i.test(String(product.description ?? "")))
        score -= 40;
      return { product, score };
    })
    .sort(
      (a, b) =>
        b.score - a.score || a.product.name.localeCompare(b.product.name),
    );

  if (candidates.length === 0) return null;

  const best = candidates[0];
  const second = candidates[1];
  if (second && best.score - second.score < 10) return null;

  return {
    matched: true,
    product: best.product,
    productId: best.product.id,
    mode: "SHOP_ITEM",
    confidence: 0.99,
    reason: `Matched by trusted leading code ${normalizedCode}`,
  } satisfies ProductMatch;
}

function pickExpandedShopItemMatch(input: {
  rawName: string;
  supplierName?: string | null;
  existingProducts: MatchableProcurementProduct[];
}) {
  const sourceNorm = normalizeForRepair(input.rawName);
  const sourceStripped = stripVariantNoise(stripShadeNoise(sourceNorm));
  const sourceCompact = compact(sourceStripped);
  const sourceFamily = detectRepairFamilyKey(input.rawName);
  const supplierHint = clean(String(input.supplierName ?? "")).toUpperCase();

  const candidates = input.existingProducts
    .filter((product) => !isInvalidProductRecord(product))
    .filter((product) => !isUnsafeCrossMatch(input.rawName, product.name))
    .map((product) => {
      const productNorm = normalizeForRepair(
        product.normalizedName ?? product.name,
      );
      const productStripped = stripVariantNoise(stripShadeNoise(productNorm));
      const productCompact = compact(productStripped);
      const productFamily = detectRepairFamilyKey(product.name);

      let score = 0;
      if (productNorm === sourceNorm) score += 120;
      if (productStripped === sourceStripped) score += 95;
      if (productCompact === sourceCompact) score += 85;
      if (sourceStripped && productStripped.startsWith(sourceStripped))
        score += 35;
      if (sourceStripped && sourceStripped.startsWith(productStripped))
        score += 30;
      if (sourceFamily && productFamily && sourceFamily === productFamily)
        score += 35;
      if (
        supplierHint &&
        product.supplier?.name?.toUpperCase().includes(supplierHint)
      ) {
        score += 8;
      }
      if (/buildsmart import/i.test(String(product.description ?? "")))
        score -= 40;

      return { product, score };
    })
    .filter((row) => row.score >= 90)
    .sort(
      (a, b) =>
        b.score - a.score || a.product.name.localeCompare(b.product.name),
    );

  if (candidates.length === 0) return null;
  const best = candidates[0];
  const second = candidates[1];
  if (second && best.score - second.score < 12) return null;

  return {
    matched: true,
    product: best.product,
    productId: best.product.id,
    mode: "SHOP_ITEM",
    confidence: 0.9,
    reason: "Matched with expanded shop-item normalization",
  } satisfies ProductMatch;
}

function pickSafeCanonicalTarget(
  familyKey: string,
  canonicalName: string,
  existingProducts: MatchableProcurementProduct[],
) {
  const canonicalNorm = normalizeImportedProductName(canonicalName);
  const canonicalStripped = stripVariantNoise(canonicalNorm);
  const canonicalTokens = tokens(canonicalStripped);

  const candidates = existingProducts
    .filter((product) => !isInvalidProductRecord(product))
    .map((product) => {
      const family = getCanonicalFamily(
        product.name,
        product.supplier?.name ?? null,
      );
      if (!family || family.key !== familyKey) return null;

      const normalized = normalizeImportedProductName(
        product.normalizedName ?? product.name,
      );
      const stripped = stripVariantNoise(normalized);
      const strippedTokens = tokens(stripped);
      const hasVariantNoise = normalized !== stripped;

      const productDescription = String((product as any).description ?? "");

      let score = 0;
      if (normalized === canonicalNorm) score += 100;
      if (stripped === canonicalStripped) score += 80;
      if (
        strippedTokens.join(" ") === canonicalTokens.join(" ") &&
        strippedTokens.length > 0
      ) {
        score += 60;
      }
      if (!hasVariantNoise) score += 15;
      if (/buildsmart import/i.test(productDescription)) score -= 40;
      score -= Math.max(0, strippedTokens.length - canonicalTokens.length) * 5;

      return {
        product,
        score,
      };
    })
    .filter(
      (row): row is { product: MatchableProcurementProduct; score: number } =>
        !!row,
    )
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (
        a.product.name.localeCompare(b.product.name) ||
        a.product.id.localeCompare(b.product.id)
      );
    });

  const overrideProductId = STRICT_CANONICAL_PRODUCT_OVERRIDES[familyKey];
  if (overrideProductId) {
    const override = candidates.find(
      (row) => row.product.id === overrideProductId,
    );
    if (override) {
      return {
        matched: true as const,
        product: override.product,
        reason: `Strict canonical override selected (${familyKey})`,
      };
    }
  }

  const familyHints = STRICT_CANONICAL_TARGET_HINTS[familyKey] ?? [];
  if (familyHints.length > 0) {
    const preferred = candidates.filter((row) => {
      const description = String((row.product as any).description ?? "");
      if (/buildsmart import/i.test(description)) return false;
      return familyHints.some((hint) => hint.test(row.product.name));
    });

    if (preferred.length === 1) {
      return {
        matched: true as const,
        product: preferred[0].product,
        reason: "Preferred canonical family target selected",
      };
    }
  }

  const exactCanonical = candidates.filter((row) => {
    const normalized = normalizeImportedProductName(
      row.product.normalizedName ?? row.product.name,
    );
    const noVariant = stripVariantNoise(normalized) === normalized;
    return (
      normalized === canonicalNorm &&
      noVariant &&
      !/buildsmart import/i.test(String((row.product as any).description ?? ""))
    );
  });

  if (exactCanonical.length === 1) {
    return {
      matched: true as const,
      product: exactCanonical[0].product,
      reason: "Exact canonical product selected",
    };
  }

  const compactCanonical = compact(canonicalNorm);
  const compactCanonicalMatches = candidates.filter((row) => {
    const normalized = normalizeImportedProductName(
      row.product.normalizedName ?? row.product.name,
    );
    const noVariant = stripVariantNoise(normalized) === normalized;
    return compact(normalized) === compactCanonical && noVariant;
  });

  if (compactCanonicalMatches.length === 1) {
    return {
      matched: true as const,
      product: compactCanonicalMatches[0].product,
      reason: "Compact canonical product selected",
    };
  }

  if (candidates.length === 0) {
    return {
      matched: false as const,
      reason: "No existing canonical-family product candidates",
    };
  }

  const best = candidates[0];
  const second = candidates[1];

  if (best.score < 70) {
    return {
      matched: false as const,
      reason: `Canonical candidates too weak (best score ${best.score})`,
    };
  }

  if (second && best.score - second.score < 10) {
    return {
      matched: false as const,
      reason: "Canonical candidates ambiguous",
    };
  }

  return {
    matched: true as const,
    product: best.product,
    reason: "Safe canonical family target selected",
  };
}

function shouldRepairOrderItem(input: {
  currentPrice: number;
  productDescription: string | null;
  match: ProductMatch;
  currentProductId: string;
}) {
  const hasZeroPrice = input.currentPrice <= 0;
  const buildSmartAutoCreated = (input.productDescription ?? "")
    .toLowerCase()
    .includes("buildsmart import");
  const hasBetterMatch =
    input.match.matched &&
    !!input.match.productId &&
    input.match.productId !== input.currentProductId;

  const canonicalMismatch =
    input.match.mode === "CANONICAL_FAMILY" &&
    input.match.matched &&
    input.match.productId !== input.currentProductId;

  return (
    hasZeroPrice || buildSmartAutoCreated || hasBetterMatch || canonicalMismatch
  );
}

function findBestExistingProductMatch(input: {
  rawName: string;
  supplierName?: string | null;
  trustedCode?: string | null;
  currentPrice?: number;
  existingProducts: MatchableProcurementProduct[];
}) {
  const allowAggressiveMatching = toNumber(input.currentPrice) <= 0;
  const normalizedRaw = allowAggressiveMatching
    ? normalizeFamilySynonyms(stripPackagingNoise(input.rawName))
    : input.rawName;
  const validProducts = input.existingProducts.filter(
    (product) => !isInvalidProductRecord(product),
  );
  const trustedCode = clean(
    String(
      extractLeadingSku(normalizedRaw) ??
        extractSkuAnywhere(normalizedRaw) ??
        input.trustedCode ??
        extractTrustedCode(normalizedRaw) ??
        "",
    ),
  ).toUpperCase();

  if (trustedCode) {
    const compactCode = trustedCode.replace(/[^A-Z0-9]/g, "");
    const codeOverride = STRICT_SHOP_ITEM_CODE_OVERRIDES.find((override) =>
      compactCode.startsWith(
        override.codePrefix.toUpperCase().replace(/[^A-Z0-9]/g, ""),
      ),
    );

    if (codeOverride) {
      const target = validProducts.find(
        (product) => product.id === codeOverride.productId,
      );

      if (target) {
        return {
          matched: true,
          product: target,
          productId: target.id,
          mode: "SHOP_ITEM",
          confidence: 0.99,
          reason: `${codeOverride.reason} (${codeOverride.codePrefix})`,
        } satisfies ProductMatch;
      }
    }

    if (allowAggressiveMatching) {
      const codeMatched = pickByCodeIdentity(
        trustedCode,
        normalizedRaw,
        input.supplierName,
        validProducts,
      );
      if (codeMatched) return codeMatched;
    }
  }

  const mappedCanonicalName = allowAggressiveMatching
    ? (mapDescriptionToProduct(normalizedRaw) ??
      mapDescriptionToProduct(input.rawName) ??
      null)
    : (mapDescriptionToProduct(input.rawName) ?? null);
  const initial = matchBuildSmartProduct(
    {
      rawDescription: allowAggressiveMatching ? normalizedRaw : input.rawName,
      supplierName: input.supplierName ?? null,
      mappedCanonicalName,
      trustedCode: trustedCode || null,
    },
    validProducts,
  );

  if (initial.mode !== "CANONICAL_FAMILY") return initial;

  const family =
    (mappedCanonicalName
      ? getCanonicalFamily(mappedCanonicalName, input.supplierName)
      : null) ??
    getCanonicalFamily(
      allowAggressiveMatching ? normalizedRaw : input.rawName,
      input.supplierName,
    ) ??
    getCanonicalFamily(input.rawName, input.supplierName);

  if (!family) {
    if (!allowAggressiveMatching) return initial;

    const expanded = pickExpandedShopItemMatch({
      rawName: normalizedRaw,
      supplierName: input.supplierName,
      existingProducts: validProducts,
    });
    return expanded ?? initial;
  }

  if (!STRICT_CANONICAL_REPAIR_KEYS.has(family.key)) {
    if (!allowAggressiveMatching) {
      return {
        matched: false,
        mode: "SHOP_ITEM",
        confidence: 0.35,
        reason: `Canonical family ${family.key} is not enabled for strict auto-repair`,
      } satisfies ProductMatch;
    }

    const expanded = pickExpandedShopItemMatch({
      rawName: normalizedRaw,
      supplierName: input.supplierName,
      existingProducts: validProducts,
    });
    if (expanded) return expanded;

    const customFamily = detectRepairFamilyKey(normalizedRaw);
    if (customFamily && STRICT_CANONICAL_REPAIR_KEYS.has(customFamily)) {
      return {
        matched: false,
        mode: "CANONICAL_FAMILY",
        confidence: 0.45,
        reason: `Canonical family ${customFamily} detected but no safe target was found`,
      } satisfies ProductMatch;
    }

    return {
      matched: false,
      mode: "SHOP_ITEM",
      confidence: 0.35,
      reason: `Canonical family ${family.key} is not enabled for strict auto-repair`,
    } satisfies ProductMatch;
  }

  const safe = pickSafeCanonicalTarget(
    family.key,
    family.canonicalName,
    validProducts,
  );

  if (!safe.matched) {
    return {
      matched: false,
      mode: "CANONICAL_FAMILY",
      confidence: 0.45,
      canonicalName: family.canonicalName,
      reason: safe.reason,
    } satisfies ProductMatch;
  }

  return {
    matched: true,
    product: safe.product,
    productId: safe.product.id,
    canonicalName: family.canonicalName,
    mode: "CANONICAL_FAMILY",
    confidence: 0.97,
    reason: safe.reason,
  } satisfies ProductMatch;
}

async function resolveRepairPrice(input: {
  supplierId: string | null;
  productId: string;
  currentPrice: number;
  uomAtOrder: string | null;
  unitSizeAtOrder: string | null;
}) {
  if (input.currentPrice > 0) {
    return {
      nextPrice: input.currentPrice,
      changed: false,
      reason: "Historical snapshot price is already non-zero",
    } as const;
  }

  const resolvedBySize = await resolveUnitPrice({
    supplierId: input.supplierId,
    productId: input.productId,
    uom: input.uomAtOrder ?? undefined,
    unitSize:
      input.unitSizeAtOrder != null ? Number(input.unitSizeAtOrder) : undefined,
  });

  let nextPrice = toNumber(resolvedBySize);
  if (nextPrice > 0) {
    return {
      nextPrice,
      changed: true,
      reason: "Filled zero price from supplier/global pricing",
    } as const;
  }

  // Retry without size restrictions in case the snapshot size was noisy/missing.
  const resolvedWithoutSize = await resolveUnitPrice({
    supplierId: input.supplierId,
    productId: input.productId,
  });
  nextPrice = toNumber(resolvedWithoutSize);

  if (nextPrice <= 0) {
    return {
      nextPrice: 0,
      changed: false,
      reason: "No supplier/global price found for repair",
    } as const;
  }

  return {
    nextPrice,
    changed: true,
    reason: "Filled zero price from supplier/global pricing",
  } as const;
}

async function maybeDeactivateUnusedDuplicateProducts(
  candidates: InactiveCandidate[],
  mode: RepairMode,
) {
  const unique = [...new Map(candidates.map((c) => [c.productId, c])).values()];
  const deactivated: InactiveCandidate[] = [];
  const stillUsed: InactiveCandidate[] = [];

  for (const candidate of unique) {
    const usageCount = await prisma.siteProductOrderItem.count({
      where: { productId: candidate.productId },
    });

    if (usageCount > 0) {
      stillUsed.push(candidate);
      continue;
    }

    if (mode === "APPLY") {
      await prisma.procurementProduct.update({
        where: { id: candidate.productId },
        data: { isActive: false },
      });
    }

    deactivated.push(candidate);
  }

  return { deactivated, stillUsed, scanned: unique.length };
}

async function main() {
  const mode: RepairMode = process.argv.includes("--apply")
    ? "APPLY"
    : "DRY_RUN";
  const deactivateUnused = !process.argv.includes(
    "--skip-deactivate-unused-duplicates",
  );
  const reportPath = path.resolve(
    process.cwd(),
    "scripts",
    "buildsmart-order-repair-report.json",
  );

  const existingProducts = await prisma.procurementProduct.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      normalizedName: true,
      sku: true,
      supplierId: true,
      description: true,
      supplier: { select: { id: true, name: true } },
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });

  const invalidActiveCandidates: InactiveCandidate[] = existingProducts
    .filter((product) => isInvalidProductRecord(product))
    .map((product) => ({
      productId: product.id,
      name: product.name,
      description: product.description ?? null,
    }));

  const buildSmartOrders = await prisma.siteProductOrder.findMany({
    where: {
      OR: [
        {
          note: {
            contains: "Imported from BuildSmart PO",
            mode: "insensitive",
          },
        },
        { note: { contains: "BuildSmart", mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      reference: true,
      supplierId: true,
      supplier: { select: { id: true, name: true } },
      items: {
        select: {
          id: true,
          productId: true,
          quantity: true,
          unitPriceAtOrder: true,
          uomAtOrder: true,
          unitSizeAtOrder: true,
          note: true,
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              supplierId: true,
              normalizedName: true,
              description: true,
              supplier: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  const changes: RepairChange[] = [];
  const manualReview: ManualReviewRow[] = [];
  const touchedOrderIds = new Set<string>();
  const duplicateCleanupCandidates: InactiveCandidate[] = [
    ...invalidActiveCandidates,
  ];

  let scannedItems = 0;
  let candidateItems = 0;

  for (const order of buildSmartOrders) {
    for (const item of order.items) {
      scannedItems += 1;
      const rawName = (item.note?.trim() || item.product.name || "").trim();
      if (!rawName) continue;

      const currentPrice = toNumber(item.unitPriceAtOrder);
      const productMode = classifyProductMode(
        rawName,
        order.supplier?.name ?? null,
      );

      const match = findBestExistingProductMatch({
        rawName,
        supplierName: order.supplier?.name ?? null,
        trustedCode: extractTrustedCode(rawName) ?? item.product.sku ?? null,
        currentPrice,
        existingProducts,
      });

      if (
        !shouldRepairOrderItem({
          currentPrice,
          productDescription: item.product.description,
          match,
          currentProductId: item.productId,
        })
      ) {
        continue;
      }

      candidateItems += 1;

      const hasSafeMatch = match.matched && !!match.productId;
      const targetProductId = hasSafeMatch ? match.productId! : item.productId;
      const needsRelink = hasSafeMatch && targetProductId !== item.productId;

      const pricePlan = await resolveRepairPrice({
        supplierId: order.supplierId,
        productId: targetProductId,
        currentPrice,
        uomAtOrder: item.uomAtOrder,
        unitSizeAtOrder: item.unitSizeAtOrder
          ? String(item.unitSizeAtOrder)
          : null,
      });
      const needsPriceUpdate = currentPrice <= 0 && pricePlan.changed;

      if (!needsRelink && !needsPriceUpdate) {
        const needsManualReview =
          currentPrice <= 0 &&
          (!hasSafeMatch ||
            (!shouldCreateNewProduct(match) &&
              match.mode === "CANONICAL_FAMILY"));

        if (needsManualReview) {
          manualReview.push({
            orderId: order.id,
            orderReference: order.reference,
            itemId: item.id,
            rawName,
            currentProductId: item.productId,
            currentProductName: item.product.name,
            currentPrice: toPriceString(item.unitPriceAtOrder),
            mode: productMode,
            reason: `No safe relink; ${match.reason}; ${pricePlan.reason}`,
          });
        }
        continue;
      }

      const nextProduct = hasSafeMatch
        ? existingProducts.find((p) => p.id === targetProductId)
        : null;

      if (mode === "APPLY") {
        await prisma.siteProductOrderItem.update({
          where: { id: item.id },
          data: {
            ...(needsRelink ? { productId: targetProductId } : {}),
            ...(needsPriceUpdate
              ? { unitPriceAtOrder: pricePlan.nextPrice.toFixed(2) }
              : {}),
          },
        });
      }

      touchedOrderIds.add(order.id);

      if (
        needsRelink &&
        (item.product.description ?? "")
          .toLowerCase()
          .includes("buildsmart import")
      ) {
        duplicateCleanupCandidates.push({
          productId: item.product.id,
          name: item.product.name,
          description: item.product.description,
        });
      }

      changes.push({
        orderId: order.id,
        orderReference: order.reference,
        orderSupplier: order.supplier?.name ?? null,
        itemId: item.id,
        rawName,
        mode: productMode,
        reason: `${match.reason}; ${pricePlan.reason}`,
        oldProductId: item.product.id,
        oldProductName: item.product.name,
        newProductId: needsRelink ? targetProductId : item.product.id,
        newProductName: needsRelink
          ? (nextProduct?.name ?? item.product.name)
          : item.product.name,
        oldPrice: toPriceString(item.unitPriceAtOrder),
        newPrice: needsPriceUpdate
          ? pricePlan.nextPrice.toFixed(2)
          : toPriceString(item.unitPriceAtOrder),
      });
    }
  }

  for (const orderId of touchedOrderIds) {
    if (mode === "APPLY") {
      await recalcOrderTotal(orderId);
    }
  }

  const duplicateCleanup = deactivateUnused
    ? await maybeDeactivateUnusedDuplicateProducts(
        duplicateCleanupCandidates,
        mode,
      )
    : {
        deactivated: [] as InactiveCandidate[],
        stillUsed: [] as InactiveCandidate[],
        scanned: 0,
      };

  const report = {
    generatedAt: new Date().toISOString(),
    mode,
    options: {
      deactivateUnusedDuplicates: deactivateUnused,
    },
    summary: {
      ordersScanned: buildSmartOrders.length,
      itemsScanned: scannedItems,
      candidateItems,
      changedItems: changes.length,
      touchedOrders: touchedOrderIds.size,
      manualReviewCount: manualReview.length,
      duplicateCleanupScanned: duplicateCleanup.scanned,
      duplicateProductsDeactivated: duplicateCleanup.deactivated.length,
      duplicateProductsStillUsed: duplicateCleanup.stillUsed.length,
    },
    changes,
    manualReview,
    duplicateCleanup,
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`Mode: ${mode}`);
  console.log(`Orders scanned: ${buildSmartOrders.length}`);
  console.log(`Items scanned: ${scannedItems}`);
  console.log(`Candidate items: ${candidateItems}`);
  console.log(`Changed items: ${changes.length}`);
  console.log(`Touched orders: ${touchedOrderIds.size}`);
  console.log(`Manual review rows: ${manualReview.length}`);
  if (deactivateUnused) {
    console.log(`Duplicate cleanup scanned: ${duplicateCleanup.scanned}`);
    console.log(
      `Duplicate products deactivated: ${duplicateCleanup.deactivated.length}`,
    );
    console.log(
      `Duplicate products still used: ${duplicateCleanup.stillUsed.length}`,
    );
  }
  console.log(`Report: ${reportPath}`);

  if (changes.length > 0) {
    console.log("\nSample changes:");
    for (const row of changes.slice(0, 20)) {
      console.log(
        `- ${row.itemId} :: ${row.oldProductName} (${row.oldProductId}) -> ${row.newProductName} (${row.newProductId}) :: ${row.oldPrice} -> ${row.newPrice}`,
      );
    }
  }

  if (manualReview.length > 0) {
    console.log("\nSample manual review:");
    for (const row of manualReview.slice(0, 20)) {
      console.log(`- ${row.itemId} :: ${row.rawName} :: ${row.reason}`);
    }
  }
}

main()
  .catch((error) => {
    console.error("BuildSmart repair failed:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
