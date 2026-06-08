import { normalizeSkuKey } from "@/lib/procurement/buildsmartProductCodes";

export type ProductMode = "CANONICAL_FAMILY" | "SHOP_ITEM";

export type MatchableProcurementProduct = {
  id: string;
  name: string;
  normalizedName?: string | null;
  sku?: string | null;
  description?: string | null;
  supplierId?: string | null;
  supplier?: { id?: string; name?: string | null } | null;
};

export type CanonicalFamilyMatch = {
  key: string;
  canonicalName: string;
  mode: ProductMode;
  normalizedInput: string;
  hadVariant: boolean;
  brandHint?: string | null;
};

export type ProductMatch = {
  matched: boolean;
  product?: MatchableProcurementProduct;
  productId?: string;
  canonicalName?: string;
  mode: ProductMode;
  confidence: number;
  reason: string;
};

type MatchInput = {
  rawDescription: string;
  supplierName?: string | null;
  mappedCanonicalName?: string | null;
  trustedCode?: string | null;
};

type CanonicalFamilyDefinition = {
  key: string;
  canonicalName: string;
  brandHint?: string;
  aliases: string[];
};

const CANONICAL_VARIANT_PATTERNS = [
  /\bWHITE(?:\s+TINT)?\b/g,
  /\bCLEAR\s+BASE(?:\s+TINT)?\b/g,
  /\bCLEAR\b/g,
  /\bPASTEL(?:\s*\d+)?\b/g,
  /\bMEDIUM(?:\s*\d+)?\b/g,
  /\bDEEP(?:\s*\d+)?\b/g,
  /\bU\s+DEEP\b/g,
  /\bEX\s+DEEP\b/g,
  /\bBASE\s*[6789]\b/g,
  /\bSTANDARD\s+COLOU?RS\b/g,
  /\bALL\s+COLOU?RS\b/g,
  /\bTINT\b/g,
  /\bTRANS(?:PARENT)?\b/g,
  /\bPLUS\b/g,
  /\bRAL\s*\d{3,4}\b/g,
  /\b\d{2}[A-Z]{1,3}\d{2}\/\d{2,3}\b/g,
  /\b\d{1,3}-[A-Z]\d-\d{2}\b/g,
  /\bSPECIAL\s+REF\s+\d+\b/g,
];

