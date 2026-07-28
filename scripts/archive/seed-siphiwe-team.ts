// prisma/seed-siphiwe-team.ts
//
// Seed attendance for SIPHIWE NGOMANI's team (Jul 6-9 2026).
//
// Usage:
//   Preview:  SITE_CODE=XXXX pnpm tsx prisma/seed-siphiwe-team.ts
//   Apply:    SITE_CODE=XXXX pnpm tsx prisma/seed-siphiwe-team.ts --apply
//
// Notes:
// - Set SITE_CODE to the correct site code before running.
// - Script performs exact resync for each day: creates missing scans,
//   keeps correct scans, and deletes incorrect scans on that site-day.
// - If a worker already has a scan on a different site for the same date,
//   it moves the scan to this site.

import { prisma } from "@/lib/prisma";

const FOREMAN_NAME = "Siphiwe Ngomani";

const FOREMAN_NAME_ALIASES = [
  "Siphiwe Ngomani",
  "Sphiwe Ngomani",
  "Siphiwe Ngomane",
  "SIPHIWE NGO",
];

const FOREMAN_ID = process.env.FOREMAN_ID;
const SITE_CODE = process.env.SITE_CODE;

const attendanceByDate: Array<{
  workDate: string;
  employees: string[];
}> = [
  {
    workDate: "2026-07-06",
    employees: ["Siphiwe Ngomani", "Godknows Msebele", "Smile Moyo"],
  },
  {
    workDate: "2026-07-07",
    employees: [
      "Siphiwe Ngomani",
      "Godknows Msebele",
      "Smile Moyo",
      "Thabo Seko",
    ],
  },
  {
    workDate: "2026-07-08",
    employees: [
      "Siphiwe Ngomani",
      "Godknows Msebele",
      "Smile Moyo",
      "Thabo Seko",
    ],
  },
  {
    workDate: "2026-07-09",
    employees: [
      "Siphiwe Ngomani",
      "Godknows Msebele",
      "Smile Moyo",
      "Thabo Seko",
    ],
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
      ...(lastName
        ? { lastName: { equals: lastName, mode: "insensitive" } }
        : {}),
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
    console.log(`    ⚠ Employee not found: "${fullName}"`);
  }

  return emp;
}

const TRASH_TTL_DAYS = 14;

async function trashAndDeleteScan(
  scan: {
    id: string;
    employeeId: string;
    siteDayId: string;
    siteId: string;
    workDate: Date;
    scannedAt: Date;
    scannedOutAt: Date | null;
    direction: string;
    scanType: string;
    dayRateAtScan: { toString(): string };
    team: string | null;
    overtimeType: string;
    manualReason: string | null;
    transferredFromSiteId: string | null;
    transferredFromScanId: string | null;
    transferredAt: Date | null;
    qrPayload: string | null;
    employee: { firstName: string; lastName: string };
  },
  label: string,
) {
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + TRASH_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  await prisma.trashItem.create({
    data: {
      entityType: "attendance-scan",
      entityId: scan.id,
      label,
      description: `Deleted by seed-siphiwe-team on ${now.toISOString().slice(0, 10)}`,
      metadata: {
        attendanceScan: {
          id: scan.id,
          employeeId: scan.employeeId,
          employeeName: `${scan.employee.firstName} ${scan.employee.lastName}`,
          siteId: scan.siteId,
          siteDayId: scan.siteDayId,
          workDateISO: scan.workDate.toISOString(),
          scannedAtISO: scan.scannedAt.toISOString(),
          scannedOutAtISO: scan.scannedOutAt?.toISOString() ?? null,
          direction: scan.direction,
          scanType: scan.scanType,
          dayRateAtScan: scan.dayRateAtScan.toString(),
          team: scan.team,
          overtimeType: scan.overtimeType,
          manualReason: scan.manualReason,
          transferredFromSiteId: scan.transferredFromSiteId,
          transferredFromScanId: scan.transferredFromScanId,
          transferredAtISO: scan.transferredAt?.toISOString() ?? null,
        },
      },
      expiresAt,
    },
  });

  await prisma.attendanceScan.delete({ where: { id: scan.id } });
}

