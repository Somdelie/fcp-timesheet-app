/**
 * State-machine parser for BuildSmart "Detail Contract Cost Report" PDFs.
 *
 * Report structure (each section can repeat):
 *
 *   Contract: 6000 - Medicross Boksburg        -  -  9,945.51  9,945.51
 *   Activity: 0100 - Painting                  -  -  9,945.51  9,945.51
 *   924015 - Labour Only                       -  -  9,945.51  9,945.51
 *   07-Jun-2024  202301  P7100825  P7100825  Payroll 001 Posting - ...  2,010.00
 *   Period 8, Run 1
 *   27-Sep-2024  202305  P7101725  ...                                   2,336.36
 *
 * State transitions:
 *   CONTRACT line  → update currentSiteCode / currentSiteName
 *   ACTIVITY line  → ignored
 *   LEDGER line    → update currentLedgerCode / currentLedgerDesc
 *   TXN line       → emit row using current state
 *   Period/footer  → skip
 *
 * DEL-batch lines (batch token starts with "DEL") are material delivery invoices.
 * They are emitted into BOTH `rows` (as a financial MATERIAL record) AND
 * `materialLines` (structured order data for historical SiteProductOrder seeding).
 */

// pdf-parse v2.x exports PDFParse as a named class (no default export).
import type { BuildSmartRow } from "@/lib/procurement/buildsmartHistoricalImporter";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pdfParseModule = require("pdf-parse");
const PDFParse =
  pdfParseModule.default ?? pdfParseModule.PDFParse ?? pdfParseModule;

export interface ParsedCostRow extends Omit<
  BuildSmartRow,
  "siteCode" | "transactionDate"
> {
  siteCode: string;
  siteName: string | null;
  transactionDate: Date | null;
  rawLine: string;
  parseWarning?: string;
}

/**
 * A single DEL-batch line from a cost report, structured for material order import.
 * Multiple lines sharing the same orderNumber belong to one SiteProductOrder.
 */
export interface ParsedMaterialLine {
  siteCode: string;
  siteName: string | null;
  ledgerCode: string;
  /** BuildSmart PO/order number — the grouping key for SiteProductOrder.reference */
  orderNumber: string | null;
  /** DEL batch reference (e.g. "DEL770630") */
  batchRef: string;
  /** Supplier invoice/trans ref — the all-digit token after the batch (e.g. "93477835") */
  invoiceRef: string | null;
  /** Date the order was placed → SiteProductOrder.createdAt (overrides @default(now())) */
  transactionDate: Date;
  /** Product description extracted from the line */
  description: string;
  quantity: number | null;
  /** Size/unit token (e.g. "20L", "25L", "kg") */
  unit: string | null;
  /** Total line amount */
  totalAmount: string;
  /** Computed: totalAmount / quantity (null when qty unavailable) */
  unitPrice: string | null;
  rawLine: string;
}

export interface ParsedCostReport {
  /** Primary contract code found in PDF (may be null if none detected) */
  siteCode: string | null;
  siteName: string | null;
  /** Financial/labour rows — includes DEL-batch lines as MATERIAL category records */
  rows: ParsedCostRow[];
  /** DEL-batch material delivery lines for historical SiteProductOrder seeding */
  materialLines: ParsedMaterialLine[];
  warnings: string[];
}

// ── Pattern constants ────────────────────────────────────────────────────────

