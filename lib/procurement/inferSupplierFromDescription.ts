import { getCanonicalFamily } from "@/lib/procurement/buildsmartProductMatcher";

/** Brand keyword rules when canonical-family matching does not apply. */
const BRAND_KEYWORD_RULES: { pattern: RegExp; brandHint: string }[] = [
  { pattern: /\bDULUX\b/i, brandHint: "dulux" },
  { pattern: /\bDURA\s*100\b/i, brandHint: "dulux" },
  { pattern: /\bTRADE\s*65\b/i, brandHint: "dulux" },
  { pattern: /\bTRADE\s*100\b/i, brandHint: "dulux" },
  { pattern: /\bTRADE100\b/i, brandHint: "dulux" },
  { pattern: /\bLUX(?:URIOUS)?\s+SILK\b/i, brandHint: "dulux" },
  { pattern: /\bROOFGUARD\b/i, brandHint: "dulux" },
  { pattern: /\bACRYLIC\s+PVA\b/i, brandHint: "dulux" },
  { pattern: /\bFLEXOTHANE\b/i, brandHint: "dulux" },
  { pattern: /\bELR\d{3}\b/i, brandHint: "dulux" },
  { pattern: /\bWEATHERSHIELD\b/i, brandHint: "dulux" },
  { pattern: /\bWALLCLAD\b/i, brandHint: "dulux" },
  { pattern: /\bSTERISHIELD\b/i, brandHint: "dulux" },
  { pattern: /\bPEARLGLO\b/i, brandHint: "dulux" },

  { pattern: /\bPLASCON\b/i, brandHint: "plascon" },
  { pattern: /\bHANDYSKIM\b/i, brandHint: "plascon" },
  { pattern: /\bHSWS\d/i, brandHint: "plascon" },
  { pattern: /\bNUROOF\b/i, brandHint: "plascon" },
  { pattern: /\bMICATEX\b/i, brandHint: "plascon" },
  { pattern: /\bVELVAGLO\b/i, brandHint: "plascon" },
  { pattern: /\bCASHMERE\b/i, brandHint: "plascon" },
  { pattern: /\bPEM\s*9/i, brandHint: "plascon" },
  { pattern: /\bTSA\s*10/i, brandHint: "plascon" },
  { pattern: /\bTCA\s*10/i, brandHint: "plascon" },
  { pattern: /\bSKIM\s*COAT/i, brandHint: "plascon" },

  { pattern: /\bPROMINENT\b/i, brandHint: "prominent" },
  { pattern: /\bSELECT\s+(?:MATT|SHEEN)\b/i, brandHint: "prominent" },

  { pattern: /\bTIMBERLIFE\b/i, brandHint: "timberlife" },
  { pattern: /\bSOUDAL\b/i, brandHint: "soudal" },
  { pattern: /\bSMX\s*35\b/i, brandHint: "soudal" },
  { pattern: /\bMARMORAN\b/i, brandHint: "marmoran" },
  { pattern: /\bUROCHEM\b/i, brandHint: "urochem" },
  { pattern: /\bCEMCRETE\b/i, brandHint: "cemcrete" },

  // Consumables / tools (typically DIY Savoy Consumables)
  { pattern: /\bBACKING\s+CORD\b/i, brandHint: "diy_consumables" },
  { pattern: /\bMASKING\s+TAPE\b/i, brandHint: "diy_consumables" },
  { pattern: /\bSANDPAPER\b/i, brandHint: "diy_consumables" },
  { pattern: /\bROLLER\b/i, brandHint: "diy_consumables" },
  { pattern: /\bSCOTCH\b/i, brandHint: "diy_consumables" },
  { pattern: /\bSILICONE\s+GUN\b/i, brandHint: "diy_consumables" },
  { pattern: /\bPLASTER\s+SPONGE\b/i, brandHint: "diy_consumables" },
  { pattern: /\bGEO\s*TEXTILE\b/i, brandHint: "diy_consumables" },
  { pattern: /\bSAFETY\s+BOOT\b/i, brandHint: "diy_consumables" },
];

