import {
  canonicalTitleFallback,
  getCanonicalFamily,
  normalizeImportedProductName,
} from "./buildsmartProductMatcher";

export type NormalizeResult = {
  canonicalName: string | null;
  family?: string | null;
  hadVariant?: boolean;
  raw?: string;
};

export function normalizeProductName(
  raw: string,
  supplierName?: string | null,
): NormalizeResult {
  const original = String(raw ?? "");
  const normalized = normalizeImportedProductName(original);
  const family = getCanonicalFamily(original, supplierName);

  if (family) {
    return {
      canonicalName: family.canonicalName,
      family: family.key,
      hadVariant: family.hadVariant,
      raw: original,
    };
  }

  if (/\b424\s*TURPS\b/i.test(normalized)) {
    return { canonicalName: "424 Turps 5L", raw: original };
  }
  if (/PAINT\s*STRIPPER/i.test(normalized)) {
    return { canonicalName: "Paint Stripper", raw: original };
  }
  if (/DISH\s*WASHING\s*LIQUID/i.test(normalized)) {
    return { canonicalName: "Dish Washing Liquid", raw: original };
  }

  return {
    canonicalName: canonicalTitleFallback(original),
    raw: original,
  };
}

export default normalizeProductName;
