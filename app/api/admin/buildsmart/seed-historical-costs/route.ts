import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { parseCostReportBuffers } from "@/lib/buildsmart-cost-parser";
import {
  importBuildSmartRows,
  importBuildSmartRowsStream,
} from "@/lib/procurement/buildsmartHistoricalImporter";
import type { BuildSmartRow } from "@/lib/procurement/buildsmartHistoricalImporter";
import { mapLedgerCategory } from "@/lib/buildsmart-ledger-mapper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILES = 20;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

/**
 * POST /api/admin/buildsmart/seed-historical-costs
 *
 * Body: multipart/form-data
 *   pdfs[]     – one or more BuildSmart cost-report PDF files
 *   action     – "parse"  (preview only, nothing written to DB)
 *              – "import" (persist new historical costs)
 *   siteCode   – optional override; used when the PDF contains no contract header
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
    return NextResponse.json(
      { error: "No PDF files provided" },
      { status: 400 },
    );
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

  // ── Build BuildSmartRow[] from parsed results ──
  const allRows: (BuildSmartRow & {
    fileName: string;
    parseSiteCode: string | null;
    parseSiteName: string | null;
    parseWarning?: string;
  })[] = [];

  const parseWarnings: string[] = [];

  for (const { fileName, report } of parsed) {
    if (report.warnings.length) {
      parseWarnings.push(...report.warnings.map((w) => `[${fileName}] ${w}`));
    }

    for (const row of report.rows) {
      // Per-row siteCode from state machine; override wins when provided.
      const effectiveSiteCode = siteCodeOverride ?? row.siteCode ?? null;

      if (!effectiveSiteCode) {
        parseWarnings.push(
          `[${fileName}] Row skipped — no site code found. Use the "Site code override" field.`,
        );
        continue;
      }

      if (!row.transactionDate) {
        parseWarnings.push(
          `[${fileName}] Row with ledger ${row.ledgerCode} has no date — skipped`,
        );
        continue;
      }

      allRows.push({
        siteCode: effectiveSiteCode,
        ledgerCode: row.ledgerCode,
        externalRef: row.externalRef,
        description: row.description,
        transactionDate: row.transactionDate,
        amount: row.amount!,
        fileName,
        parseSiteCode: row.siteCode,
        parseSiteName: row.siteName,
        parseWarning: row.parseWarning,
      });
    }
  }

  const importRows = allRows;
  const rowsByCategory = importRows.reduce(
    (acc, r) => {
      const cat = mapLedgerCategory(r.ledgerCode);
      acc[cat] = (acc[cat] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  // ── Preview response (parse only) ──
  if (action === "parse") {
    return NextResponse.json({
      action: "parse",
      totalRows: importRows.length,
      rowsByCategory,
      parseWarnings,
      rows: importRows.map((r) => ({
        fileName: r.fileName,
        siteCode: r.siteCode,
        siteName: r.parseSiteName,
        ledgerCode: r.ledgerCode,
        category: mapLedgerCategory(r.ledgerCode),
        description: r.description,
        transactionDate: r.transactionDate,
        externalRef: r.externalRef,
        amount: r.amount,
        parseWarning: r.parseWarning,
      })),
    });
  }

  // ── Import all parsed financial rows (labour → wages, others → material cost) ──
  const buildSmartImportRows: BuildSmartRow[] = importRows.map((r) => ({
    siteCode: r.siteCode,
    ledgerCode: r.ledgerCode,
    externalRef: r.externalRef,
    description: r.description,
    transactionDate: r.transactionDate,
    amount: r.amount,
  }));

  const encoder = new TextEncoder();
  const counts = {
    NEW_HISTORICAL: 0,
    DUPLICATE_IMPORTED: 0,
    DUPLICATE_EXISTING_APP: 0,
    MISSING_SITE: 0,
    INVALID_ROW: 0,
  };

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let done = 0;

        for await (const {
          total,
          done: currentDone,
          result,
        } of importBuildSmartRowsStream(buildSmartImportRows)) {
          done = currentDone;
          counts[result.status] =
            (counts[result.status as keyof typeof counts] ?? 0) + 1;

          const line =
            JSON.stringify({
              type: "progress",
              total,
              done,
              result: {
                siteCode: result.row.siteCode,
                ledgerCode: result.row.ledgerCode,
                category:
                  result.category ?? mapLedgerCategory(result.row.ledgerCode),
                description: result.row.description,
                transactionDate: result.row.transactionDate,
                amount: result.row.amount,
                status: result.status,
                reason: result.reason,
              },
            }) + "\n";

          controller.enqueue(encoder.encode(line));
        }

        const doneLine =
          JSON.stringify({
            type: "done",
            summary: counts,
            totalProcessed: buildSmartImportRows.length,
            rowsByCategory,
            parseWarnings,
          }) + "\n";
        controller.enqueue(encoder.encode(doneLine));
      } catch (err) {
        const errLine =
          JSON.stringify({
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
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
    },
  });
}
