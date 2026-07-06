import { prisma } from "@/lib/prisma";
import { parseCostReportBuffers } from "@/lib/buildsmart-cost-parser";
import { importBuildSmartRowsStream } from "@/lib/procurement/buildsmartHistoricalImporter";
import type { BuildSmartRow } from "@/lib/procurement/buildsmartHistoricalImporter";
import { mapLedgerCategory } from "@/lib/buildsmart-ledger-mapper";

export async function processBuildSmartHistoricalCostJob(jobId: string) {
  const job = await prisma.importJob.findUnique({
    where: { id: jobId },
  });

  if (!job) throw new Error(`Import job not found: ${jobId}`);
  if (job.status !== "QUEUED") return;

  const meta = (job.resultJson ?? {}) as {
    action?: "parse" | "import";
    siteCodeOverride?: string | null;
  };

  const action = meta.action ?? "import";
  const siteCodeOverride = meta.siteCodeOverride ?? null;

  await prisma.importJob.update({
    where: { id: jobId },
    data: {
      status: "PROCESSING",
      startedAt: new Date(),
      error: null,
      resultJson: {
        ...meta,
        progress: {
          current: 1,
          total: 4,
          message: "Reading PDF file...",
        },
      },
    },
  });

  try {
    const buffer = Buffer.from(job.fileUrl, "base64");

    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        resultJson: {
          ...meta,
          progress: {
            current: 2,
            total: 4,
            message: "Parsing historical cost rows...",
          },
        },
      },
    });

    const parsed = await parseCostReportBuffers([
      {
        name: job.fileName,
        buffer,
      },
    ]);

    const parseWarnings: string[] = [];

    const allRows: (BuildSmartRow & {
      fileName: string;
      parseSiteCode: string | null;
      parseSiteName: string | null;
      parseWarning?: string;
    })[] = [];

    for (const { fileName, report } of parsed) {
      if (report.warnings.length) {
        parseWarnings.push(...report.warnings.map((w) => `[${fileName}] ${w}`));
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
            `[${fileName}] Row with ledger ${row.ledgerCode} has no date — skipped`,
          );
          continue;
        }

        allRows.push({
          siteCode: effectiveSiteCode,
          ledgerCode: row.ledgerCode,
          externalRef: row.externalRef,
          orderNumber: row.orderNumber,
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

    const rowsByCategory = allRows.reduce(
      (acc, row) => {
        const cat = mapLedgerCategory(row.ledgerCode);
        acc[cat] = (acc[cat] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    if (action === "parse") {
      const resultJson = {
        action: "parse",
        totalRows: allRows.length,
        rowsByCategory,
        parseWarnings,
        rows: allRows.map((r) => ({
          fileName: r.fileName,
          siteCode: r.siteCode,
          siteName: r.parseSiteName,
          ledgerCode: r.ledgerCode,
          category: mapLedgerCategory(r.ledgerCode),
          description: r.description,
          transactionDate: r.transactionDate,
          externalRef: r.externalRef,
          orderNumber: r.orderNumber,
          amount: r.amount,
          parseWarning: r.parseWarning,
        })),
        progress: {
          current: 4,
          total: 4,
          message: "Preview ready",
        },
      };

      await prisma.importJob.update({
        where: { id: jobId },
        data: {
          status: "COMPLETED",
          finishedAt: new Date(),
          resultJson: resultJson as any,
        },
      });

      return resultJson;
    }

    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        resultJson: {
          ...meta,
          progress: {
            current: 3,
            total: 4,
            message: "Importing historical cost rows...",
          },
        },
      },
    });

    const buildSmartImportRows: BuildSmartRow[] = allRows.map((r) => ({
      siteCode: r.siteCode,
      ledgerCode: r.ledgerCode,
      externalRef: r.externalRef,
      orderNumber: r.orderNumber,
      description: r.description,
      transactionDate: r.transactionDate,
      amount: r.amount,
    }));

    const counts: Record<string, number> = {
      NEW_HISTORICAL: 0,
      DUPLICATE_IMPORTED: 0,
      DUPLICATE_EXISTING_APP: 0,
      DUPLICATE_ORDER: 0,
      MISSING_SITE: 0,
      INVALID_ROW: 0,
    };

    const results: any[] = [];
    let done = 0;
    let total = buildSmartImportRows.length;

    for await (const item of importBuildSmartRowsStream(buildSmartImportRows)) {
      total = item.total;
      done = item.done;

      counts[item.result.status] = (counts[item.result.status] ?? 0) + 1;

      results.push({
        siteCode: item.result.row.siteCode,
        ledgerCode: item.result.row.ledgerCode,
        category:
          item.result.category ?? mapLedgerCategory(item.result.row.ledgerCode),
        description: item.result.row.description,
        transactionDate: item.result.row.transactionDate,
        amount: item.result.row.amount,
        status: item.result.status,
        reason: item.result.reason,
      });

      await prisma.importJob.update({
        where: { id: jobId },
        data: {
          resultJson: {
            action: "import",
            summary: counts,
            totalProcessed: done,
            rowsByCategory,
            parseWarnings,
            results,
            progress: {
              current: done,
              total,
              message: `Imported ${done} of ${total} rows`,
            },
          } as any,
        },
      });
    }

    const resultJson = {
      action: "import",
      summary: counts,
      totalProcessed: buildSmartImportRows.length,
      rowsByCategory,
      parseWarnings,
      results,
      progress: {
        current: total || 1,
        total: total || 1,
        message: "Historical cost import completed",
      },
    };

    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        resultJson: resultJson as any,
      },
    });

    return resultJson;
  } catch (error) {
    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        error: error instanceof Error ? error.message : String(error),
        resultJson: {
          ...meta,
          progress: {
            current: 1,
            total: 1,
            message: "Historical cost import failed",
          },
        },
      },
    });

    throw error;
  }
}
