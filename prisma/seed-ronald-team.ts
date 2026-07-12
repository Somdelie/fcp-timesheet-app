// prisma/seed-ronald-team.ts
//
// Seed attendance for RONALD MAFHARA's team (Jul 4-10 2026).
// Two sites: 6606 (INDUS MENLYN) and 6749 (10 ARABIAN 2026)
//
// Preview:  pnpm tsx prisma/seed-ronald-team.ts
// Apply:    pnpm tsx prisma/seed-ronald-team.ts --apply

import { prisma } from "@/lib/prisma";

const FOREMAN_NAME = "Ronald Mafhara";
const FOREMAN_ID = process.env.FOREMAN_ID;

// Sites used: 6606 (INDUS MENLYN) and 6749 (10 ARABIAN 2026)
const SITES = {
  MENLYN: { code: "6606", pattern: "INDUS MENLYN" },
  ARABIAN: { code: "6749", pattern: "10 ARABIAN" },
};

const attendanceByDateSite: Array<{
  workDate: string;
  siteCode: string;
  employees: string[];
}> = [
  {
    workDate: "2026-07-04",
    siteCode: "6606",
    employees: ["Ronald Mafhara", "Mafhara Events", "Mathoma avhatendi"],
  },
  {
    workDate: "2026-07-06",
    siteCode: "6749",
    employees: ["Ndou ntakuseni", "Mathoma avhatendi"],
  },
  {
    workDate: "2026-07-06",
    siteCode: "6606",
    employees: [
      "Mahlomola Monene",
      "Molekwa Richard Maposa",
      "Ronald Mafhara",
      "Brahm Sekgobela",
    ],
  },
  {
    workDate: "2026-07-07",
    siteCode: "6606",
    employees: [
      "Ronald Mafhara",
      "Brahm Sekgobela",
      "Mohale Sonty",
      "Mahlomola Monene",
    ],
  },
  {
    workDate: "2026-07-08",
    siteCode: "6749",
    employees: ["Ronald Mafhara", "Molekwa Richard Maposa"],
  },
  {
    workDate: "2026-07-09",
    siteCode: "6749",
    employees: ["Ronald Mafhara", "Molekwa Richard Maposa"],
  },
  {
    workDate: "2026-07-10",
    siteCode: "6749",
    employees: ["Ronald Mafhara", "Molekwa Richard Maposa"],
  },
];