const CANONICAL_FAMILIES: CanonicalFamilyDefinition[] = [
  {
    key: "DULUX_TRADE_100_LOWSHEEN",
    canonicalName: "Trade 100 Lowsheen",
    brandHint: "dulux",
    aliases: [
      "TRADE 100 LOWSHEEN",
      "100 LOWSHEEN",
      "TRADE100 LOWSHEEN",
      "TRADE 100",
      "TRADE100",
    ],
  },
  {
    key: "DULUX_TRADE_65",
    canonicalName: "Trade 65",
    brandHint: "dulux",
    aliases: ["TRADE 65", "TRADE65", "DULUX TRADE 65", "DULUX TRADE65"],
  },
  {
    key: "DULUX_WOODGUARD_TIMBAVARNISH",
    canonicalName: "WOODGUARD TIMBAVARNISH - INT/EXT",
    brandHint: "dulux",
    aliases: [
      "WOODGUARD TIMBAVARNISH",
      "WOODGARD TIMBAVARNISH",
      "WG TIMBAVARNISH",
      "TIMBAVARNISH INT EXT",
      "TIMBAVARNISH INT/EXT",
    ],
  },
  {
    key: "DULUX_WATERBASED_PEARLGLO",
    canonicalName: "Waterbased Pearlglo",
    brandHint: "dulux",
    aliases: ["WATERBASED PEARLGLO", "W B PEARLGLO", "WB PEARLGLO"],
  },
  {
    key: "DULUX_SOLVENT_BASE_PEARLGLO",
    canonicalName: "Solvent Base Pearlglo",
    brandHint: "dulux",
    aliases: ["SOLVENT BASE PEARLGLO", "S B PEARLGLO", "SB PEARLGLO"],
  },
  {
    key: "DULUX_TRADE_WALLCLAD",
    canonicalName: "Trade Wallclad",
    brandHint: "dulux",
    aliases: ["TRADE WALLCLAD", "WALLCLAD"],
  },
  {
    key: "DULUX_TRADE_STERISHIELD_DIAMOND_MATT",
    canonicalName: "Trade Sterishield Diamond Matt",
    brandHint: "dulux",
    aliases: ["TRADE STERISHIELD DIAMOND MATT", "STERISHIELD DIAMOND MATT"],
  },
  {
    key: "PLASCON_PEM_900",
    canonicalName: "PEM 900",
    brandHint: "plascon",
    aliases: ["PEM 900", "PEM900"],
  },
  {
    key: "PLASCON_TSA_1010",
    canonicalName: "TSA 1010",
    brandHint: "plascon",
    aliases: ["TSA 1010", "TSA1010"],
  },
  {
    key: "PLASCON_TCA_1000",
    canonicalName: "TCA 1000",
    brandHint: "plascon",
    aliases: ["TCA 1000", "TCA1000"],
  },
  {
    key: "PLASCON_VELVAGLO",
    canonicalName: "Plascon Velvaglo",
    brandHint: "plascon",
    aliases: ["PLASCON VELVAGLO", "VELVAGLO"],
  },
  {
    key: "PLASCON_CASHMERE",
    canonicalName: "Plascon Cashmere",
    brandHint: "plascon",
    aliases: ["PLASCON CASHMERE", "CASHMERE"],
  },
  {
    key: "PLASCON_WALL_AND_ALL",
    canonicalName: "Plascon Wall&All",
    brandHint: "plascon",
    aliases: [
      "PLASCON WALL AND ALL",
      "PLASCON WALL ALL",
      "WALL AND ALL",
      "WALL ALL",
    ],
  },
  {
    key: "PLASCON_NUROOF",
    canonicalName: "Plascon Nuroof Cool",
    brandHint: "plascon",
    aliases: ["PLASCON NUROOF COOL", "NUROOF COOL", "NUROOF"],
  },
  {
    key: "PROMINENT_SELECT_SHEEN",
    canonicalName: "Select Sheen",
    brandHint: "prominent",
    aliases: ["SELECT SHEEN"],
  },
  {
    key: "PROMINENT_SELECT_MATT",
    canonicalName: "Select Matt",
    brandHint: "prominent",
    aliases: ["SELECT MATT"],
  },
  {
    key: "PROMINENT_SATIN_SILK",
    canonicalName: "Satin Silk",
    brandHint: "prominent",
    aliases: ["SATIN SILK"],
  },
  {
    key: "PROMINENT_MATT",
    canonicalName: "Matt",
    brandHint: "prominent",
    aliases: ["MATT"],
  },
  {
    key: "PROMINENT_NEUKLAD",
    canonicalName: "Neuklad",
    brandHint: "prominent",
    aliases: ["NEUKLAD"],
  },
  {
    key: "PROMINENT_ULTRASHEEN",
    canonicalName: "Ultrasheen",
    brandHint: "prominent",
    aliases: ["ULTRASHEEN"],
  },
  {
    key: "PROMINENT_GLOSS_ENAMEL",
    canonicalName: "Gloss Enamel",
    brandHint: "prominent",
    aliases: ["GLOSS ENAMEL"],
  },
  {
    key: "PROMINENT_NON_DRIP_ENAMEL",
    canonicalName: "Non-Drip Enamel",
    brandHint: "prominent",
    aliases: ["NON DRIP ENAMEL", "NON DRIP", "NONDRIP ENAMEL"],
  },
  {
    key: "PROMINENT_TEXTURE",
    canonicalName: "Texture",
    brandHint: "prominent",
    aliases: ["TEXTURE", "TEXTURED"],
  },
];

const SHOP_ITEM_STOP_WORDS = new Set(["THE", "AND", "FOR", "WITH", "OF", "TO"]);

function cleanWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeSupplierHint(value?: string | null) {
  return cleanWhitespace(String(value ?? "").toUpperCase()) || null;
}

function stripLeadingCodes(text: string) {
  return text
    .replace(/^[A-Z]{1,4}\s*\d{4,}[A-Z0-9\-\/]*\s+/g, "")
    .replace(/^\d{5,}[A-Z0-9\-\/]*\s+/g, "")
    .trim();
}