/** Preferred supplier names (first match wins) for each brand hint. */
const BRAND_SUPPLIER_PREFERENCES: Record<string, string[]> = {
  dulux: ["Dulux", "Dulux Trade", "JF Paints Blouberg - Dulux", "SSK Agriland Mossel Bay - Dulux"],
  plascon: ["DIY Savoy Plascon", "Plascon", "City Paint and Tool Plett Plascon POS"],
  prominent: ["PROMINENT", "Prominent Paints"],
  timberlife: ["TimberLife"],
  soudal: ["Soudal", "Soudal SA (Pty) Ltd"],
  marmoran: ["Marmoran"],
  urochem: ["Urochem Trading (Pty) Ltd", "UROCHEM"],
  cemcrete: ["Cemcrete"],
  diy_consumables: ["DIY Savoy Consumables"],
};

/** Plascon / DIY Savoy product-code prefixes seen in BuildSmart DEL lines. */
const PLASCON_SKU_PREFIXES = [
  "ASS",
  "AW",
  "AZH",
  "CAS",
  "EMS",
  "EPD",
  "EPL",
  "EPT",
  "GIP",
  "NY",
  "PEH",
  "PEM",
  "PGS",
  "PS",
  "TAP",
  "TCA",
  "TDV",
  "TLS",
  "TSA",
  "UC",
  "VLW",
  "HSWS",
];

/**
 * Infer brand from an embedded product code (e.g. "TSA001010 Prof. Super Matt").
 */
export function inferBrandHintFromSkuOrCode(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Leading alphanumeric code: TSA001010, PEM00100020L, AW000255-5010
  const codeMatch = trimmed.match(/^([A-Z]{2,4})[\d-]/i);
  if (codeMatch) {
    const prefix = codeMatch[1].toUpperCase();
    if (PLASCON_SKU_PREFIXES.includes(prefix)) return "plascon";
  }

  // Dulux numeric catalogue codes (7+ digits at start)
  if (/^\d{7,}\b/.test(trimmed)) return "dulux";

  // Standalone known family tokens in the code portion
  if (/\bTSA\s*10/i.test(trimmed)) return "plascon";
  if (/\bPEM\s*9/i.test(trimmed)) return "plascon";
  if (/\bTCA\s*10/i.test(trimmed)) return "plascon";

  return null;
}

/**
 * Infer a brand hint (dulux, plascon, …) from a product description.
 */
export function inferBrandHintFromDescription(description: string): string | null {
  const family = getCanonicalFamily(description);
  if (family?.brandHint) return family.brandHint;

  const fromCode = inferBrandHintFromSkuOrCode(description);
  if (fromCode) return fromCode;

  const upper = description.toUpperCase();
  for (const rule of BRAND_KEYWORD_RULES) {
    if (rule.pattern.test(upper)) return rule.brandHint;
  }
  return null;
}

/**
 * Given a brand hint and a list of supplier names from the DB, return the
 * best-matching canonical supplier name (or null).
 */
export function pickSupplierNameForBrand(
  brandHint: string,
  supplierNames: string[],
): string | null {
  const preferences = BRAND_SUPPLIER_PREFERENCES[brandHint] ?? [];
  const lowerNames = supplierNames.map((n) => n.toLowerCase());

  for (const preferred of preferences) {
    const idx = lowerNames.indexOf(preferred.toLowerCase());
    if (idx >= 0) return supplierNames[idx];
  }

  // Fallback: any supplier whose name contains the brand hint
  const hint = brandHint.toLowerCase();
  const contains = supplierNames.filter((n) => n.toLowerCase().includes(hint));
  if (contains.length === 1) return contains[0];
  if (contains.length > 1) {
    // Prefer shortest exact-ish match (e.g. "Dulux" over "Dulux Centurion")
    return contains.sort((a, b) => a.length - b.length)[0];
  }

  return null;
}

/**
 * Infer the canonical supplier name for a product description.
 */
export function inferSupplierNameFromDescription(
  description: string,
  supplierNames: string[],
  sku?: string | null,
): string | null {
  const brandHint =
    inferBrandHintFromDescription(description) ??
    (sku ? inferBrandHintFromSkuOrCode(sku) : null);
  if (!brandHint) return null;
  return pickSupplierNameForBrand(brandHint, supplierNames);
}
