export type StockProduct = {
  id: string;
  name: string;
  normalizedName?: string | null;
  sku?: string | null;
  category: string;
};

export type StockMatchResult = {
  matched: boolean;
  product?: StockProduct;
  confidence: number;
  reason: string;
};

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenOverlap(a: string[], b: string[]): number {
  const setB = new Set(b);
  const common = a.filter((t) => setB.has(t));
  const union = new Set([...a, ...b]);
  return union.size === 0 ? 0 : common.length / union.size;
}

const STOP = new Set(["the", "and", "for", "with", "of", "to", "a", "an"]);

function tokens(text: string) {
  return text.split(" ").filter((t) => t.length > 1 && !STOP.has(t));
}

export function matchStockProduct(
  rawDescription: string,
  products: StockProduct[],
): StockMatchResult {
  const normalized = normalize(rawDescription);
  const inputTokens = tokens(normalized);

  let best: { product: StockProduct; score: number } | null = null;

  for (const product of products) {
    const productNorm = normalize(product.normalizedName ?? product.name);

    if (productNorm === normalized) {
      return { matched: true, product, confidence: 1, reason: "Exact name match" };
    }

    if (
      product.sku &&
      normalize(product.sku) === normalize(rawDescription)
    ) {
      return { matched: true, product, confidence: 1, reason: "SKU match" };
    }

    if (productNorm && normalized.includes(productNorm)) {
      const score = 0.88;
      if (!best || score > best.score) best = { product, score };
      continue;
    }

    if (productNorm && productNorm.includes(normalized)) {
      const score = 0.82;
      if (!best || score > best.score) best = { product, score };
      continue;
    }

    const productTokens = tokens(productNorm);
    const overlap = tokenOverlap(inputTokens, productTokens);
    if (overlap >= 0.5 && (!best || overlap > best.score)) {
      best = { product, score: overlap };
    }
  }

  if (!best) return { matched: false, confidence: 0, reason: "No match found" };

  if (best.score >= 0.8) {
    return {
      matched: true,
      product: best.product,
      confidence: best.score,
      reason: best.score >= 0.88 ? "Name contains match" : "Token overlap match",
    };
  }

  return {
    matched: false,
    product: best.product,
    confidence: best.score,
    reason: "Low confidence — manual review required",
  };
}
