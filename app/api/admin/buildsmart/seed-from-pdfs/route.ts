import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processBuildSmartImportJob } from "@/lib/workers/processBuildSmartImportJob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_FILES = 50;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role as string | undefined;
    const userId = (session?.user as any)?.id as string | undefined;

    if (!session || !role || !["ADMIN", "OFFICE"].includes(role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const pdfFiles = formData.getAll("pdfs");

    if (!pdfFiles.length) {
      return NextResponse.json(
        { error: "No PDF files provided" },
        { status: 400 },
      );
    }

    if (pdfFiles.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Too many files. Max ${MAX_FILES}.` },
        { status: 400 },
      );
    }

    const jobs = [];

    for (const entry of pdfFiles) {
      if (!(entry instanceof File)) continue;

      if (
        entry.type !== "application/pdf" &&
        !entry.name.toLowerCase().endsWith(".pdf")
      ) {
        continue;
      }

      if (entry.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File "${entry.name}" exceeds 10 MB limit.` },
          { status: 400 },
        );
      }

      const arrayBuffer = await entry.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");

      const job = await prisma.importJob.create({
        data: {
          type: "BUILDSMART_PDF_ORDER",
          status: "QUEUED",
          fileName: entry.name,
          fileUrl: base64,
          createdById: userId ?? null,
        },
        select: {
          id: true,
          fileName: true,
          status: true,
          createdAt: true,
        },
      });

      jobs.push(job);

      // Fire and forget. For proper production worker, move this to Trigger.dev/Inngest.
      processBuildSmartImportJob(job.id).catch((error) => {
        console.error(`Import job ${job.id} failed`, error);
      });
    }

    return NextResponse.json({
      summary: {
        totalFiles: jobs.length,
        parsedOrders: 0,
        parseFailures: 0,
        queuedOrders: jobs.length,
        seededOrders: 0,
        savedToDb: 0,
        duplicates: 0,
        skippedOrders: 0,
        stockOrdersDetected: 0,
        stockOrdersCreated: 0,
      },
      orders: [],
      stockOrders: [],
      savedOrderIds: [],
      duplicateRefs: [],
      skippedOrderNumbers: [],
      skipReasons: {},
      parseFailures: [],
      jobs,
    });
  } catch (error) {
    console.error("BuildSmart import queue failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "BuildSmart import queue failed",
      },
      { status: 500 },
    );
  }
}
