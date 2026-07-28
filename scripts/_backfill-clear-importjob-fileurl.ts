/*
 * _backfill-clear-importjob-fileurl.ts
 *
 * One-time cleanup: ImportJob.fileUrl stores the raw base64 PDF for every
 * BuildSmart import, but it's only ever read once by the worker while
 * processing. For jobs that have already finished, clear it to reclaim
 * DB storage (verified via code search: nothing reads fileUrl back after
 * processing completes).
 */
import { prisma } from "@/lib/prisma";

async function main() {
  const before = await prisma.$queryRaw<{ total: bigint }[]>`
    SELECT COALESCE(SUM(pg_column_size("fileUrl")), 0) AS total FROM "ImportJob";
  `;
  console.log("fileUrl bytes before:", before[0]?.total);

  const result = await prisma.importJob.updateMany({
    where: {
      status: { in: ["COMPLETED", "FAILED"] },
      fileUrl: { not: "" },
    },
    data: { fileUrl: "" },
  });
  console.log("Rows cleared:", result.count);

  const after = await prisma.$queryRaw<{ total: bigint }[]>`
    SELECT COALESCE(SUM(pg_column_size("fileUrl")), 0) AS total FROM "ImportJob";
  `;
  console.log("fileUrl bytes after:", after[0]?.total);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