function replaceCommonAbbreviations(text: string) {
  return text
    .replace(/\b(PEM|TSA|TCA)(\d{3,4})\b/g, "$1 $2")
    .replace(/\bTRADE100\b/g, "TRADE 100")
    .replace(/\bW\s*\/\s*B\b/g, "WATERBASED")
    .replace(/\bW\s+B\b/g, "WATERBASED")
    .replace(/\bWB\b/g, "WATERBASED")
    .replace(/\bS\s*\/\s*B\b/g, "SOLVENT BASE")
    .replace(/\bS\s+B\b/g, "SOLVENT BASE")
    .replace(/\bSB\b/g, "SOLVENT BASE")
    .replace(/\bWATERBASE\b/g, "WATERBASED")
    .replace(/\bU\.?\s*DEEP\b/g, "BASE 6")
    .replace(/\bEX\s*\/\s*DEEP\b/g, "BASE 9")
    .replace(/\bLT\b/g, "L");
}

function normalizeBase(text: string) {
  return cleanWhitespace(
    replaceCommonAbbreviations(
      stripLeadingCodes(text)
        .toUpperCase()
        .replace(/[+]/g, " ")
        .replace(/[&]/g, " AND ")
        .replace(/[\/_-]+/g, " ")
        .replace(/[^A-Z0-9\s]/g, " "),
    ),
  );
}

function stripPackSizes(text: string) {
  return cleanWhitespace(
    text.replace(/\b\d+(?:\.\d+)?\s*(ML|L|KG|G|MM|CM|M)\b/g, " "),
  );
}

function stripCanonicalNoise(text: string) {
  let output = ` ${text} `;
  for (const pattern of CANONICAL_VARIANT_PATTERNS) {
    output = output.replace(pattern, " ");
  }

  return cleanWhitespace(output);
}

function compact(text: string) {
  return text.replace(/[^A-Z0-9]/g, "");
}

function tokensOf(text: string) {
  return cleanWhitespace(text)
    .split(" ")
    .filter(Boolean)
    .filter((token) => !SHOP_ITEM_STOP_WORDS.has(token));
}

