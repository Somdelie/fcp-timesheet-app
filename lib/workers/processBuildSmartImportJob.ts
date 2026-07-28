import { prisma } from "@/lib/prisma";
import { importBuildSmartPdfOrders } from "./importBuildSmartPdfOrders";

export async function processBuildSmartImportJob(jobId: string) {
  const job = await prisma.importJob.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    throw new Error(`Import job not found: ${jobId}`);
  }

  if (job.status !== "QUEUED") {
    return;
  }

  await prisma.importJob.update({
    where: { id: jobId },
    data: {
      status: "PROCESSING",
      startedAt: new Date(),
      error: null,
      resultJson: {
        progress: {
          current: 0,
          total: 1,
          message: "Starting PDF import...",
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
          progress: {
            current: 1,
            total: 3,
            message: "Reading PDF file...",
          },
        },
      },
    });

    const result = await importBuildSmartPdfOrders({
      buffers: [
        {
          name: job.fileName,
          buffer,
        },
      ],
      userId: job.createdById,
    });

    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        // The uploaded PDF is only needed during processing — clear it so we
        // don't keep every original file's base64 bytes in the DB forever.
        fileUrl: "",
        resultJson: {
          ...(result as any),
          progress: {
            current: 3,
            total: 3,
            message: "Import completed",
          },
        },
      },
    });

    return result;
  } catch (error) {
    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        error: error instanceof Error ? error.message : String(error),
        fileUrl: "",
        resultJson: {
          progress: {
            current: 3,
            total: 3,
            message: "Import failed",
          },
        },
      },
    });

    throw error;
  }
}
