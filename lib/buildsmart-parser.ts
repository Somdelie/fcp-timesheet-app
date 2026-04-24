// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdf = require("pdf-parse/lib/pdf-parse");

// ── Types ──

export type ParsedItem = {
  costCode: string;
  productCode: string;
  rawDescription: string;
  unit: string;
  quantity: number;
  candidateSku: string | null;
};

export type ParsedOrder = {
  orderNumber: string;
  vendorName: string | null;
  vendorCode: string | null;
  siteCode: string | null;
  siteName: string | null;
  createdDate: string | null;
  items: ParsedItem[];
  rawText?: string;
};

export type SeedOrderItem = {
  sku: string;
  quantity: number;
  unitPriceAtOrder: number | null;
  uomAtOrder: string;
  unitSizeAtOrder: string;
  note: string;
};

export type SeedOrder = {
  reference: string;
  supplierId: string;
  siteCode: string;
  createdAt: string;
  note: string;
  items: SeedOrderItem[];
};

// ── Helpers ──

export function cleanText(input: string): string {
  return input
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

export function extractOrderNumber(text: string): string | null {
  const match = text.match(/Purchase Order\(s\)\s*#\s*(\d+)/i);
  return match?.[1] ?? null;
}

export function extractContract(text: string): {
  siteCode: string | null;
  siteName: string | null;
} {
  const match = text.match(/Contract\s*:\s*(\d+)\s*-\s*([^\n]+)/i);
  if (!match) return { siteCode: null, siteName: null };
  return { siteCode: match[1].trim(), siteName: match[2].trim() };
}

export function extractVendor(text: string): {
  vendorName: string | null;
  vendorCode: string | null;
} {
  // Vendor codes can be 2+ letters + 2+ digits (e.g. DIY000, TIMLIFE001, SOUDAL002)
  const m = text.match(/Payment In\s*:\s*\n\d+[A-Z]*\n(.+)\n([A-Z]{2,}\d{2,})/);
  if (!m) return { vendorName: null, vendorCode: null };
  return { vendorName: m[1].trim(), vendorCode: m[2].trim() };
}

export function extractCreatedDate(text: string): string | null {
  const m = text.match(/PO Creation Date\s*:\s*\n?(\d{2}\/\d{2}\/\d{4})/);
  if (!m) return null;
  const [dd, mm, yyyy] = m[1].split("/");
  return `${yyyy}-${mm}-${dd}`;
}

// ── PDF product code → DB SKU conversion ──

export function pdfCodeToSku(code: string, unit: string): string | null {
  const cleaned = code.replace(/\s/g, "");
  const prefixMatch = cleaned.match(/^([A-Z]+)/i);
  if (!prefixMatch) return null;

  const prefix = prefixMatch[1].toUpperCase();
  let digits = cleaned.slice(prefix.length);

  if (/^each$/i.test(unit)) return null;

  const unitMatch = unit.match(/^(\d+)([A-Z]+)?$/i);
  if (!unitMatch) return null;

  const sizeStr = unitMatch[1];
  const unitLetter = (unitMatch[2] || "").toUpperCase();

  // Strip size+unit suffix from the digit portion if present
  const suffix1 = sizeStr + unitLetter;
  const suffix2 = sizeStr;

  if (suffix1 && digits.toUpperCase().endsWith(suffix1)) {
    digits = digits.slice(0, -suffix1.length);
  } else if (suffix2 && digits.endsWith(suffix2)) {
    digits = digits.slice(0, -suffix2.length);
  }

  digits = digits.replace(/[A-Za-z]+$/, "");
  digits = digits.padStart(6, "0");

  const sizePadded = sizeStr.padStart(4, "0");
  return `${prefix}${digits}-${sizePadded}`;
}

// ── Extract items from the PDF text ──

function parseItemChunk(chunk: string): ParsedItem | null {
  const joined = chunk.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  if (!joined) return null;

  // Extract 6-digit cost code at start
  const costMatch = joined.match(/^(\d{6})\s*/);
  if (!costMatch) return null;

  const costCode = costMatch[1];
  let content = joined.slice(costMatch[0].length).trim();

  // Extract unit + quantity from end: "20L 5", "5L 2", "each 48"
  const uqMatch = content.match(/(each|\d+\s*[A-Z]{1,3})\s+(\d+)\s*$/i);

  let unit = "";
  let quantity = 1;

  if (uqMatch) {
    unit = uqMatch[1].replace(/\s/g, "");
    quantity = Number(uqMatch[2]);
    content = content.slice(0, uqMatch.index!).trim();
  }

  if (!content) return null;

  // Extract Plascon-style product code from start of content
  const codeMatch = content.match(/^([A-Z]{2,4}\s*[\d]+(?:\s*[\d]+)*[A-Z]*)/i);
  const productCode = codeMatch ? codeMatch[1].trim() : "";

  const candidateSku =
    productCode && unit ? pdfCodeToSku(productCode, unit) : null;

  return {
    costCode,
    productCode,
    rawDescription: content,
    unit,
    quantity,
    candidateSku,
  };
}

export function extractItems(
  text: string,
  siteCode: string | null,
): ParsedItem[] {
  // Try Contract section first, then Balance Sheet section
  const contractMatch = text.match(/Contract\s*:\s*\d+\s*-\s*[^\n]+/);
  const balanceMatch = text.match(/Balance Sheet Item\(s\)/i);

  const sectionMatch = contractMatch ?? balanceMatch;
  if (!sectionMatch || sectionMatch.index === undefined) return [];

  const startIdx = sectionMatch.index + sectionMatch[0].length;
  const footerIdx = text.indexOf("Authorised Signatory", startIdx);
  const endIdx = footerIdx !== -1 ? footerIdx : text.length;

  const section = text.slice(startIdx, endIdx).trim();
  if (!section) return [];

  if (contractMatch) {
    // Contract-based POs: split by "siteCode, Blank <lineNumber>" delimiter
    const escCode = (siteCode || "\\d{4}").replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );
    const delimiterPattern = new RegExp(`${escCode},\\s*Blank\\s+\\d+`, "g");
    const chunks = section
      .split(delimiterPattern)
      .map((s) => s.trim())
      .filter(Boolean);

    const items: ParsedItem[] = [];
    for (const chunk of chunks) {
      const parsed = parseItemChunk(chunk);
      if (parsed) items.push(parsed);
    }
    return items;
  }

  // Balance Sheet POs: items are line-delimited, each starting with a
  // line number + 6-digit material code (e.g. "1 080110 1838 Sandpaper ...")
  const lines = section
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const items: ParsedItem[] = [];

  for (const line of lines) {
    // Strip leading line number (e.g. "1 " or "2 ")
    const stripped = line.replace(/^\d+\s+/, "");
    const parsed = parseItemChunk(stripped);
    if (parsed) items.push(parsed);
  }

  return items;
}

// ── Parse a single PDF buffer ──

export async function parsePdfBuffer(
  buffer: Buffer,
): Promise<ParsedOrder | null> {
  if (!buffer || buffer.length === 0) return null;
  let data: { text: string };
  try {
    data = await pdf(buffer);
  } catch {
    return null;
  }
  const text = cleanText(data.text);

  const orderNumber = extractOrderNumber(text);
  if (!orderNumber) return null;

  const { vendorName, vendorCode } = extractVendor(text);
  const { siteCode, siteName } = extractContract(text);
  const createdDate = extractCreatedDate(text);
  const items = extractItems(text, siteCode);

  return {
    orderNumber,
    vendorName,
    vendorCode,
    siteCode,
    siteName,
    createdDate,
    items,
    rawText: text,
  };
}

// ── Generate downloadable seed code ──

export function generatePrismaSeedCode(orders: SeedOrder[]): string {
  const lines = [
    `// Auto-generated BuildSmart order seeds`,
    `// Generated at ${new Date().toISOString()}`,
    ``,
    `export const siteProductOrders = ${JSON.stringify(orders, null, 2)};`,
  ];
  return lines.join("\n");
}