async function main() {
  const APPLY = process.argv.includes("--apply");

  if (!SITE_CODE) {
    throw new Error(
      "Missing SITE_CODE. Example: SITE_CODE=6749 pnpm tsx prisma/seed-siphiwe-team.ts",
    );
  }

  let created = 0;
  let deleted = 0;
  let skipped = 0;
  let notFound = 0;

  const [foremen, sites] = await Promise.all([
    prisma.foreman.findMany({
      select: { id: true, user: { select: { name: true } } },
    }),
    prisma.site.findMany({
      select: { id: true, code: true, name: true },
    }),
  ]);

  const normalizedForemanNames = FOREMAN_NAME_ALIASES.map(normalizeName);

  let targetForeman = FOREMAN_ID
    ? await prisma.foreman.findUnique({
        where: {
          id: FOREMAN_ID,
        },
        select: {
          id: true,
          user: {
            select: {
              name: true,
            },
          },
        },
      })
    : foremen.find((foreman) =>
        normalizedForemanNames.includes(
          normalizeName(foreman.user?.name ?? ""),
        ),
      );

  if (!targetForeman) {
    const users = await prisma.user.findMany({
      where: {
        OR: FOREMAN_NAME_ALIASES.map((name) => ({
          name: {
            equals: name,
            mode: "insensitive" as const,
          },
        })),
      },
      select: {
        id: true,
        name: true,
      },
    });

    const user = users[0];
    if (user) {
      console.log(
        `Found matching user (${user.name}) but no linked Foreman row. ` +
          `Set FOREMAN_ID or run merge/link first.`,
      );
    }
  }

  if (!targetForeman) {
    throw new Error(
      `Foreman not found: "${FOREMAN_ID ?? FOREMAN_NAME}". ` +
        `Create/link a User + Foreman first, or pass FOREMAN_ID.`,
    );
  }

  const site = sites.find((s) => s.code === SITE_CODE);
  if (!site) {
    throw new Error(`Site not found for SITE_CODE=${SITE_CODE}`);
  }

  console.log(`\nForeman: ${targetForeman.user?.name ?? FOREMAN_NAME}`);
  console.log(`Site: ${site.code} (${site.name})`);
  console.log("=".repeat(72));

  for (const entry of attendanceByDate) {
    const { workDate, employees } = entry;
    const workDateObj = dateUTC(workDate);

    console.log(`\n${workDate} @ ${site.name}`);

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
      select: {
        id: true,
        employeeId: true,
        siteDayId: true,
        siteId: true,
        workDate: true,
        scannedAt: true,
        scannedOutAt: true,
        direction: true,
        scanType: true,
        dayRateAtScan: true,
        team: true,
        overtimeType: true,
        manualReason: true,
        transferredFromSiteId: true,
        transferredFromScanId: true,
        transferredAt: true,
        qrPayload: true,
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
        `  DELETE → ${scan.employee.firstName} ${scan.employee.lastName} (→ recycle bin)`,
      );

      if (APPLY) {
        await trashAndDeleteScan(
          scan,
          `${scan.employee.firstName} ${scan.employee.lastName} — ${workDate} @ ${site.name}`,
        );
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
          employeeId: true,
          siteDayId: true,
          siteId: true,
          workDate: true,
          scannedAt: true,
          scannedOutAt: true,
          direction: true,
          scanType: true,
          dayRateAtScan: true,
          team: true,
          overtimeType: true,
          manualReason: true,
          transferredFromSiteId: true,
          transferredFromScanId: true,
          transferredAt: true,
          qrPayload: true,
        },
      });

      if (existing) {
        if (existing.siteDayId === siteDay.id) {
          console.log(`  KEEP → ${emp.firstName} ${emp.lastName}`);
          skipped++;
        } else {
          console.log(
            `  MOVE → ${emp.firstName} ${emp.lastName} (from different site)`,
          );

          if (APPLY) {
            await trashAndDeleteScan(
              {
                ...existing,
                employee: { firstName: emp.firstName, lastName: emp.lastName },
              },
              `${emp.firstName} ${emp.lastName} — ${workDate} @ ${site.name} (moved)`,
            );

            if (!emp.qrCodeValue) {
              throw new Error(
                `${emp.firstName} ${emp.lastName} has no QR code.`,
              );
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
        `${skipped} to keep, ${notFound} not found. Add --apply to execute.`,
    );
  }
}

main()
  .catch((error) => {
    console.error("Siphiwe team seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
