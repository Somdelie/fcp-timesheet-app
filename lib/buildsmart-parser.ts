import { normalizeBuildSmartProductCode } from "@/lib/procurement/buildsmartProductCodes";

// Lazy-load pdf-parse on first use to work around module resolution issues in deployed environments
let pdfParseModule: any = null;

async function getPDFParseModule() {
  if (!pdfParseModule) {
    const module = await import("pdf-parse");
    pdfParseModule = module;
  }
  return pdfParseModule;
}
// ── Types ──
export type ParsedItem = {
  costCode: string;
  productCode: string;
  rawDescription: string;
  unit: string;
  quantity: number;
  candidateSku: string | null;
  matched?: boolean;
  confidence?: number;
  productId?: string | null;
  productName?: string | null;
};

export type ParsedOrder = {
  orderNumber: string;
  vendorName: string | null;
  vendorCode: string | null;
  siteCode: string | null;
  siteName: string | null;
  createdDate: string | null;
  subject: string | null;
  foremanNameHint: string | null;
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
    .replace(/[ \t\xa0]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

export function extractSubject(text: string): string | null {
  const m = text.match(/Subject\s*:\s*([^\n]+)/i);
  return m ? m[1].trim() : null;
}

export function extractForemanNameFromSubject(
  subject: string | null,
): string | null {
  if (!subject) return null;
  // "STOCK - KENNETH NDLOVU" or "PPE - JOHN SMITH" → "KENNETH NDLOVU"
  const m = subject.match(/^[A-Z0-9\s]+\s*-\s*(.+)$/i);
  return m ? m[1].trim() : null;
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
  return normalizeBuildSmartProductCode(code, unit);
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

  let unit = "";
  let quantity = 1;

  // Format A: "unit qty" at end — e.g. "20L 5", "each 48" (Contract POs)
  const uqMatch = content.match(/(each|\d+\s*[A-Z]{1,3})\s+(\d+)\s*$/i);
  // Format B: "qty unit" at end — e.g. "1 each", "3 each" (Balance Sheet POs)
  const quMatch = content.match(/(\d+)\s+(each)\s*$/i);

  if (uqMatch) {
    unit = uqMatch[1].replace(/\s/g, "");
    quantity = Number(uqMatch[2]);
    content = content.slice(0, uqMatch.index!).trim();
  } else if (quMatch) {
    quantity = Number(quMatch[1]);
    unit = quMatch[2].toLowerCase();
    content = content.slice(0, quMatch.index!).trim();
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

function getSection(text: string, match: RegExpMatchArray): string {
  const startIdx = match.index! + match[0].length;
  const footerIdx = text.indexOf("Authorised Signatory", startIdx);
  const endIdx = footerIdx !== -1 ? footerIdx : text.length;
  return text.slice(startIdx, endIdx).trim();
}

type AdminProductDto = {
  id: string;
  name: string;
  sku: string | null;
};

/* ------------------------------------------------------------ */
/* 🔧 TEXT NORMALIZATION (CRITICAL)                             */
/* ------------------------------------------------------------ */
function normalizePdfText(section: string): string {
  return section
    .replace(/\u00A0/g, " ") // fix NBSP
    .replace(/(\d{6}[A-Z0-9]+)/g, "\n$1") // split merged rows
    .replace(/[ \t]+/g, " ") // collapse horizontal spaces only (preserve newlines)
    .replace(/\n[ \t]*/g, "\n") // trim line starts
    .replace(/\n{2,}/g, "\n") // collapse blank lines
    .trim();
}

/* ------------------------------------------------------------ */
/* 🔍 PRODUCT MATCHING                                          */
/* ------------------------------------------------------------ */
function matchProduct(
  item: ParsedItem,
  products: AdminProductDto[],
): {
  productId: string | null;
  productName: string | null;
  confidence: number;
} {
  const desc = item.rawDescription.toLowerCase();

  // 1. SKU match (strongest)
  if (item.candidateSku) {
    const skuMatch = products.find(
      (p) => p.sku?.toLowerCase() === item.candidateSku?.toLowerCase(),
    );
    if (skuMatch) {
      return {
        productId: skuMatch.id,
        productName: skuMatch.name,
        confidence: 1,
      };
    }
  }

  // 2. Product code match
  if (item.productCode) {
    const codeMatch = products.find((p) =>
      p.name.toLowerCase().includes(item.productCode.toLowerCase()),
    );
    if (codeMatch) {
      return {
        productId: codeMatch.id,
        productName: codeMatch.name,
        confidence: 0.7,
      };
    }
  }

  // 3. Description match
  const descMatch = products.find((p) => desc.includes(p.name.toLowerCase()));
  if (descMatch) {
    return {
      productId: descMatch.id,
      productName: descMatch.name,
      confidence: 0.4,
    };
  }

  return {
    productId: null,
    productName: null,
    confidence: 0,
  };
}

/* ------------------------------------------------------------ */
/* 🧠 MAIN PARSER                                               */
/* ------------------------------------------------------------ */
export function extractBalanceSheetItems(
  section: string,
  products: AdminProductDto[],
): ParsedItem[] {
  const items: ParsedItem[] = [];

  const normalized = normalizePdfText(section);

  const lines = normalized
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  console.log("[BS-DEBUG LINES]", lines);

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];

    let costCode = "";
    let productCode = "";
    let description = "";
    let quantity = 0;
    let unit = "";

    /* ----------------------------- */
    /* FORMAT 1a: With product code  */
    /* 1 080110 F0203 Brush ... 4 each */
    /* ----------------------------- */
    const m1a = line.match(
      /^\d+\s+(\d{6})\s+([A-Z]{1,4}\d[A-Z0-9]*)\s+(.+?)\s+(\d+)\s+(each|[A-Za-z]+)/i,
    );

    /* ----------------------------- */
    /* FORMAT 1b: No product code    */
    /* 3 080110 CLASSIC REFILL 4 each */
    /* ----------------------------- */
    const m1b = !m1a
      ? line.match(/^\d+\s+(\d{6})\s+(.+?)\s+(\d+)\s+(each|[A-Za-z]+)/i)
      : null;

    if (m1a) {
      costCode = m1a[1];
      productCode = m1a[2];
      description = m1a[3];
      quantity = Number(m1a[4]);
      unit = m1a[5];
    } else if (m1b) {
      costCode = m1b[1];
      productCode = "";
      description = m1b[2];
      quantity = Number(m1b[3]);
      unit = m1b[4];
    } else {
      /* ----------------------------- */
      /* FORMAT 2: Collapsed PDF       */
      /* 080110F0203 Brush ...each 11  */
      /* ----------------------------- */
      const m2 = line.match(
        /^(\d{6})([A-Z0-9]+)\s+(.+?)(each|[A-Za-z]+)\s+(\d+)$/i,
      );

      if (!m2) continue;

      costCode = m2[1];
      productCode = m2[2];
      description = m2[3];
      unit = m2[4];

      const qtyAndRow = m2[5];

      // remove row number suffix
      const rowLen = String(idx + 1).length;
      const qtyStr =
        qtyAndRow.length > rowLen ? qtyAndRow.slice(0, -rowLen) : qtyAndRow;

      quantity = Number(qtyStr);
    }

    if (!quantity || quantity <= 0) continue;

    const unitClean = unit.toLowerCase().replace(/\s/g, "");

    const candidateSku =
      productCode && unitClean ? pdfCodeToSku(productCode, unitClean) : null;

    const baseItem: ParsedItem = {
      costCode,
      productCode,
      rawDescription: description.trim(),
      unit: unitClean,
      quantity,
      candidateSku,
    };

    // 🔍 Match product
    const match = matchProduct(baseItem, products);

    items.push({
      ...baseItem,
      productId: match.productId,
      productName: match.productName,
      confidence: match.confidence,
      matched: match.confidence >= 0.7,
    });
  }

  console.log("[BS-DEBUG items parsed]", items);

  return items;
}

export function extractItems(
  text: string,
  siteCode: string | null,
): ParsedItem[] {
  const contractMatch = text.match(/Contract\s*:\s*\d+\s*-\s*[^\n]+/);
  const balanceMatch = text.match(/Balance Sheet Item\(s\)/i);

  // Balance Sheet marker takes priority — try it first
  console.log(
    "[BS-DEBUG] contractMatch:",
    !!contractMatch,
    "balanceMatch:",
    !!balanceMatch,
  );
  if (balanceMatch) {
    const section = getSection(text, balanceMatch);
    console.log("[BS-DEBUG] section length:", section.length);
    if (section) {
      const items = extractBalanceSheetItems(section, []);
      console.log("[BS-DEBUG] items found:", items.length);
      if (items.length > 0) return items;
    }
  }

  // Contract-based POs: split by "siteCode, Blank <lineNumber>" delimiter
  if (contractMatch) {
    const section = getSection(text, contractMatch);
    if (!section) return [];

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

  return [];
}

// ── Parse a single PDF buffer ──

export async function parsePdfBuffer(
  buffer: Buffer,
): Promise<ParsedOrder | null> {
  if (!buffer || buffer.length === 0) return null;
  let text: string;
  try {
    const module = await getPDFParseModule();
    const PDFParse = module.PDFParse || module.default;

    const parser = new PDFParse({ data: buffer } as { data: Buffer });
    const result = await parser.getText();
    await parser.destroy();
    text = cleanText(result.text);
  } catch (err) {
    console.error("PDF parsing error:", err);
    return null;
  }

  const orderNumber = extractOrderNumber(text);
  if (!orderNumber) return null;

  const { vendorName, vendorCode } = extractVendor(text);
  const { siteCode, siteName } = extractContract(text);
  const createdDate = extractCreatedDate(text);
  const items = extractItems(text, siteCode);
  const subject = extractSubject(text);
  const foremanNameHint = extractForemanNameFromSubject(subject);

  return {
    orderNumber,
    vendorName,
    vendorCode,
    siteCode,
    siteName,
    createdDate,
    subject,
    foremanNameHint,
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