function titleCase(text: string) {
  return text
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function detectVariant(text: string) {
  return CANONICAL_VARIANT_PATTERNS.some((pattern) => pattern.test(text));
}

function brandMatchesHint(
  brandHint?: string | null,
  supplierName?: string | null,
) {
  if (!brandHint) return false;
  const normalizedSupplier = normalizeSupplierHint(supplierName);
  return normalizedSupplier
    ? normalizedSupplier.includes(brandHint.toUpperCase())
    : false;
}

export function normalizeImportedProductName(raw: string): string {
  return normalizeBase(String(raw ?? ""));
}

export function getCanonicalFamily(
  raw: string,
  supplierName?: string | null,
): CanonicalFamilyMatch | null {
  const normalizedInput = normalizeImportedProductName(raw);
  const strippedInput = stripCanonicalNoise(stripPackSizes(normalizedInput));
  const hadVariant = detectVariant(normalizedInput);
  const compactStripped = compact(strippedInput);

  for (const definition of CANONICAL_FAMILIES) {
    for (const alias of definition.aliases) {
      const normalizedAlias = normalizeImportedProductName(alias);
      const compactAlias = compact(normalizedAlias);
      if (
        strippedInput === normalizedAlias ||
        strippedInput.startsWith(`${normalizedAlias} `) ||
        compactStripped === compactAlias
      ) {
        if (
          definition.key === "DULUX_TRADE_100_LOWSHEEN" &&
          (normalizedAlias === "TRADE 100" || normalizedAlias === "TRADE100") &&
          /\b(GLOSS|MATT|ENAMEL|PRIMER|ALKALI|RESISTANT)\b/.test(strippedInput)
        ) {
          continue;
        }

        if (
          definition.key === "PROMINENT_MATT" &&
          strippedInput.startsWith("SELECT MATT")
        ) {
          continue;
        }

        return {
          key: definition.key,
          canonicalName: definition.canonicalName,
          mode: "CANONICAL_FAMILY",
          normalizedInput,
          hadVariant,
          brandHint:
            definition.brandHint ??
            (brandMatchesHint("DULUX", supplierName)
              ? "dulux"
              : brandMatchesHint("PLASCON", supplierName)
                ? "plascon"
                : brandMatchesHint("PROMINENT", supplierName)
                  ? "prominent"
                  : null),
        };
      }
    }
  }

  return null;
}

export function classifyProductMode(
  raw: string,
  supplierName?: string | null,
): ProductMode {
  return getCanonicalFamily(raw, supplierName)
    ? "CANONICAL_FAMILY"
    : "SHOP_ITEM";
}

function productSupplierName(product: MatchableProcurementProduct) {
  return product.supplier?.name ?? null;
}

function scoreCanonicalCandidate(
  family: CanonicalFamilyMatch,
  product: MatchableProcurementProduct,
  supplierName?: string | null,
) {
  const productNormalized = normalizeImportedProductName(
    product.normalizedName ?? product.name,
  );
  const productFamily = getCanonicalFamily(
    product.name,
    productSupplierName(product),
  );

  let score = 0;
  if (productFamily?.key === family.key) score += 100;
  if (productNormalized === normalizeImportedProductName(family.canonicalName))
    score += 30;
  if (
    compact(productNormalized) === compact(family.canonicalName.toUpperCase())
  )
    score += 20;
  if (
    stripCanonicalNoise(stripPackSizes(productNormalized)) ===
    stripCanonicalNoise(
      stripPackSizes(normalizeImportedProductName(family.canonicalName)),
    )
  ) {
    score += 18;
  }
  if (product.name.toUpperCase() === family.canonicalName.toUpperCase())
    score += 10;
  if (
    family.brandHint &&
    brandMatchesHint(family.brandHint, productSupplierName(product))
  )
    score += 8;
  if (family.brandHint && brandMatchesHint(family.brandHint, supplierName))
    score += 4;
  if (/buildsmart import/i.test(String(product.description ?? ""))) score -= 40;
  return score;
}

export function findExistingCanonicalProduct(
  input: MatchInput,
  existingProducts: MatchableProcurementProduct[],
): ProductMatch {
  const family =
    (input.mappedCanonicalName
      ? getCanonicalFamily(input.mappedCanonicalName, input.supplierName)
      : null) ?? getCanonicalFamily(input.rawDescription, input.supplierName);

  if (!family) {
    return {
      matched: false,
      mode: "SHOP_ITEM",
      confidence: 0,
      reason: "Not a known canonical family",
    };
  }

  const scored = existingProducts
    .map((product) => ({
      product,
      score: scoreCanonicalCandidate(family, product, input.supplierName),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return (
        left.product.name.localeCompare(right.product.name) ||
        left.product.id.localeCompare(right.product.id)
      );
    });

  if (scored.length === 0) {
    return {
      matched: false,
      canonicalName: family.canonicalName,
      mode: family.mode,
      confidence: family.hadVariant ? 0.85 : 0.75,
      reason: `Canonical family ${family.canonicalName} detected but no existing product matched`,
    };
  }

  const best = scored[0];
  return {
    matched: true,
    product: best.product,
    productId: best.product.id,
    canonicalName: family.canonicalName,
    mode: family.mode,
    confidence: Math.min(0.99, 0.85 + best.score / 200),
    reason: `Matched canonical family ${family.canonicalName}`,
  };
}

function scoreShopExactCandidate(
  inputName: string,
  product: MatchableProcurementProduct,
  supplierName?: string | null,
) {
  const productNormalized = normalizeImportedProductName(
    product.normalizedName ?? product.name,
  );
  let score = 0;

  if (productNormalized === inputName) score += 100;
  if (compact(productNormalized) === compact(inputName)) score += 95;
  if (
    brandMatchesHint(
      normalizeSupplierHint(supplierName),
      productSupplierName(product),
    )
  ) {
    score += 2;
  }
  return score;
}

function codeTokensOf(text: string) {
  return tokensOf(text).filter((token) => /\d/.test(token));
}

function tokenOverlap(left: string[], right: string[]) {
  const rightSet = new Set(right);
  const intersection = left.filter((token) => rightSet.has(token));
  const union = new Set([...left, ...right]);
  return {
    intersection: intersection.length,
    ratio: union.size === 0 ? 0 : intersection.length / union.size,
  };
}

export function findExistingShopItem(
  input: MatchInput,
  existingProducts: MatchableProcurementProduct[],
): ProductMatch {
  const normalizedInput = normalizeImportedProductName(input.rawDescription);

  const exactCandidates = existingProducts
    .map((product) => ({
      product,
      score: scoreShopExactCandidate(
        normalizedInput,
        product,
        input.supplierName,
      ),
    }))
    .filter((candidate) => candidate.score >= 95)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return (
        left.product.name.localeCompare(right.product.name) ||
        left.product.id.localeCompare(right.product.id)
      );
    });

  if (exactCandidates.length > 0) {
    const best = exactCandidates[0];
    return {
      matched: true,
      product: best.product,
      productId: best.product.id,
      mode: "SHOP_ITEM",
      confidence: 0.98,
      reason: "Matched normalized shop item name",
    };
  }

  const inputTokens = tokensOf(normalizedInput);
  const inputCodeTokens = codeTokensOf(normalizedInput);

  const fuzzyCandidates = existingProducts
    .map((product) => {
      const productNormalized = normalizeImportedProductName(
        product.normalizedName ?? product.name,
      );
      const productTokens = tokensOf(productNormalized);
      const productCodeTokens = codeTokensOf(productNormalized);
      const overlap = tokenOverlap(inputTokens, productTokens);
      const codesAlign = inputCodeTokens.every((token) =>
        productCodeTokens.includes(token),
      );

      return {
        product,
        score:
          codesAlign && overlap.intersection >= 2 && overlap.ratio >= 0.92
            ? overlap.ratio
            : 0,
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score);

  if (fuzzyCandidates.length === 1) {
    return {
      matched: true,
      product: fuzzyCandidates[0].product,
      productId: fuzzyCandidates[0].product.id,
      mode: "SHOP_ITEM",
      confidence: 0.92,
      reason: "Matched strict high-confidence shop item similarity",
    };
  }

  if (fuzzyCandidates.length > 1) {
    const [best, second] = fuzzyCandidates;
    if (best.score - second.score >= 0.08) {
      return {
        matched: true,
        product: best.product,
        productId: best.product.id,
        mode: "SHOP_ITEM",
        confidence: 0.9,
        reason: "Matched best strict shop item candidate",
      };
    }

    return {
      matched: false,
      mode: "SHOP_ITEM",
      confidence: 0.55,
      reason: "Ambiguous shop item candidates require manual review",
    };
  }

  return {
    matched: false,
    mode: "SHOP_ITEM",
    confidence: 0.1,
    reason: "No safe existing shop item match found",
  };
}

export function shouldCreateNewProduct(matchResult: ProductMatch) {
  if (matchResult.matched) return false;
  if (matchResult.mode === "CANONICAL_FAMILY") return false;
  if (matchResult.confidence >= 0.5) return false;
  return true;
}

export function matchBuildSmartProduct(
  input: MatchInput,
  existingProducts: MatchableProcurementProduct[],
): ProductMatch {
  const trustedCode = cleanWhitespace(String(input.trustedCode ?? "")).toUpperCase();
  const trustedCodeKey = normalizeSkuKey(trustedCode);
  if (trustedCode) {
    const codeMatch = existingProducts.find(
      (product) =>
        normalizeSkuKey(product.sku) === trustedCodeKey,
    );
    if (codeMatch) {
      return {
        matched: true,
        product: codeMatch,
        productId: codeMatch.id,
        mode: classifyProductMode(input.rawDescription, input.supplierName),
        confidence: 1,
        reason: `Matched trusted code ${trustedCode}`,
      };
    }
  }

  const canonicalMatch = findExistingCanonicalProduct(input, existingProducts);
  if (canonicalMatch.matched || canonicalMatch.mode === "CANONICAL_FAMILY") {
    return canonicalMatch;
  }

  return findExistingShopItem(input, existingProducts);
}

export function canonicalTitleFallback(raw: string) {
  const normalized = stripPackSizes(normalizeImportedProductName(raw));
  const words = tokensOf(normalized);
  if (words.length === 0 || words.length > 5) return null;
  return titleCase(words.join(" "));
}
