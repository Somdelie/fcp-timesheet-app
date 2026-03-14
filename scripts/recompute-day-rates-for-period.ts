import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { computeDayRateAtScan } from "@/lib/employeeDayRate";

/**
 * One-off backfill script to recompute dayRateAtScan for a given
 * fortnight (startISO/endISO) and foreman.
 *
 * Usage examples:
 *   pnpm ts-node scripts/recompute-day-rates-for-period.ts 2026-02-28_2026-03-13 cmm4j7d8k000109jr41gfxzg8
 *   pnpm ts-node scripts/recompute-day-rates-for-period.ts 2026-02-28_2026-03-13
 */

function parseArgs() {
  const [, , periodArg, foremanId] = process.argv;
  if (!periodArg) {
    console.error(
      "Usage: ts-node scripts/recompute-day-rates-for-period.ts <YYYY-MM-DD_YYYY-MM-DD> [foremanId]",
    );
    process.exit(1);
  }

  const m = periodArg.match(/^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/);
  if (!m) {
    console.error("Invalid period format. Expected YYYY-MM-DD_YYYY-MM-DD");
    process.exit(1);
  }

  const startISO = m[1];
  const endISO = m[2];

  const startDate = new Date(`${startISO}T00:00:00.000Z`);
  const endDate = new Date(`${endISO}T00:00:00.000Z`);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    console.error("Invalid dates in period argument.");
    process.exit(1);
  }

  return { startISO, endISO, startDate, endDate, foremanId: foremanId || null };
}

function addDaysUTC(d: Date, days: number) {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

async function main() {
  const { startISO, endISO, startDate, endDate, foremanId } = parseArgs();

  const endExclusive = addDaysUTC(endDate, 1);

  console.log("Recomputing dayRateAtScan for period", {
    startISO,
    endISO,
    foremanId: foremanId ?? "ALL",
  });

  // Load all attendance scans in this period (optionally filtered by foreman)
  const scans = await prisma.attendanceScan.findMany({
    where: {
      workDate: { gte: startDate, lt: endExclusive },
      ...(foremanId ? { siteDay: { foremanId } } : {}),
    },
    select: {
      id: true,
      employeeId: true,
      siteId: true,
      workDate: true,
      dayRateAtScan: true,
      siteDay: {
        select: { foremanId: true },
      },
    },
  });

  console.log("Found scans:", scans.length);

  let updated = 0;

  for (const scan of scans) {
    if (!scan.siteId || !scan.siteDay?.foremanId) continue;

    const workDate = new Date(scan.workDate);

    const result = await computeDayRateAtScan({
      employeeId: scan.employeeId,
      foremanId: scan.siteDay.foremanId,
      siteId: scan.siteId,
      workDate,
    });

    const newRate = result.dayRate;
    const oldRate = Number(scan.dayRateAtScan ?? 0);

    if (!Number.isFinite(newRate) || newRate <= 0) continue;
    if (newRate === oldRate) continue;

    await prisma.attendanceScan.update({
      where: { id: scan.id },
      data: { dayRateAtScan: newRate },
    });

    updated++;
  }

  console.log("Updated scans:", updated);
}

main()
  .catch((err) => {
    console.error("Recompute failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
