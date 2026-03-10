import fs from "fs";
import path from "path";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdf = require("pdf-parse/lib/pdf-parse");

type ParsedItem = {
  rawDescription: string;
  quantity: number;
  normalizedProductName: string | null;
};

type ParsedOrder = {
  orderNumber: string;
  supplierCode: string | null;
  supplierName: string | null;
  siteCode: string | null;
  siteName: string | null;
  items: ParsedItem[];
};

type SeedOrder = {
  orderNumber: string;
  supplierCode: string;
  supplierName: string;
  siteCode?: string;
  siteName?: string;
  items: {
    productName: string;
    quantity: number;
  }[];
};

const PDF_DIR = path.resolve(process.cwd(), "buildsmart-pdfs");

/**
 * Supplier normalization
 * Adjust codes/names to your real DB values.
 */
const SUPPLIER_MAP: Array<{
  match: RegExp;
  supplierCode: string;
  supplierName: string;
}> = [
  {
    match: /DIY Savoy Consumables/i,
    supplierCode: "DIY001",
    supplierName: "DIY Savoy Consumables",
  },
  {
    match: /DIY Savoy Plascon|Kansai Plascon|Plascon/i,
    supplierCode: "PLAS001",
    supplierName: "Plascon",
  },
];

/**
 * Product normalization
 * Add to this list as you discover more BuildSmart descriptions.
 *
 * Rule from you:
 * - Any Prof Superior Low Sheen Acrylic T/Base Pastel/Deep/Transparent 5L
 *   becomes Plascon Superior Low Sheen 5L
 * - Ignore tint codes
 */
function normalizeProductName(raw: string): string | null {
  const text = cleanText(raw);

  if (/424\s*Turps\s*5L/i.test(text)) {
    return "424 Turps 5L";
  }

  if (/Paint\s*Stripper/i.test(text)) {
    return "Paint Stripper";
  }

  if (/Dish\s*Washing\s*Liquid/i.test(text)) {
    return "DISH WASHING LIQUID";
  }

  if (
    /Prof\.?\s*Superior\s*Low\s*Sheen/i.test(text) ||
    /Superior\s*Low\s*Sheen\s*Acrylic/i.test(text)
  ) {
    if (/5L/i.test(text)) {
      return "Plascon Superior Low Sheen 5L";
    }
  }

  return null;
}

