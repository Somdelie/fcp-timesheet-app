import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { parseCostReportBuffers } from "@/lib/buildsmart-cost-parser";
import { importMaterialOrdersStream } from "@/lib/procurement/buildsmartMaterialOrderImporter";
import type { ParsedMaterialLine } from "@/lib/buildsmart-cost-parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILES = 20;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

/**
 * POST /api/admin/buildsmart/seed-material-orders
 *
 * Seeds HISTORICAL material orders from BuildSmart "Detail Contract Cost Report" PDFs.
 * Only DEL-batch lines are processed — these represent past supplier purchase orders.
 * Each unique order number becomes one SiteProductOrder with createdAt = order date.
 *
 * Body: multipart/form-data
 *   pdfs[]   – one or more BuildSmart cost-report PDFs
 *   action   – "parse" (preview only) | "import" (write to DB)
 *   siteCode – optional override when PDF has no contract header
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (!session || !["ADMIN", "OFFICE"].includes(role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const action = (formData.get("action") as string | null) ?? "parse";
  const siteCodeOverride = (formData.get("siteCode") as string | null) ?? null;

  if (!["parse", "import"].includes(action)) {
    return NextResponse.json(
      { error: 'action must be "parse" or "import"' },
      { status: 400 },
    );
  }

  const pdfEntries = formData.getAll("pdfs");
  if (!pdfEntries.length) {
    return NextResponse.json({ error: "No PDF files provided" }, { status: 400 });
  }
  if (pdfEntries.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Too many files (max ${MAX_FILES})` },
      { status: 400 },
    );
  }

  // ── Parse PDFs ──
  const buffers: { name: string; buffer: Buffer }[] = [];
  for (const entry of pdfEntries) {
    if (!(entry instanceof File)) continue;
    if (entry.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `"${entry.name}" exceeds 20 MB limit` },
        { status: 400 },
      );
    }
    const ab = await entry.arrayBuffer();
    if (!ab.byteLength) continue;
    buffers.push({ name: entry.name, buffer: Buffer.from(ab) });
  }

  const parsed = await parseCostReportBuffers(buffers);

  // ── Collect DEL-batch material lines ──
  const allLines: (ParsedMaterialLine & { fileName: string })[] = [];
  const parseWarnings: string[] = [];

  for (const { fileName, report } of parsed) {
    if (report.warnings.length) {
      parseWarnings.push(...report.warnings.map((w) => `[${fileName}] ${w}`));
    }

    for (const line of report.materialLines) {
      const effectiveSiteCode = siteCodeOverride ?? line.siteCode ?? null;

      if (!effectiveSiteCode) {
        parseWarnings.push(
          `[${fileName}] Material line skipped — no site code. Use the "Site code override" field.`,
        );
        continue;
      }

      allLines.push({
        ...line,
        siteCode: effectiveSiteCode,
        fileName,
      });
    }
  }

  // ── Group preview by order number ──
  type OrderPreview = {
    fileName: string;
    orderNumber: string | null;
    siteCode: string;
    siteName: string | null;
    transactionDate: string;
    totalAmount: string;
    lineCount: number;
    lines: {
      description: string;
      quantity: number | null;
      unit: string | null;
      unitPrice: string | null;
      totalAmount: string;
      ledgerCode: string;
      batchRef: string;
    }[];
  };

  function buildOrderPreviews(
    lines: (ParsedMaterialLine & { fileName: string })[],
  ): OrderPreview[] {
    const map = new Map<string, OrderPreview>();
    for (const line of lines) {
      const key = `${line.siteCode}::${line.orderNumber ?? "__NO_ORDER__"}::${line.fileName}`;
      if (!map.has(key)) {
        map.set(key, {
          fileName: line.fileName,
          orderNumber: line.orderNumber,
          siteCode: line.siteCode,
          siteName: line.siteName,
          transactionDate: line.transactionDate.toISOString(),
          totalAmount: "0",
          lineCount: 0,
          lines: [],
        });
      }
      const preview = map.get(key)!;
      preview.lines.push({
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unitPrice: line.unitPrice,
        totalAmount: line.totalAmount,
        ledgerCode: line.ledgerCode,
        batchRef: line.batchRef,
      });
      preview.lineCount++;
      preview.totalAmount = (
        parseFloat(preview.totalAmount) + parseFloat(line.totalAmount)
      ).toFixed(2);
      // Use earliest date as order date
      if (line.transactionDate.toISOString() < preview.transactionDate) {
        preview.transactionDate = line.transactionDate.toISOString();
      }
    }
    return [...map.values()];
  }

  // ── Preview ──
  if (action === "parse") {
    const orders = buildOrderPreviews(allLines);
    return NextResponse.json({
      action: "parse",
      totalOrders: orders.length,
      totalLines: allLines.length,
      parseWarnings,
      orders,
    });
  }

  // ── Import (streamed NDJSON) ──
  const encoder = new TextEncoder();
  const counts = { CREATED: 0, DUPLICATE: 0, MISSING_SITE: 0, NO_ORDER_NUMBER: 0, ERROR: 0 };

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const { total, done, result } of importMaterialOrdersStream(allLines)) {
          counts[result.status as keyof typeof counts] =
            (counts[result.status as keyof typeof counts] ?? 0) + 1;

          const line = JSON.stringify({
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
          }) + "\n";
          controller.enqueue(encoder.encode(line));
        }

        const doneLine = JSON.stringify({
          type: "done",
          summary: counts,
          totalProcessed: allLines.length,
          parseWarnings,
        }) + "\n";
        controller.enqueue(encoder.encode(doneLine));
      } catch (err) {
        const errLine = JSON.stringify({
          type: "error",
          error: err instanceof Error ? err.message : "Import failed",
        }) + "\n";
        controller.enqueue(encoder.encode(errLine));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" },
  });
}
