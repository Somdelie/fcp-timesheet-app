import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
    const action = (formData.get("action") as string | null) ?? "import";
    const siteCodeOverride =
      (formData.get("siteCode") as string | null)?.trim() || null;

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

    const jobs = [];

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
      const base64 = Buffer.from(arrayBuffer).toString("base64");

      const job = await prisma.importJob.create({
        data: {
          type: "BUILDSMART_HISTORICAL_COST",
          status: "QUEUED",
          fileName: entry.name,
          fileUrl: base64,
          createdById: userId ?? null,
          resultJson: {
            action,
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