// "Contract: 6000 - Medicross Boksburg" or "Contract No. 6000 - ..."
const CONTRACT_RE = /^contract(?:\s+no\.?)?[:\s#]*(\d{4,6})\s*[-–]\s*(.+)$/i;

/** Strip trailing report total columns accidentally captured in the site name. */
function cleanContractSiteName(raw: string): string {
  return raw
    .replace(/\s{2,}.*$/, "") // double-space + trailing totals
    .replace(/\t.*$/, "") // tab-separated amount columns
    .replace(/\s*[-–]\s*[-–]\s*[\d,\s.]+\s*[\d,\s.]*\s*$/, "") // " - - 200,073.83 200,073.83"
    .replace(/\s+[\d,\s]+\.\d{2}\s*[\d,\s.]*\s*$/, "") // trailing currency amounts
    .trim();
}

// "924015 - Labour Only" or "922 - Materials" — 2–6 digit ledger code starting with 9.
// Newer report variants use 2-3 digit hierarchy codes (92, 922) instead of the
// full 6-digit summary codes (922010), so we accept 1–5 trailing digits.
const LEDGER_HEADER_RE = /^(9\d{1,5})\s*[-–]\s*(.+?)(?:\s{2,}.*)?$/;

// Transaction row: starts with dd-Mon-yyyy (e.g. "07-Jun-2024")
const TXN_DATE_PREFIX_RE =
  /^(\d{1,2}[-\s](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[-\s]\d{2,4})\b/i;

// Reference token: 1-4 uppercase letters followed by 3+ digits.
// Matches both payroll refs (P7101626) and invoice refs (CRI911028, INV652167, DL12074).
// Used with matchAll to extract Batch (1st token) and Trans Ref (2nd token).
const REF_TOKEN_RE = /\b([A-Z]{1,4}\d{3,})\b/g;

// DEL-batch token: identifies material delivery/invoice lines (e.g. DEL770630)
const DEL_BATCH_RE = /\bDEL\d{4,}\b/i;

// "Period N, Run M" continuation lines — always skip
const PERIOD_LINE_RE = /^period\s+\d+/i;

// PO delivery/quantity lines: contain a delivery-status word right after the date.
// These are physical-delivery confirmations with no financial amount — skip silently.
// "completed" is often concatenated with the batch number (e.g. "completed64144")
// so we cannot rely on a trailing word boundary for that token.
const PO_DELIVERY_RE = /\bcompleted\d*|\bpo\s+ready\b|\bpo\s+issued\b/i;

// Skip obvious report header/footer markers
const SKIP_RE =
  /^(page\s+\d|printed|report\s+date|date\s+printed|contract\s+cost\s+analysis|detail\s+contract|activity:|[-=*]{3,})/i;

// ── Date helpers ─────────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function parseDateStr(raw: string): Date | null {
  // dd-Mon-yyyy or dd Mon yyyy
  const m = raw.match(
    /^(\d{1,2})[-\s](jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[-\s](\d{2,4})$/i,
  );
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = MONTH_MAP[m[2].toLowerCase()];
  let year = parseInt(m[3], 10);
  if (year < 100) year += year < 50 ? 2000 : 1900;
  const d = new Date(Date.UTC(year, month, day));
  return isNaN(d.getTime()) ? null : d;
}

// ── Amount helpers ────────────────────────────────────────────────────────────

// Matches a decimal amount, possibly with comma/space thousand-separators and
// an optional trailing CR/DR indicator.
const AMOUNT_TOKEN_RE = /\d{1,3}(?:[,\s]\d{3})*\.\d{2}|\d+\.\d{2}/g;

function lastAmount(line: string): string | null {
  const matches = [...line.matchAll(AMOUNT_TOKEN_RE)];
  if (!matches.length) return null;
  const raw = matches[matches.length - 1][0];
  const clean = raw.replace(/[\s,]/g, "");
  const n = parseFloat(clean);
  if (isNaN(n) || n <= 0) return null;
  return n.toFixed(2);
}

/**
 * Smarter total resolver for DEL-batch lines.
 *
 * pdf-parse sometimes extracts PDF columns out of order, placing the unit-price
 * column AFTER the line total. When that happens, lastAmount() returns the unit
 * price instead of the total. This function corrects that by using the parsed
 * quantity as a discriminator:
 *
 *   qty > 1  → find the pair where unitPrice × qty ≈ total (±2 %); return total.
 *   fallback → return the maximum amount on the line (always ≥ unit price for qty ≥ 1).
 */
function resolveLineTotal(
  line: string,
  quantity: number | null,
): string | null {
  const amounts = [...line.matchAll(AMOUNT_TOKEN_RE)]
    .map((m) => parseFloat(m[0].replace(/[\s,]/g, "")))
    .filter((n) => n > 0);

  if (!amounts.length) return null;
  if (amounts.length === 1) return amounts[0].toFixed(2);

  if (quantity && quantity > 1) {
    for (const unitCandidate of amounts) {
      const expected = unitCandidate * quantity;
      const totalCandidate = amounts.find(
        (a) => a !== unitCandidate && Math.abs(a - expected) / expected < 0.02,
      );
      if (totalCandidate !== undefined) return totalCandidate.toFixed(2);
    }
  }

  // Fallback: last amount (matches what pdf-parse usually places last).
  // Do NOT use max — some report variants include a cumulative running-total
  // column that is larger than the current line total.
  return lastAmount(line);
}

// ── Material line field extraction ───────────────────────────────────────────

/**
 * Extracts structured fields from the portion of a DEL-batch TXN line after the date.
 *
 * Works position-agnostically because different BuildSmart report variants and
 * different pdf-parse extraction passes produce columns in different orders.
 *
 * Older format (columns extracted in logical order):
 *   202601 DEL770630 93477835 PEM00060020 Prof. Contractors Matt White 0000065149 60284 6 20L - - 2,555.04
 *
 * Newer format (pdf-parse extracts columns out of order):
 *   2101245133 202301 5L DEL910120 -5 63658 - - 2,295.31
 *
 * Strategy:
 *   1. Find DEL batch token wherever it sits
 *   2. Remove: DEL token, 6-digit period (YYYYPP), invoice ref (7+ digits, no leading zeros), GRN (leading zeros)
 *   3. Classify remaining tokens by type: unit / qty / orderNo / description
 */
function extractMaterialFields(afterDate: string): {
  batchRef: string;
  invoiceRef: string | null;
  orderNumber: string | null;
  quantity: number | null;
  unit: string | null;
  description: string;
} {
  // Find DEL batch token (position-agnostic)
  const batchMatch = afterDate.match(/\b(DEL\d+)\b/i);
  const batchRef = batchMatch ? batchMatch[1].toUpperCase() : "";

  // Strip trailing amount then remaining dashes
  let core = afterDate
    .replace(/\s*[\d,\s]+\.\d{2}\s*$/, "")
    .replace(/\s*[-–]+\s*$/, "")
    .trim();

  // Remove DEL batch token
  if (batchRef) core = core.replace(new RegExp(`\\b${batchRef}\\b`, "i"), "");

  // Remove the 6-digit accounting period (YYYYPP format: e.g. 202601, 202301)
  core = core.replace(/\b(20\d{2}(?:0[1-9]|1[0-3]))\b/, "");

  // Extract invoice/trans ref: first all-digit token ≥7 chars with no leading zeros
  // (GRNs use leading zeros like 0000065149; trans refs do not)
  const invoiceRefMatch = core.match(/\b(\d{7,})\b/);
  const invoiceRef =
    invoiceRefMatch && !invoiceRefMatch[1].startsWith("0000")
      ? invoiceRefMatch[1]
      : null;
  if (invoiceRef) core = core.replace(new RegExp(`\\b${invoiceRef}\\b`), "");

  // Remove zero-padded GRN numbers (e.g. 0000065149, 0000070569)
  core = core.replace(/\b0{3,}\d{4,}\b/g, "");

  // Normalise whitespace
  core = core.replace(/\s{2,}/g, " ").trim();

  // Classify remaining tokens by type
  const tokens = core.split(/\s+/).filter(Boolean);
  let orderNumber: string | null = null;
  let quantity: number | null = null;
  let unit: string | null = null;
  const descTokens: string[] = [];

  for (const token of tokens) {
    if (/^[-–.]+$/.test(token)) continue; // bare dash/dot placeholder

    // Comma-formatted amount (e.g. 1,119.48) — unit-price column extracted out
    // of position by pdf-parse on newer report layouts; never part of a product name.
    if (/^\d{1,3}(?:,\d{3})*\.\d{2}$/.test(token)) continue;

    // Unit: ends with "L" (20L, 5L) or is a known standalone unit word
    if (
      /^\d+L$/i.test(token) ||
      /^(kg|g|m2|m²|m|l|ltr|each|ea|pc|pcs|day|days|hr|hrs|bag|bags|set|sets)$/i.test(
        token,
      )
    ) {
      unit = token;
    }
    // Signed small integer (1–4 digits, possibly negative for returns)
    else if (/^-?\d{1,4}$/.test(token) && quantity === null) {
      const n = parseInt(token, 10);
      if (!isNaN(n)) quantity = n;
    }
    // Pure 4–6 digit number → order number candidate (last occurrence wins)
    else if (/^\d{4,6}$/.test(token)) {
      if (orderNumber !== null) descTokens.push(orderNumber);
      orderNumber = token;
    }
    // Everything else is description text
    else {
      descTokens.push(token);
    }
  }

  return {
    batchRef,
    invoiceRef,
    orderNumber,
    // Normalise negative qty from credit/return lines to positive count
    quantity: quantity !== null ? Math.abs(quantity) : null,
    unit,
    description: descTokens.join(" ").trim(),
  };
}

// ── State machine parser ──────────────────────────────────────────────────────

/**
 * Runs the state-machine parser directly against already-extracted report
 * text. Split out from parseCostReportBuffer so repair/backfill tooling can
 * feed it text recovered by other means (e.g. text pasted from a report that
 * can no longer be re-uploaded as a PDF) without going through pdf-parse.
 */
export function parseCostReportText(text: string): ParsedCostReport {
  const lines = text
    .split(/\r?\n/)
    .map((l: string) => l.trim())
    .filter(Boolean);

  // Mutable state
  let primarySiteCode: string | null = null;
  let primarySiteName: string | null = null;
  let currentSiteCode: string | null = null;
  let currentSiteName: string | null = null;
  let currentLedgerCode: string | null = null;

  const rows: ParsedCostRow[] = [];
  const materialLines: ParsedMaterialLine[] = [];
  const warnings: string[] = [];

  // Pre-scan: collect identifiers for reversed/credited DEL deliveries.
  // BuildSmart represents a canceled order with two lines:
  //   delivery line  →  normal positive amount
  //   reversal line  →  parenthetical amount e.g. (2,295.31)
  // The reversal line may or may not carry the same DEL batch token, so we
  // collect BOTH the batch ref AND the raw amount as fallback keys.
  const reversedBatchRefs = new Set<string>();
  const reversedAmounts = new Set<string>(); // normalised to "nnnn.nn"
  for (const scanLine of lines) {
    if (SKIP_RE.test(scanLine) || PERIOD_LINE_RE.test(scanLine)) continue;
    const scanTxn = scanLine.match(TXN_DATE_PREFIX_RE);
    if (!scanTxn) continue;
    const creditMatches = [
      ...scanLine.matchAll(/\(\s*([\d,\s]+\.\d{2})\s*\)/g),
    ];
    if (!creditMatches.length) continue;
    // Store each credited amount as a normalised string
    for (const m of creditMatches) {
      reversedAmounts.add(parseFloat(m[1].replace(/[\s,]/g, "")).toFixed(2));
    }
    // If the credit line also has a DEL batch token, store that too
    const scanAfterDate = scanLine.slice(scanTxn[0].length);
    if (DEL_BATCH_RE.test(scanAfterDate)) {
      const batchMatch = scanAfterDate.match(/\b(DEL\d+)\b/i);
      if (batchMatch) reversedBatchRefs.add(batchMatch[1].toUpperCase());
    }
  }

  for (const line of lines) {
    // ── Skip obvious header/footer lines ──
    if (SKIP_RE.test(line)) continue;
    if (PERIOD_LINE_RE.test(line)) continue;

    // ── Contract header ──
    const contractMatch = line.match(CONTRACT_RE);
    if (contractMatch) {
      currentSiteCode = contractMatch[1];
      currentSiteName = cleanContractSiteName(contractMatch[2]);
      if (!primarySiteCode) {
        primarySiteCode = currentSiteCode;
        primarySiteName = currentSiteName;
      }
      currentLedgerCode = null; // reset ledger on new contract
      continue;
    }

    // ── Ledger header (6-digit code starting with 9) ──
    const ledgerMatch = line.match(LEDGER_HEADER_RE);
    if (ledgerMatch) {
      currentLedgerCode = ledgerMatch[1];
      continue;
    }

    // ── Transaction row (starts with dd-Mon-yyyy) ──
    const txnMatch = line.match(TXN_DATE_PREFIX_RE);
    if (txnMatch) {
      if (!currentLedgerCode) {
        warnings.push(
          `Transaction row has no active ledger context: "${line.slice(0, 60)}"`,
        );
        continue;
      }
      if (!currentSiteCode) {
        warnings.push(
          `Transaction row has no active contract context: "${line.slice(0, 60)}"`,
        );
        continue;
      }

      const transactionDate = parseDateStr(txnMatch[1]);
      if (!transactionDate) {
        warnings.push(
          `Could not parse date "${txnMatch[1]}" on: "${line.slice(0, 60)}"`,
        );
        continue;
      }

      // PO delivery lines (completed / po ready) carry qty+unit, never a Rand amount.
      if (PO_DELIVERY_RE.test(line)) continue;

      // Credit/return lines have amounts in parentheses e.g. (2,295.31) — skip them.
      // These represent canceled orders; the original delivery is already excluded.
      if (/\(\s*[\d,]+\.\d{2}\s*\)/.test(line)) continue;

      const afterDate = line.slice(txnMatch[0].length);

      // ── DEL-batch: material delivery invoice ──
      // Emitted into materialLines (structured order data for SiteProductOrder seeding)
      // AND into rows (financial record so Historical Costs tab still captures the spend).
      if (DEL_BATCH_RE.test(afterDate)) {
        const fields = extractMaterialFields(afterDate);

        // Skip deliveries that have a corresponding credit in this PDF — fully reversed.
        // Check by DEL batch ref first; fall back to amount match when the credit
        // line uses a different batch token (e.g. a GL journal reversal).
        const deliveryAmount = lastAmount(line);
        const isReversed =
          (fields.batchRef && reversedBatchRefs.has(fields.batchRef)) ||
          (deliveryAmount !== null && reversedAmounts.has(deliveryAmount));
        if (isReversed) continue;

        const amount = resolveLineTotal(line, fields.quantity);
        if (amount) {
          const amountNum = parseFloat(amount);
          const unitPrice =
            fields.quantity && fields.quantity > 0
              ? (amountNum / fields.quantity).toFixed(2)
              : null;

          materialLines.push({
            siteCode: currentSiteCode,
            siteName: currentSiteName,
            ledgerCode: currentLedgerCode,
            transactionDate,
            totalAmount: amount,
            unitPrice,
            rawLine: line,
            ...fields,
          });

          // Also keep as a financial row so Historical Costs captures the material spend
          rows.push({
            siteCode: currentSiteCode,
            siteName: currentSiteName,
            ledgerCode: currentLedgerCode,
            transactionDate,
            externalRef: fields.invoiceRef ?? fields.batchRef,
            orderNumber: fields.orderNumber,
            description: fields.description,
            amount,
            rawLine: line,
          });
        }
        continue;
      }

      // ── Standard financial row ──
      const amount = lastAmount(line);
      if (!amount) {
        warnings.push(`No amount found on transaction: "${line.slice(0, 60)}"`);
        continue;
      }

      // Extract Batch (1st token) and Trans Ref (2nd token) from the line.
      // Format: [Period 6-dig] [Batch e.g. CRI911028] [TransRef e.g. INV652167] [desc...] [amount]
      // For payroll rows Batch === Trans Ref (P7101626 P7101626).
      const refTokens = [
        ...new Set([...afterDate.matchAll(REF_TOKEN_RE)].map((m) => m[1])),
      ];
      // refTokens[0] = Batch, refTokens[1] = Trans Ref (or same as Batch for payroll)
      const externalRef =
        refTokens.length > 0 ? (refTokens[1] ?? refTokens[0]) : undefined;

      rows.push({
        siteCode: currentSiteCode,
        siteName: currentSiteName,
        ledgerCode: currentLedgerCode,
        transactionDate,
        externalRef,
        amount,
        rawLine: line,
      });

      continue;
    }
  }

  if (rows.length === 0 && materialLines.length === 0) {
    warnings.push(
      "No transaction rows detected. Verify the PDF is a BuildSmart " +
        "'Detail Contract Cost Report' with ledger-grouped transaction lines.",
    );
  }

  return {
    siteCode: primarySiteCode,
    siteName: primarySiteName,
    rows,
    materialLines,
    warnings,
  };
}

export async function parseCostReportBuffer(
  buffer: Buffer,
): Promise<ParsedCostReport> {
  const parser = new PDFParse({ data: buffer });

  let text = "";

  try {
    const result = await parser.getText();
    text = result.text;
  } finally {
    await parser.destroy?.();
  }

  return parseCostReportText(text);
}

export async function parseCostReportBuffers(
  buffers: { name: string; buffer: Buffer }[],
): Promise<{ fileName: string; report: ParsedCostReport }[]> {
  const results = [];
  for (const { name, buffer } of buffers) {
    const report = await parseCostReportBuffer(buffer);
    results.push({ fileName: name, report });
  }
  return results;
}
