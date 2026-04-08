export function resolvePlasconBaseProduct(raw: string) {
  const text = raw.toLowerCase();

  // Families and canonical names. Keep conservative to avoid false positives.
  const families: Array<{ match: RegExp; name: string }> = [
    { match: /velvaglo/i, name: "Plascon Velvaglo" },
    { match: /double\s*velvet/i, name: "Plascon Double Velvet" },
    {
      match: /wall\s*&\s*all|wall&all|wall and all/i,
      name: "Plascon Wall&All",
    },
    { match: /nuroof/i, name: "Plascon Nuroof Cool" },
    { match: /micatex/i, name: "Plascon Micatex" },
    {
      match: /superior\s*low\s*sheen|superior\s*low\s*sheen\s*acrylic/i,
      name: "Plascon Superior Low Sheen",
    },
    { match: /cashmere/i, name: "Plascon Cashmere" },
    { match: /velvaglo\s*wb|velvaglo\s*wb/i, name: "Plascon Velvaglo WB" },
    { match: /plascosafe/i, name: "Plascon Plascosafe" },
    { match: /plascoprime/i, name: "Plascon Plascoprime" },
    { match: /tradepro|trade\s*pro/i, name: "Plascon Tradepro" },
  ];

  for (const f of families) {
    if (f.match.test(text)) {
      return { matchedProductName: f.name };
    }
  }

  // Detect generic tint-derived items like "Base 7", "Base 8", "Base 9"
  if (
    /\bbase\s*\d+\b/.test(text) ||
    /\bbase\s*7|base\s*8|base\s*9/i.test(text)
  ) {
    // Prefer a safe family mapping if known
    if (/velvaglo|double\s*velvet|wall\s*&\s*all|nuroof|micatex/i.test(text)) {
      const fam = families.find((f) => f.match.test(text));
      if (fam) return { matchedProductName: fam.name };
    }
  }

  return { matchedProductName: null };
}

export default resolvePlasconBaseProduct;