function dateUTC(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

function normalizeName(input: string): string {
  return String(input ?? "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

async function findEmployee(fullName: string) {
  const { firstName, lastName } = parseName(fullName);
  const emp = await prisma.employee.findFirst({
    where: {
      firstName: { equals: firstName, mode: "insensitive" },
      lastName: { equals: lastName, mode: "insensitive" },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      qrCodeValue: true,
      defaultDayRate: true,
    },
  });

  if (!emp) {
    console.log(`    ⚠ Employee not found: "${fullName}" — skipping this scan`);
  }

  return emp;
}

async function main() {
  const APPLY = process.argv.includes("--apply");
  let created = 0;
  let skipped = 0;
  let notFound = 0;
  let deleted = 0;

  const [foremen, sites] = await Promise.all([
    prisma.foreman.findMany({
      select: { id: true, user: { select: { name: true } } },
    }),
    prisma.site.findMany({
      select: { id: true, code: true, name: true },
    }),
  ]);

  const targetForeman = FOREMAN_ID
    ? await prisma.foreman.findUnique({
        where: { id: FOREMAN_ID },
        select: { id: true, user: { select: { name: true } } },
      })
    : foremen.find(
        (f) =>
          normalizeName(f.user?.name ?? "") === normalizeName(FOREMAN_NAME),
      );

  if (!targetForeman) {
    throw new Error(`Foreman not found: "${FOREMAN_ID ?? FOREMAN_NAME}"`);
  }

  const menlyn = sites.find((site) => site.code === SITES.MENLYN.code);
  if (!menlyn) {
    throw new Error("Site 6606 (INDUS MENLYN) not found");
  }

  const arabian = sites.find((site) => site.code === SITES.ARABIAN.code);
  if (!arabian) {
    throw new Error("Site 6749 (10 ARABIAN 2026) not found");
  }

  const siteMap: Record<string, { id: string; name: string }> = {
    "6606": { id: menlyn.id, name: menlyn.name },
    "6749": { id: arabian.id, name: arabian.name },
  };

  console.log(`\nForeman: ${targetForeman.user?.name ?? FOREMAN_NAME}`);
  console.log(`Sites: 6606 (${menlyn.name}), 6749 (${arabian.name})`);
  console.log("=".repeat(72));

  for (const entry of attendanceByDateSite) {
    const { workDate, siteCode, employees } = entry;
    const site = siteMap[siteCode];
    if (!site) throw new Error(`Site ${siteCode} not found`);

    const workDateObj = dateUTC(workDate);

    console.log(`\n${workDate} @ ${site.name}`);

    // Resolve or create SiteDay
    let siteDay = await prisma.siteDay.findFirst({
      where: {
        siteId: site.id,
        foremanId: targetForeman.id,
        workDate: workDateObj,
      },
      select: { id: true },
    });

    if (!siteDay) {
      const otherSiteDay = await prisma.siteDay.findFirst({
        where: { siteId: site.id, workDate: workDateObj },
        select: { id: true, foremanId: true },
      });

      if (!otherSiteDay) {
        siteDay = await prisma.siteDay.create({
          data: {
            siteId: site.id,
            foremanId: targetForeman.id,
            workDate: workDateObj,
          },
          select: { id: true },
        });
      } else if (otherSiteDay.foremanId !== targetForeman.id) {
        siteDay = await prisma.siteDay.update({
          where: { id: otherSiteDay.id },
          data: { foremanId: targetForeman.id },
          select: { id: true },
        });
      } else {
        siteDay = { id: otherSiteDay.id };
      }
    }

    // Process employees for this date/site
    const approvedEmployees = [];

    for (const fullName of employees) {
      const emp = await findEmployee(fullName);

      if (!emp) {
        notFound++;
        continue;
      }

      approvedEmployees.push(emp);
    }

    if (approvedEmployees.length !== employees.length) {
      console.log(
        "  ⚠ Not resyncing this day because one or more employees were not found.",
      );
      continue;
    }

    const approvedEmployeeIds = approvedEmployees.map((emp) => emp.id);

    const incorrectScans = await prisma.attendanceScan.findMany({
      where: {
        siteDayId: siteDay.id,
        employeeId: {
          notIn: approvedEmployeeIds,
        },
      },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    for (const scan of incorrectScans) {
      console.log(
        `  DELETE → ${scan.employee.firstName} ${scan.employee.lastName}`,
      );

      if (APPLY) {
        await prisma.attendanceScan.delete({
          where: {
            id: scan.id,
          },
        });
      }

      deleted++;
    }

    for (const emp of approvedEmployees) {
      const existing = await prisma.attendanceScan.findFirst({
        where: {
          employeeId: emp.id,
          workDate: workDateObj,
        },
        select: {
          id: true,
          siteDayId: true,
          siteId: true,
        },
      });

      if (existing) {
        // If already exists on this siteDay, keep it
        if (existing.siteDayId === siteDay.id) {
          console.log(`  KEEP → ${emp.firstName} ${emp.lastName}`);
          skipped++;
        } else {
          // Employee already on a DIFFERENT site this day - delete the old one and create new
          console.log(
            `  MOVE → ${emp.firstName} ${emp.lastName} (from different site)`,
          );

          if (APPLY) {
            await prisma.attendanceScan.delete({
              where: {
                id: existing.id,
              },
            });

            await prisma.attendanceScan.create({
              data: {
                siteDayId: siteDay.id,
                employeeId: emp.id,
                workDate: workDateObj,
                siteId: site.id,
                dayRateAtScan: emp.defaultDayRate ?? 0,
                qrPayload: emp.qrCodeValue,
                scanType: "REGULAR",
                scannedAt: new Date(`${workDate}T09:00:00+02:00`),
              },
            });
          }

          created++;
          deleted++;
        }
        continue;
      }

      console.log(`  CREATE → ${emp.firstName} ${emp.lastName}`);

      if (APPLY) {
        if (!emp.qrCodeValue) {
          throw new Error(`${emp.firstName} ${emp.lastName} has no QR code.`);
        }

        await prisma.attendanceScan.create({
          data: {
            siteDayId: siteDay.id,
            employeeId: emp.id,
            workDate: workDateObj,
            siteId: site.id,
            dayRateAtScan: emp.defaultDayRate ?? 0,
            qrPayload: emp.qrCodeValue,
            scanType: "REGULAR",
            scannedAt: new Date(`${workDate}T09:00:00+02:00`),
          },
        });
      }

      created++;
    }
  }

  console.log("\n" + "=".repeat(72));
  if (APPLY) {
    console.log(
      `Applied: ${created} created, ${deleted} deleted, ` +
        `${skipped} kept, ${notFound} not found.`,
    );
  } else {
    console.log(
      `Preview: ${created} to create, ${deleted} to delete, ` +
        `${skipped} to keep, ${notFound} not found. ` +
        `Add --apply to execute.`,
    );
  }
}

main()
  .catch((error) => {
    console.error("Ronald team seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
