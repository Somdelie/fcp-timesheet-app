import { prisma } from "../lib/prisma";
import { computeDayRateAtScan } from "../lib/employeeDayRate";

const EMPLOYEE_FIRST = "Nhlalala";
const EMPLOYEE_LAST = "Sibisi";
const FROM_SITE_CODE = "6777";
const TO_SITE_CODE = "6343";
const TO_FOREMAN_NAME = "Zwelithini Ndlovu";
const MOVE_REASON =
  "Moved from 6777 THE INGRESS 2026 to 6343 GOSCOR FIRE DAMAGE under Zwelithini Ndlovu";

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function main() {
  const apply = process.argv.includes("--apply");

  const [employee, fromSite, toSite, toForeman] = await Promise.all([
    prisma.employee.findFirst({
      where: {
        firstName: { equals: EMPLOYEE_FIRST, mode: "insensitive" },
        lastName: { equals: EMPLOYEE_LAST, mode: "insensitive" },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        qrCodeValue: true,
        isActive: true,
      },
    }),
    prisma.site.findUnique({
      where: { code: FROM_SITE_CODE },
      select: { id: true, code: true, name: true },
    }),
    prisma.site.findUnique({
      where: { code: TO_SITE_CODE },
      select: { id: true, code: true, name: true },
    }),
    prisma.foreman.findFirst({
      where: { user: { name: { equals: TO_FOREMAN_NAME, mode: "insensitive" } } },
      select: { id: true, user: { select: { name: true } } },
    }),
  ]);

  if (!employee) throw new Error(`${EMPLOYEE_FIRST} ${EMPLOYEE_LAST} not found.`);
  if (!fromSite) throw new Error(`Site ${FROM_SITE_CODE} not found.`);
  if (!toSite) throw new Error(`Site ${TO_SITE_CODE} not found.`);
  if (!toForeman) throw new Error(`Foreman ${TO_FOREMAN_NAME} not found.`);

  const scans = await prisma.attendanceScan.findMany({
    where: {
      employeeId: employee.id,
      siteId: fromSite.id,
    },
    select: {
      id: true,
      workDate: true,
      siteId: true,
      siteDayId: true,
      dayRateAtScan: true,
      team: true,
      scanType: true,
      manualReason: true,
      siteDay: {
        select: {
          id: true,
          foreman: { select: { id: true, user: { select: { name: true } } } },
          site: { select: { code: true, name: true } },
        },
      },
    },
    orderBy: { workDate: "asc" },
  });

  console.log(
    `${apply ? "Applying" : "Previewing"} move for ${employee.firstName} ${employee.lastName} (${employee.qrCodeValue})`,
  );
  console.log(
    `${fromSite.code} ${fromSite.name} -> ${toSite.code} ${toSite.name}, foreman ${toForeman.user.name}`,
  );

  if (scans.length === 0) {
    console.log("No matching scans found to move.");
    return;
  }

  const existingDestination = await prisma.attendanceScan.findMany({
    where: {
      employeeId: employee.id,
      siteId: toSite.id,
      workDate: { in: scans.map((scan) => scan.workDate) },
    },
    select: {
      id: true,
      workDate: true,
      site: { select: { code: true, name: true } },
    },
    orderBy: { workDate: "asc" },
  });
  if (existingDestination.length > 0) {
    console.log("Destination already has scans for these dates:");
    for (const scan of existingDestination) {
      console.log(`${iso(scan.workDate)} ${scan.site.code} ${scan.site.name}`);
    }
    throw new Error("Refusing to move because destination scans already exist.");
  }

  for (const scan of scans) {
    console.log(
      `${iso(scan.workDate)} ${scan.siteDay.site.code} ${scan.siteDay.site.name} / ${scan.siteDay.foreman.user.name} -> ${toSite.code} ${toSite.name} / ${toForeman.user.name}`,
    );
  }

  if (!apply) return;

  await prisma.$transaction(
    async (tx) => {
      for (const scan of scans) {
        const rateResult = await computeDayRateAtScan({
          employeeId: employee.id,
          foremanId: toForeman.id,
          siteId: toSite.id,
          workDate: scan.workDate,
        });

        const destinationSiteDay =
          (await tx.siteDay.findFirst({
            where: {
              siteId: toSite.id,
              foremanId: toForeman.id,
              workDate: scan.workDate,
            },
            select: { id: true },
          })) ??
          (await tx.siteDay.create({
            data: {
              site: { connect: { id: toSite.id } },
              foreman: { connect: { id: toForeman.id } },
              workDate: scan.workDate,
            },
            select: { id: true },
          }));

        await tx.attendanceScan.update({
          where: { id: scan.id },
          data: {
            site: { connect: { id: toSite.id } },
            siteDay: { connect: { id: destinationSiteDay.id } },
            dayRateAtScan: rateResult.dayRate,
            team: rateResult.team,
            manualReason: scan.manualReason
              ? `${scan.manualReason}; ${MOVE_REASON}`
              : MOVE_REASON,
          },
        });

        const remainingScansOnSourceDay = await tx.attendanceScan.count({
          where: { siteDayId: scan.siteDayId },
        });
        if (remainingScansOnSourceDay === 0) {
          await tx.siteDay.delete({ where: { id: scan.siteDayId } });
        }
      }
    },
    { timeout: 120000 },
  );

  console.log(`Moved ${scans.length} scans.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