function cleanText(input: string): string {
  return input
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function normalizeSupplier(text: string): {
  supplierCode: string | null;
  supplierName: string | null;
} {
  for (const s of SUPPLIER_MAP) {
    if (s.match.test(text)) {
      return {
        supplierCode: s.supplierCode,
        supplierName: s.supplierName,
      };
    }
  }

  return {
    supplierCode: null,
    supplierName: null,
  };
}

function extractOrderNumber(text: string): string | null {
  const match = text.match(/Purchase Order\(s\)\s*#\s*(\d+)/i);
  return match?.[1] ?? null;
}

function extractContract(text: string): {
  siteCode: string | null;
  siteName: string | null;
} {
  const match = text.match(/Contract\s*:\s*(\d+)\s*-\s*([^\n]+)/i);
  if (!match) {
    return { siteCode: null, siteName: null };
  }

  return {
    siteCode: match[1].trim(),
    siteName: match[2].trim(),
  };
}

function extractSupplierBlock(text: string): string {
  const match = text.match(/Payment In\s*:\s*([\s\S]*?)Quote-No\s*:/i);
  return cleanText(match?.[1] ?? text);
}

/**
 * Extract item blocks from the material section.
 */
function extractItems(text: string): ParsedItem[] {
  const materialStart = text.indexOf("Material");
  if (materialStart === -1) return [];

  const contractStart = text.indexOf("Contract :", materialStart);
  if (contractStart === -1) return [];

  const footerStart =
    text.indexOf("Authorised Signatory", contractStart) !== -1
      ? text.indexOf("Authorised Signatory", contractStart)
      : text.length;

  const section = cleanText(text.slice(contractStart, footerStart));

  const chunks = section
    .split(/\b\d+\s*,\s*Blank\d+\b/gi)
    .map((s) => cleanText(s))
    .filter(Boolean);

  const items: ParsedItem[] = [];

  for (const chunk of chunks) {
    if (!/\d/.test(chunk)) continue;
    if (/^Contract\s*:/i.test(chunk)) continue;

    const qtyMatch = chunk.match(
      /(?:\b1L\b|\b2L\b|\b5L\b|\b20L\b|\b25KG\b|\b50KG\b)\s+(\d+)\b/i,
    );

    let quantity = 1;
    if (qtyMatch) {
      quantity = Number(qtyMatch[1]);
    } else {
      const ints = [...chunk.matchAll(/\b(\d+)\b/g)].map((m) => Number(m[1]));
      if (ints.length > 0) {
        quantity = ints[ints.length - 1];
      }
    }

    let rawDescription = chunk
      .replace(/^Contract\s*:\s*[^\n]+\n?/i, "")
      .replace(/^\d+\s+[A-Z0-9]+\s*/i, "")
      .trim();

    rawDescription = rawDescription
      .replace(/\b(?:1L|2L|5L|20L|25KG|50KG)\s+\d+\s*$/i, "")
      .trim();

    const normalizedProductName = normalizeProductName(rawDescription);

    items.push({
      rawDescription,
      quantity,
      normalizedProductName,
    });
  }

  if (items.length === 0) {
    const lines = section
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    for (const line of lines) {
      if (/^Contract\s*:/i.test(line)) continue;
      if (/Authorised Signatory/i.test(line)) continue;

      const normalizedProductName = normalizeProductName(line);
      if (!normalizedProductName) continue;

      const qtyMatch = line.match(/\b(\d+)\b(?!.*\b\d+\b)/);
      const quantity = qtyMatch ? Number(qtyMatch[1]) : 1;

      items.push({
        rawDescription: line,
        quantity,
        normalizedProductName,
      });
    }
  }

  return items;
}

async function parsePdfFile(filePath: string): Promise<ParsedOrder | null> {
  const buffer = fs.readFileSync(filePath);
  const data = await pdf(buffer);
  const text = cleanText(data.text);

  const orderNumber = extractOrderNumber(text);
  if (!orderNumber) return null;

  const supplierBlock = extractSupplierBlock(text);
  const { supplierCode, supplierName } = normalizeSupplier(supplierBlock);

  const { siteCode, siteName } = extractContract(text);
  const items = extractItems(text);

  return {
    orderNumber,
    supplierCode,
    supplierName,
    siteCode,
    siteName,
    items,
  };
}

function buildSeedOrders(parsedOrders: ParsedOrder[]) {
  const siteProductOrders: SeedOrder[] = [];
  const skippedOrderNumbers: string[] = [];
  const skipReasons: Record<string, string[]> = {};

  for (const order of parsedOrders) {
    const reasons: string[] = [];

    if (!order.supplierCode || !order.supplierName) {
      reasons.push("Missing mapped supplier");
    }

    const validItems = order.items.filter((item) => item.normalizedProductName);
    const invalidItems = order.items.filter(
      (item) => !item.normalizedProductName,
    );

    if (validItems.length === 0) {
      reasons.push("No mapped products");
    }

    if (invalidItems.length > 0) {
      reasons.push(
        `Unknown products: ${invalidItems.map((i) => `"${i.rawDescription}"`).join(", ")}`,
      );
    }

    if (reasons.length > 0) {
      skippedOrderNumbers.push(order.orderNumber);
      skipReasons[order.orderNumber] = reasons;
      continue;
    }

    siteProductOrders.push({
      orderNumber: order.orderNumber,
      supplierCode: order.supplierCode!,
      supplierName: order.supplierName!,
      ...(order.siteCode ? { siteCode: order.siteCode } : {}),
      ...(order.siteName ? { siteName: order.siteName } : {}),
      items: validItems.map((item) => ({
        productName: item.normalizedProductName!,
        quantity: item.quantity,
      })),
    });
  }

  return { siteProductOrders, skippedOrderNumbers, skipReasons };
}

async function main() {
  if (!fs.existsSync(PDF_DIR)) {
    console.error(`PDF folder not found: ${PDF_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(PDF_DIR)
    .filter((name) => /^ORDER\s+\d+\.pdf$/i.test(name))
    .map((name) => path.join(PDF_DIR, name))
    .sort((a, b) => a.localeCompare(b));

  const parsedOrders: ParsedOrder[] = [];

  for (const file of files) {
    const parsed = await parsePdfFile(file);
    if (parsed) {
      parsedOrders.push(parsed);
    }
  }

  const { siteProductOrders, skippedOrderNumbers, skipReasons } =
    buildSeedOrders(parsedOrders);

  console.log("\n// siteProductOrders");
  console.log(
    JSON.stringify(siteProductOrders, null, 2).replace(/"([^"]+)":/g, "$1:"),
  );

  console.log("\n// skippedOrderNumbers");
  console.log(JSON.stringify(skippedOrderNumbers, null, 2));

  console.log("\n// skipReasons");
  console.log(
    JSON.stringify(skipReasons, null, 2).replace(/"([^"]+)":/g, "$1:"),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// Re-export for use by the API route
export {
  cleanText,
  normalizeSupplier,
  normalizeProductName,
  extractOrderNumber,
  extractContract,
  extractSupplierBlock,
  extractItems,
  buildSeedOrders,
};
export type { ParsedOrder, ParsedItem, SeedOrder };
