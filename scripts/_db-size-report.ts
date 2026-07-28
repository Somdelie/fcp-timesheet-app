/*
 * _db-size-report.ts
 *
 * Read-only report: table sizes (on-disk, from Postgres catalog) and row
 * counts for the tables suspected of driving DB storage growth.
 *
 * Run: npx tsx scripts/_db-size-report.ts
 */
import { prisma } from "@/lib/prisma";

async function main() {
  const sizes = await prisma.$queryRaw<
    { table_name: string; total_bytes: bigint; total_pretty: string }[]
  >`
    SELECT
      relname AS table_name,
      pg_total_relation_size(relid) AS total_bytes,
      pg_size_pretty(pg_total_relation_size(relid)) AS total_pretty
    FROM pg_catalog.pg_statio_user_tables
    ORDER BY pg_total_relation_size(relid) DESC
    LIMIT 15;
  `;

  console.log("\n=== Top 15 tables by on-disk size ===");
  for (const row of sizes) {
    console.log(`${row.table_name.padEnd(35)} ${row.total_pretty}`);
  }

  const dbSize = await prisma.$queryRaw<{ pretty: string }[]>`
    SELECT pg_size_pretty(pg_database_size(current_database())) AS pretty;
  `;
  console.log(`\nTotal database size: ${dbSize[0]?.pretty}`);

  const [noteEditHistoryCount, attendanceScanCount, siteDayPhotoCount, uploadLogCount, auditEventCount] =
    await Promise.all([
      prisma.noteEditHistory.count(),
      prisma.attendanceScan.count(),
      prisma.siteDayPhoto.count().catch(() => -1),
      prisma.siteDayPhotoUploadLog.count().catch(() => -1),
      prisma.auditEvent.count().catch(() => -1),
    ]);

  console.log("\n=== Row counts (suspected growth drivers) ===");
  console.log(`NoteEditHistory:          ${noteEditHistoryCount}`);
  console.log(`AttendanceScan:           ${attendanceScanCount}`);
  console.log(`SiteDayPhoto:             ${siteDayPhotoCount}`);
  console.log(`SiteDayPhotoUploadLog:    ${uploadLogCount}`);
  console.log(`AuditEvent:               ${auditEventCount}`);

  const oldestNewestEdit = await prisma.noteEditHistory.aggregate({
    _min: { createdAt: true },
    _max: { createdAt: true },
  });
  console.log(
    `\nNoteEditHistory span: ${oldestNewestEdit._min.createdAt?.toISOString()} -> ${oldestNewestEdit._max.createdAt?.toISOString()}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
