import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseCostReportBuffers } from "@/lib/buildsmart-cost-parser";
import { mapLedgerCategory } from "@/lib/buildsmart-ledger-mapper";
import type { BuildSmartRow } from "@/lib/procurement/buildsmartHistoricalImporter";
import { processBuildSmartHistoricalCostJob } from "@/lib/workers/processBuildSmartHistoricalCostJob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_FILES = 20;
const MAX_FILE_SIZE = 20 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role as string | undefined;
    const userId = (session?.user as any)?.id as string | undefined;

    if (!session || !["ADMIN", "OFFICE"].includes(role ?? "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const action = (formData.get("action") as string | null) ?? "parse";
    const siteCodeOverride =
      (formData.get("siteCode") as string | null)?.trim() || null;

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
        { error: `Too many files. Max ${MAX_FILES}.` },
        { status: 400 },
      );
    }

    const buffers: { name: string; buffer: Buffer }[] = [];

    for (const entry of pdfEntries) {
      if (!(entry instanceof File)) continue;

      if (
        entry.type !== "application/pdf" &&
        !entry.name.toLowerCase().endsWith(".pdf")
      ) {
        continue;
      }

      if (entry.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File "${entry.name}" exceeds 20 MB limit.` },
          { status: 400 },
        );
      }

      const arrayBuffer = await entry.arrayBuffer();

      if (!arrayBuffer.byteLength) continue;

      buffers.push({
        name: entry.name,
        buffer: Buffer.from(arrayBuffer),
      });
    }

    if (!buffers.length) {
      return NextResponse.json(
        { error: "No readable PDF files were provided" },
        { status: 400 },
      );
    }

    if (action === "parse") {
      const parsed = await parseCostReportBuffers(buffers);
      const parseWarnings: string[] = [];

      const importRows: (BuildSmartRow & {
        fileName: string;
        parseSiteCode: string | null;
        parseSiteName: string | null;
        parseWarning?: string;
      })[] = [];

      for (const { fileName, report } of parsed) {
        if (report.warnings.length) {
          parseWarnings.push(
            ...report.warnings.map((warning) => `[${fileName}] ${warning}`),
          );
        }

        for (const row of report.rows) {
          const effectiveSiteCode = siteCodeOverride ?? row.siteCode ?? null;

          if (!effectiveSiteCode) {
            parseWarnings.push(
              `[${fileName}] Row skipped — no site code found. Use the Site code override field.`,
            );
            continue;
          }

          if (!row.transactionDate) {
            parseWarnings.push(
              `[${fileName}] Row with ledger ${row.ledgerCode} has no date — skipped.`,
            );
            continue;
          }

          importRows.push({
            siteCode: effectiveSiteCode,
            ledgerCode: row.ledgerCode,
            externalRef: row.externalRef,
            orderNumber: row.orderNumber,
            description: row.description,
            transactionDate: row.transactionDate,
            amount: row.amount,
            fileName,
            parseSiteCode: row.siteCode,
            parseSiteName: row.siteName,
            parseWarning: row.parseWarning,
          });
        }
      }

      const rowsByCategory = importRows.reduce(
        (acc, row) => {
          const category = mapLedgerCategory(row.ledgerCode);
          acc[category] = (acc[category] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      return NextResponse.json({
        action: "parse",
        totalRows: importRows.length,
        rowsByCategory,
        parseWarnings,
        rows: importRows.map((row) => ({
          fileName: row.fileName,
          siteCode: row.siteCode,
          siteName: row.parseSiteName,
          ledgerCode: row.ledgerCode,
          category: mapLedgerCategory(row.ledgerCode),
          description: row.description,
          transactionDate: row.transactionDate,
          externalRef: row.externalRef,
          orderNumber: row.orderNumber,
          amount: row.amount,
          parseWarning: row.parseWarning,
        })),
      });
    }

    const jobs = [];

    for (const { name, buffer } of buffers) {
      const base64 = buffer.toString("base64");

      const job = await prisma.importJob.create({
        data: {
          type: "BUILDSMART_HISTORICAL_COST",
          status: "QUEUED",
          fileName: name,
          fileUrl: base64,
          createdById: userId ?? null,
          resultJson: {
            action: "import",
            siteCodeOverride,
            progress: {
              current: 0,
              total: 1,
              message: "Queued historical cost import",
            },
          },
        },
        select: {
          id: true,
          fileName: true,
          status: true,
          error: true,
          resultJson: true,
          createdAt: true,
          startedAt: true,
          finishedAt: true,
        },
      });

      jobs.push(job);

      processBuildSmartHistoricalCostJob(job.id).catch((error) => {
        console.error(`Historical cost job ${job.id} failed`, error);
      });
    }

    return NextResponse.json({
      summary: {
        totalFiles: jobs.length,
        queuedOrders: jobs.length,
        parsedOrders: 0,
        parseFailures: 0,
        seededOrders: 0,
        savedToDb: 0,
        duplicates: 0,
        skippedOrders: 0,
      },
      orders: [],
      jobs,
    });
  } catch (err) {
    console.error("BuildSmart historical-cost queue failed", err);

    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "BuildSmart historical-cost queue failed",
      },
      { status: 500 },
    );
  }
}
