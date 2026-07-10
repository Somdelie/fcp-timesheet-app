import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { parseCostReportBuffers } from "@/lib/buildsmart-cost-parser";
import { importMaterialOrdersStream } from "@/lib/procurement/buildsmartMaterialOrderImporter";

import type { ParsedMaterialLine } from "@/lib/buildsmart-cost-parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_FILES = 20;
const MAX_FILE_SIZE = 20 * 1024 * 1024;

type MaterialLineWithSource = ParsedMaterialLine & {
  fileName: string;
};

type OrderPreviewLine = {
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: string | null;
  totalAmount: string;
  ledgerCode: string;
  batchRef: string;
};

type OrderPreview = {
  fileName: string;
  orderNumber: string | null;
  siteCode: string;
  siteName: string | null;
  transactionDate: string;
  totalAmount: string;
  lineCount: number;
  lines: OrderPreviewLine[];
};

type ImportStatus =
  | "CREATED"
  | "DUPLICATE"
  | "MISSING_SITE"
  | "NO_ORDER_NUMBER"
  | "ERROR";

type ImportCounts = Record<ImportStatus, number>;

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSiteCode(value: unknown): string {
  return normalizeText(value).toUpperCase();
}

function normalizeOrderNumber(value: unknown): string | null {
  const normalized = normalizeText(value)
    .replace(/^PO[\s:#-]*/i, "")
    .replace(/\s+/g, "")
    .toUpperCase();

  return normalized || null;
}

function normalizeBatchRef(value: unknown): string {
  return normalizeText(value).toUpperCase();
}

function normalizeLedgerCode(value: unknown): string {
  return normalizeText(value).replace(/\s+/g, "");
}

function normalizeDecimal(value: unknown): string {
  const raw = String(value ?? "")
    .replace(/[R,\s]/gi, "")
    .replace(/[()]/g, "")
    .trim();

  const parsed = Number(raw);

  if (!Number.isFinite(parsed)) {
    return "0.00";
  }

  return parsed.toFixed(2);
}

function normalizeNullableDecimal(value: unknown): string | null {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  return normalizeDecimal(value);
}

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

/**
 * BuildSmart purchase-order delivery postings normally use DEL batch
 * references such as:
 *
 * DEL000123
 * DEL-00123
 * DEL 00123
 */
function isDeliveryBatch(batchRef: unknown): boolean {
  const normalized = normalizeBatchRef(batchRef);
  return /^DEL(?:\b|[-_/\s]|\d)/i.test(normalized);
}

/**
 * Creates one stable key per product line.
 *
 * This prevents duplicate lines where:
 * - the same PDF was uploaded twice;
 * - the same report appears in multiple uploaded files;
 * - the PDF parser repeats a line at a page boundary.
 */
function createLineFingerprint(line: MaterialLineWithSource): string {
  return [
    normalizeSiteCode(line.siteCode),
    normalizeOrderNumber(line.orderNumber) ?? "__NO_ORDER__",
    normalizeBatchRef(line.batchRef),
    normalizeLedgerCode(line.ledgerCode),
    line.transactionDate.toISOString().slice(0, 10),
    normalizeText(line.description).toLowerCase(),
    line.quantity ?? "",
    normalizeText(line.unit).toLowerCase(),
    normalizeNullableDecimal(line.unitPrice) ?? "",
    normalizeDecimal(line.totalAmount),
  ].join("::");
}

/**
 * Orders with a valid order number are grouped across all uploaded files.
 *
 * Rows without an order number are kept isolated by batch, date and file
 * so unrelated unidentified orders are not accidentally combined.
 */
function createOrderGroupKey(line: MaterialLineWithSource): string {
  const siteCode = normalizeSiteCode(line.siteCode);
  const orderNumber = normalizeOrderNumber(line.orderNumber);

  if (orderNumber) {
    return `${siteCode}::${orderNumber}`;
  }

  return [
    siteCode,
    "__NO_ORDER__",
    normalizeBatchRef(line.batchRef),
    line.transactionDate.toISOString().slice(0, 10),
    line.fileName,
  ].join("::");
}

function deduplicateMaterialLines(lines: MaterialLineWithSource[]): {
  lines: MaterialLineWithSource[];
  duplicateCount: number;
} {
  const seen = new Set<string>();
  const uniqueLines: MaterialLineWithSource[] = [];

  let duplicateCount = 0;

  for (const line of lines) {
    const fingerprint = createLineFingerprint(line);

    if (seen.has(fingerprint)) {
      duplicateCount += 1;
      continue;
    }

    seen.add(fingerprint);
    uniqueLines.push(line);
  }

  return {
    lines: uniqueLines,
    duplicateCount,
  };
}

function buildOrderPreviews(lines: MaterialLineWithSource[]): OrderPreview[] {
  type PreviewAccumulator = OrderPreview & {
    sourceFiles: Set<string>;
  };

  const groups = new Map<string, PreviewAccumulator>();

  for (const line of lines) {
    const key = createOrderGroupKey(line);
    const totalAmount = normalizeDecimal(line.totalAmount);

    let preview = groups.get(key);

    if (!preview) {
      preview = {
        fileName: line.fileName,
        sourceFiles: new Set([line.fileName]),
        orderNumber: normalizeOrderNumber(line.orderNumber),
        siteCode: normalizeSiteCode(line.siteCode),
        siteName: line.siteName ? normalizeText(line.siteName) : null,
        transactionDate: line.transactionDate.toISOString(),
        totalAmount: "0.00",
        lineCount: 0,
        lines: [],
      };

      groups.set(key, preview);
    } else {
      preview.sourceFiles.add(line.fileName);
    }

    preview.lines.push({
      description: normalizeText(line.description),
      quantity:
        typeof line.quantity === "number" && Number.isFinite(line.quantity)
          ? line.quantity
          : null,
      unit: line.unit ? normalizeText(line.unit) : null,
      unitPrice: normalizeNullableDecimal(line.unitPrice),
      totalAmount,
      ledgerCode: normalizeLedgerCode(line.ledgerCode),
      batchRef: normalizeBatchRef(line.batchRef),
    });

    preview.lineCount += 1;

    preview.totalAmount = (
      Number(preview.totalAmount) + Number(totalAmount)
    ).toFixed(2);

    const currentDate = line.transactionDate.toISOString();

    if (currentDate < preview.transactionDate) {
      preview.transactionDate = currentDate;
    }
  }

  return [...groups.values()]
    .map(({ sourceFiles, ...preview }) => ({
      ...preview,
      fileName: [...sourceFiles].join(", "),
      lines: [...preview.lines].sort((a, b) =>
        a.description.localeCompare(b.description),
      ),
    }))
    .sort((a, b) => {
      const siteComparison = a.siteCode.localeCompare(b.siteCode, undefined, {
        numeric: true,
      });

      if (siteComparison !== 0) {
        return siteComparison;
      }

      return (a.orderNumber ?? "").localeCompare(
        b.orderNumber ?? "",
        undefined,
        { numeric: true },
      );
    });
}

function createInitialCounts(): ImportCounts {
  return {
    CREATED: 0,
    DUPLICATE: 0,
    MISSING_SITE: 0,
    NO_ORDER_NUMBER: 0,
    ERROR: 0,
  };
}

/**
 * POST /api/admin/buildsmart/seed-material-orders
 *
 * Parses historical material orders from BuildSmart Detail Contract Cost
 * Report PDFs.
 *
 * Only DEL-batch transactions are imported.
 *
 * multipart/form-data:
 * - pdfs: one or more PDFs
 * - action: "parse" | "import"
 * - siteCode: optional site-code override
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session || !["ADMIN", "OFFICE"].includes(role ?? "")) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }

  try {
    const formData = await req.formData();

    const actionValue = formData.get("action");
    const action = typeof actionValue === "string" ? actionValue : "parse";

    const siteCodeValue = formData.get("siteCode");
    const siteCodeOverride =
      typeof siteCodeValue === "string" && siteCodeValue.trim()
        ? normalizeSiteCode(siteCodeValue)
        : null;

    if (action !== "parse" && action !== "import") {
      return NextResponse.json(
        {
          error: 'action must be either "parse" or "import"',
        },
        {
          status: 400,
        },
      );
    }

    const pdfEntries = formData.getAll("pdfs");

    if (pdfEntries.length === 0) {
      return NextResponse.json(
        {
          error: "No PDF files provided",
        },
        {
          status: 400,
        },
      );
    }

    if (pdfEntries.length > MAX_FILES) {
      return NextResponse.json(
        {
          error: `Too many files. A maximum of ${MAX_FILES} PDFs is allowed.`,
        },
        {
          status: 400,
        },
      );
    }

    const buffers: {
      name: string;
      buffer: Buffer;
    }[] = [];

    for (const entry of pdfEntries) {
      if (!(entry instanceof File)) {
        continue;
      }

      if (
        entry.type &&
        entry.type !== "application/pdf" &&
        !entry.name.toLowerCase().endsWith(".pdf")
      ) {
        return NextResponse.json(
          {
            error: `"${entry.name}" is not a PDF file`,
          },
          {
            status: 400,
          },
        );
      }

      if (entry.size === 0) {
        return NextResponse.json(
          {
            error: `"${entry.name}" is empty`,
          },
          {
            status: 400,
          },
        );
      }

      if (entry.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            error: `"${entry.name}" exceeds the 20 MB limit`,
          },
          {
            status: 400,
          },
        );
      }

      const arrayBuffer = await entry.arrayBuffer();

      buffers.push({
        name: entry.name,
        buffer: Buffer.from(arrayBuffer),
      });
    }

    if (buffers.length === 0) {
      return NextResponse.json(
        {
          error: "No valid PDF files were supplied",
        },
        {
          status: 400,
        },
      );
    }

    const parsedReports = await parseCostReportBuffers(buffers);

    const collectedLines: MaterialLineWithSource[] = [];
    const parseWarnings: string[] = [];

    let nonDeliveryLinesSkipped = 0;
    let invalidDateLinesSkipped = 0;
    let missingSiteLinesSkipped = 0;

    for (const { fileName, report } of parsedReports) {
      for (const warning of report.warnings ?? []) {
        parseWarnings.push(`[${fileName}] ${warning}`);
      }

      for (const sourceLine of report.materialLines ?? []) {
        /**
         * Do not rely only on the parser to filter DEL transactions.
         * The API route enforces this rule too.
         */
        if (!isDeliveryBatch(sourceLine.batchRef)) {
          nonDeliveryLinesSkipped += 1;
          continue;
        }

        if (!isValidDate(sourceLine.transactionDate)) {
          invalidDateLinesSkipped += 1;

          parseWarnings.push(
            `[${fileName}] Material line skipped because its transaction date is invalid: ${normalizeText(
              sourceLine.description,
            )}`,
          );

          continue;
        }

        const effectiveSiteCode =
          siteCodeOverride ?? normalizeSiteCode(sourceLine.siteCode);

        if (!effectiveSiteCode) {
          missingSiteLinesSkipped += 1;

          parseWarnings.push(
            `[${fileName}] Material line skipped because no site code was detected. Use the Site code override field.`,
          );

          continue;
        }

        collectedLines.push({
          ...sourceLine,
          siteCode: effectiveSiteCode,
          siteName: sourceLine.siteName
            ? normalizeText(sourceLine.siteName)
            : null,
          orderNumber: normalizeOrderNumber(sourceLine.orderNumber),
          batchRef: normalizeBatchRef(sourceLine.batchRef),
          ledgerCode: normalizeLedgerCode(sourceLine.ledgerCode),
          description: normalizeText(sourceLine.description),
          totalAmount: normalizeDecimal(sourceLine.totalAmount),
          unitPrice: normalizeNullableDecimal(sourceLine.unitPrice),
          unit: sourceLine.unit ? normalizeText(sourceLine.unit) : null,
          fileName,
        });
      }
    }

    const deduplicated = deduplicateMaterialLines(collectedLines);

    const allLines = deduplicated.lines;
    const orderPreviews = buildOrderPreviews(allLines);

    if (nonDeliveryLinesSkipped > 0) {
      parseWarnings.push(
        `${nonDeliveryLinesSkipped} non-DEL material line(s) were excluded.`,
      );
    }

    if (deduplicated.duplicateCount > 0) {
      parseWarnings.push(
        `${deduplicated.duplicateCount} repeated material line(s) were removed before import.`,
      );
    }

    if (invalidDateLinesSkipped > 0) {
      parseWarnings.push(
        `${invalidDateLinesSkipped} material line(s) had invalid dates and were excluded.`,
      );
    }

    if (missingSiteLinesSkipped > 0) {
      parseWarnings.push(
        `${missingSiteLinesSkipped} material line(s) had no site code and were excluded.`,
      );
    }

    if (action === "parse") {
      return NextResponse.json({
        action: "parse",
        totalOrders: orderPreviews.length,
        totalLines: allLines.length,
        rawMaterialLines: collectedLines.length,
        duplicateLinesRemoved: deduplicated.duplicateCount,
        nonDeliveryLinesSkipped,
        invalidDateLinesSkipped,
        missingSiteLinesSkipped,
        parseWarnings,
        orders: orderPreviews,
      });
    }

    if (allLines.length === 0) {
      return NextResponse.json(
        {
          error:
            "No valid DEL-batch material lines were found in the uploaded PDFs",
          parseWarnings,
        },
        {
          status: 400,
        },
      );
    }

    const encoder = new TextEncoder();
    const counts = createInitialCounts();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of importMaterialOrdersStream(allLines)) {
            const { total, done, result } = event;

            const status = result.status as ImportStatus;

            if (status in counts) {
              counts[status] += 1;
            } else {
              counts.ERROR += 1;
            }

            controller.enqueue(
              encoder.encode(
                `${JSON.stringify({
                  type: "progress",
                  total,
                  done,
                  result: {
                    orderNumber: result.orderNumber,
                    siteCode: result.siteCode,
                    siteName: result.siteName,
                    transactionDate: result.transactionDate,
                    totalAmount: result.totalAmount,
                    linesCreated: result.linesCreated,
                    status: result.status,
                    reason: result.reason,
                  },
                })}\n`,
              ),
            );
          }

          controller.enqueue(
            encoder.encode(
              `${JSON.stringify({
                type: "done",
                summary: counts,

                // This is the number of grouped orders, not source rows.
                totalProcessed: orderPreviews.length,

                totalLines: allLines.length,
                duplicateLinesRemoved: deduplicated.duplicateCount,
                nonDeliveryLinesSkipped,
                parseWarnings,
              })}\n`,
            ),
          );
        } catch (error) {
          console.error("Historical material order import failed", error);

          controller.enqueue(
            encoder.encode(
              `${JSON.stringify({
                type: "error",
                error:
                  error instanceof Error
                    ? error.message
                    : "Historical material order import failed",
              })}\n`,
            ),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Connection: "keep-alive",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("BuildSmart material-order endpoint failed", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to process BuildSmart material-order PDFs",
      },
      {
        status: 500,
      },
    );
  }
}
