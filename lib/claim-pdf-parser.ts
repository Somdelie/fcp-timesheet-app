// Use dynamic import to avoid CommonJS module resolution issues in deployed environments

const SITE_CODE_RE = /FCP\s*[-–]\s*(\d{4,})/i;
const DATE_RE =
  /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i;
const MONTH_MAP: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

function parseSAAmount(raw: string): number {
  const cleaned = raw.replace(/\s/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function extractAmount(line: string | undefined): number {
  if (!line) return 0;
  // PDF text: "nett excl VAT 5 380 977,25      R" — amount precedes the trailing R
  const m = line.match(/(\d[\d ]*,\d{2})/);
  if (!m) return 0;
  return parseSAAmount(m[1]);
}

export interface ParsedClaim {
  siteCode: string;
  claimDate: Date;
  /** Current Cumulative value excl VAT */
  amountClaimed: number;
  /** Paid to date */
  amountReceived: number;
  parseWarning?: string;
}

export function parseClaimText(text: string): ParsedClaim | null {
  const siteMatch = text.match(SITE_CODE_RE);
  if (!siteMatch) return null;
  const siteCode = siteMatch[1];

  const dateMatch = text.match(DATE_RE);
  if (!dateMatch) return null;
  const claimDate = new Date(
    parseInt(dateMatch[3], 10),
    MONTH_MAP[dateMatch[2].toLowerCase()],
    parseInt(dateMatch[1], 10),
  );

  // "nett excl VAT" amounts appear in order:
  // [0] Previous Cumulative  [1] Current Claim  [2] Current Cumulative  [3] Paid to date  [4] Outstanding
  // PDF column ordering varies — amount may be on the same line, the next line, or the previous line.
  const lines = text.split("\n").map((l) => l.trim());
  const amounts: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (!/nett excl vat/i.test(lines[i])) continue;
    let amount = extractAmount(lines[i]);
    if (amount === 0) amount = extractAmount(lines[i + 1]);
    if (amount === 0) amount = extractAmount(lines[i - 1]);
    amounts.push(amount);
  }

  if (amounts.length < 3) {
    return {
      siteCode,
      claimDate,
      amountClaimed: 0,
      amountReceived: 0,
      parseWarning: `Only ${amounts.length} "nett excl VAT" lines found`,
    };
  }

  const amountClaimed = amounts[2];
  const amountReceived = amounts.length > 3 ? amounts[3] : 0;

  return { siteCode, claimDate, amountClaimed, amountReceived };
}

export async function parseClaimBuffers(
  buffers: { name: string; buffer: Buffer }[],
): Promise<{ fileName: string; claim: ParsedClaim | null; error?: string }[]> {
  const pdfParse = (await import("pdf-parse")).default;

  const results: {
    fileName: string;
    claim: ParsedClaim | null;
    error?: string;
  }[] = [];

  for (const { name, buffer } of buffers) {
    try {
      const result = await pdfParse(buffer);
      const text: string = result.text;

      const claim = parseClaimText(text);

      results.push({
        fileName: name,
        claim,
        error: claim ? undefined : "Could not extract claim data from PDF",
      });
    } catch (e) {
      results.push({
        fileName: name,
        claim: null,
        error: e instanceof Error ? e.message : "PDF parse error",
      });
    }
  }

  return results;
}
