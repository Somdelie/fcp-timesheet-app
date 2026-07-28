import { prisma } from "../lib/prisma";
import { computeDayRateAtScan } from "../lib/employeeDayRate";

const EMPLOYEE_QR = "F5972F59CE2A3F40";
const BATCH_REASON =
  "Manual timesheet scan seed: William Temo 2026-06-20 to 2026-07-03";

type ScanSeedRow = {
  siteCode: string;
  workDate: string;
};

const rows: ScanSeedRow[] = [
  // 6795 OKAVANGO - 5 days
  { siteCode: "6795", workDate: "2026-06-20" },
  { siteCode: "6795", workDate: "2026-06-22" },
  { siteCode: "6795", workDate: "2026-06-24" },
  { siteCode: "6795", workDate: "2026-06-26" },
  { siteCode: "6795", workDate: "2026-07-01" },

  // 6226 JOSHUA GEN - 4 days
  { siteCode: "6226", workDate: "2026-06-23" },
  { siteCode: "6226", workDate: "2026-06-25" },
  { siteCode: "6226", workDate: "2026-06-29" },
  { siteCode: "6226", workDate: "2026-07-03" },

  // 6785 VIRGIN ACTIVE - 5 days
  { siteCode: "6785", workDate: "2026-06-21" },
  { siteCode: "6785", workDate: "2026-06-27" },
  { siteCode: "6785", workDate: "2026-06-28" },
  { siteCode: "6785", workDate: "2026-06-30" },
  { siteCode: "6785", workDate: "2026-07-02" },
];

function dateUTC(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function main() {
  const apply = process.argv.includes("--apply");

  const employee = await prisma.employee.findUnique({
    where: { qrCodeValue: EMPLOYEE_QR },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      qrCodeValue: true,
      isActive: true,
      user: {
        select: {
          foreman: {
            select: { id: true, user: { select: { name: true } } },
          },
        },
      },
    },
  });

  if (!employee) throw new Error(`Employee ${EMPLOYEE_QR} / William Temo not found.`);
  const williamForeman = employee.user?.foreman;
  if (!williamForeman) {
    throw new Error(`${employee.firstName} ${employee.lastName} does not have a linked foreman profile.`);
  }
  if (!employee.isActive) {
    console.warn(
      `${employee.firstName} ${employee.lastName} is inactive; continuing because this is a historical scan backfill.`,
    );
  }

  const sites = await prisma.site.findMany({
    where: { code: { in: Array.from(new Set(rows.map((row) => row.siteCode))) } },
    select: {
      id: true,
      code: true,
      name: true,
    },
  });

  const siteByCode = new Map(sites.map((site) => [site.code, site]));
  for (const siteCode of new Set(rows.map((row) => row.siteCode))) {
    if (!siteByCode.get(siteCode)) throw new Error(`Site ${siteCode} not found.`);
  }

  const existingScans = await prisma.attendanceScan.findMany({
    where: {
      employeeId: employee.id,
      workDate: {
        gte: dateUTC("2026-06-20"),
        lte: dateUTC("2026-07-03"),
      },
    },
    select: {
      id: true,
      workDate: true,
      site: { select: { code: true, name: true } },
      siteDay: {
        select: { foreman: { select: { user: { select: { name: true } } } } },
      },
      manualReason: true,
    },
    orderBy: { workDate: "asc" },
  });

  const existingByDate = new Map(
    existingScans.map((scan) => [toISODate(scan.workDate), scan]),
  );

  console.log(
    `${apply ? "Applying" : "Previewing"} ${rows.length} scans for ${employee.firstName} ${employee.lastName} (${employee.qrCodeValue}) as foreman ${williamForeman.user.name}`,
  );

  const planned = rows.map((row) => {
    const site = siteByCode.get(row.siteCode)!;
    const existing = existingByDate.get(row.workDate);
    return {
      ...row,
      site,
      foreman: williamForeman,
      existing,
    };
  });

  for (const row of planned) {
    const status = row.existing
      ? `SKIP existing scan at ${row.existing.site.code} ${row.existing.site.name}`
      : "CREATE";
    console.log(
      `${row.workDate} ${row.site.code} ${row.site.name} - ${row.foreman.user.name}: ${status}`,
    );
  }

  if (!apply) return;

  let created = 0;
  let skipped = 0;
  await prisma.$transaction(
    async (tx) => {
      for (const row of planned) {
        if (row.existing) {
          skipped += 1;
          continue;
        }

        const workDate = dateUTC(row.workDate);
        const rateResult = await computeDayRateAtScan({
          employeeId: employee.id,
          foremanId: row.foreman.id,
          siteId: row.site.id,
          workDate,
        });

        const siteDay =
          (await tx.siteDay.findFirst({
            where: {
              siteId: row.site.id,
              foremanId: row.foreman.id,
              workDate,
            },
            select: { id: true },
          })) ??
          (await tx.siteDay.create({
            data: {
              site: { connect: { id: row.site.id } },
              foreman: { connect: { id: row.foreman.id } },
              workDate,
            },
            select: { id: true },
          }));

        await tx.attendanceScan.create({
          data: {
            siteDay: { connect: { id: siteDay.id } },
            employee: { connect: { id: employee.id } },
            workDate,
            site: { connect: { id: row.site.id } },
            dayRateAtScan: rateResult.dayRate,
            team: rateResult.team,
            qrPayload: employee.qrCodeValue,
            scanType: "MANUAL",
            manualReason: BATCH_REASON,
          },
        });
        created += 1;
      }
    },
    { timeout: 120000 },
  );

  console.log(`Created ${created} scans; skipped ${skipped} existing scans.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
