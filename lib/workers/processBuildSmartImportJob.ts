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
    },
  });

  try {
    const buffer = Buffer.from(job.fileUrl, "base64");

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
        resultJson: result as any,
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
      },
    });

    throw error;
  }
}
