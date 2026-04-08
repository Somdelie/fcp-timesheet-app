type DuluxResolvedProduct = {
  matchedProductName: string | null;
  family: "TRADE100" | "WB_PEARLGLO" | "SB_PEARLGLO" | null;
  rawDescription: string;
  didFallback: boolean;
};

function cleanText(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function normalizePaintText(raw: string): string {
  return cleanText(raw)
    .toUpperCase()
    .replace(/\bTARDE100\b/g, "TRADE100")
    .replace(/\bTRADE 100\b/g, "TRADE100")
    .replace(/\bW\/B\b/g, "WATERBASE")
    .replace(/\bWATERBASED\b/g, "WATERBASE")
    .replace(/\bS\/B\b/g, "SOLVENT BASE");
}

export function resolveDuluxBaseProduct(raw: string): DuluxResolvedProduct {
  const normalized = normalizePaintText(raw);

  if (normalized.includes("TRADE100")) {
    return {
      matchedProductName: "Trade 100 Lowsheen - Pastel 7",
      family: "TRADE100",
      rawDescription: raw,
      didFallback: true,
    };
  }

  if (normalized.includes("WATERBASE PEARLGLO")) {
    return {
      matchedProductName: "Waterbased Pearlglo - Base 7",
      family: "WB_PEARLGLO",
      rawDescription: raw,
      didFallback: true,
    };
  }

  if (normalized.includes("SOLVENT BASE PEARLGLO")) {
    return {
      matchedProductName: "Solvent Base Pearlglo - Base 7",
      family: "SB_PEARLGLO",
      rawDescription: raw,
      didFallback: true,
    };
  }

  return {
    matchedProductName: null,
    family: null,
    rawDescription: raw,
    didFallback: false,
  };
}
