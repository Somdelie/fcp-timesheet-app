// prisma/seed-sello-hereford-attendance.ts
//
// Resync attendance for Sello Mmara at Hereford Complex (6710), Jul 7-9 2026.
// Deletes unapproved workers and creates/keeps only the approved roster.
//
// Preview:  pnpm tsx prisma/seed-sello-hereford-attendance.ts
// Apply:    pnpm tsx prisma/seed-sello-hereford-attendance.ts --apply

import { prisma } from "@/lib/prisma";

const FOREMAN_NAME = "Sello Mmara";
const FOREMAN_ID = process.env.FOREMAN_ID;
const SITE_CODE = "6710";
const SITE_NAME_FALLBACK = "HEREFORD";

const attendanceByDate = [
  {
    workDate: "2026-07-07",
    employees: ["Sello Mmara"],
  },
  {
    workDate: "2026-07-08",
    employees: ["Sello Mmara", "Bigboy Ncube", "Methembe Ndlovu"],
  },
  {
    workDate: "2026-07-09",
    employees: ["Sello Mmara", "Bigboy Ncube", "Methembe Ndlovu"],
  },
] as const;

function dateUTC(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

function normalizeName(input: string) {
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
  return prisma.employee.findFirst({
    where: {
      firstName: { equals: firstName, mode: "insensitive" },
      lastName: { equals: lastName, mode: "insensitive" },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      qrCodeValue: true,
    },
  });
}

async function main() {
  const APPLY = process.argv.includes("--apply");
  let created = 0;
  let deleted = 0;
  let skipped = 0;

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
    throw new Error(
      `Foreman not found. ${FOREMAN_ID ? `ID: ${FOREMAN_ID}` : `Name: "${FOREMAN_NAME}"`}`,
    );
  }

  const targetSite =
    sites.find((s) => s.code === SITE_CODE) ??
    sites.find((s) =>
      normalizeName(s.name).includes(normalizeName(SITE_NAME_FALLBACK)),
    );

  if (!targetSite) {
    throw new Error(
      `Site not found for code ${SITE_CODE} / name ${SITE_NAME_FALLBACK}.`,
    );
  }

  console.log(
    `\nResyncing attendance for foreman: ${targetForeman.user?.name ?? FOREMAN_NAME}`,
  );
  console.log(`Site: ${targetSite.code ?? "NO-CODE"} - ${targetSite.name}`);
  console.log(`Date range: 2026-07-07 → 2026-07-09`);
  console.log("=".repeat(72));

  for (const day of attendanceByDate) {
    const workDateObj = dateUTC(day.workDate);

    let siteDay = await prisma.siteDay.findFirst({
      where: {
        siteId: targetSite.id,
        foremanId: targetForeman.id,
        workDate: workDateObj,
      },
      select: { id: true },
    });

    if (!siteDay) {
      const otherSiteDay = await prisma.siteDay.findFirst({
        where: { siteId: targetSite.id, workDate: workDateObj },
        select: { id: true, foremanId: true },
      });

      if (!otherSiteDay) {
        siteDay = await prisma.siteDay.create({
          data: {
            siteId: targetSite.id,
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

    if (!siteDay) {
      throw new Error(
        `Failed to resolve SiteDay for ${targetSite.code} on ${day.workDate}`,
      );
    }

    console.log(`\n${day.workDate}`);

    // Resolve approved employees
    const approvedEmployees = [];
    for (const fullName of day.employees) {
      const employee = await findEmployee(fullName);
      if (!employee) {
        throw new Error(`Employee not found: ${fullName}`);
      }
      approvedEmployees.push(employee);
    }

    const approvedEmployeeIds = approvedEmployees.map((e) => e.id);

    // Delete incorrect scans
    const incorrectScans = await prisma.attendanceScan.findMany({
      where: {
        siteDayId: siteDay.id,
        employeeId: { notIn: approvedEmployeeIds },
      },
      include: {
        employee: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    for (const scan of incorrectScans) {
      console.log(
        `[${day.workDate}] DELETE → ${scan.employee.firstName} ${scan.employee.lastName}`,
      );
      if (APPLY) {
        await prisma.attendanceScan.delete({ where: { id: scan.id } });
      }
      deleted++;
    }

    // Create/keep approved scans
    for (const employee of approvedEmployees) {
      const existingScan = await prisma.attendanceScan.findFirst({
        where: { siteDayId: siteDay.id, employeeId: employee.id },
        select: { id: true },
      });

      if (existingScan) {
        console.log(
          `[${day.workDate}] KEEP → ${employee.firstName} ${employee.lastName}`,
        );
        skipped++;
        continue;
      }

      console.log(
        `[${day.workDate}] CREATE → ${employee.firstName} ${employee.lastName}`,
      );

      if (APPLY) {
        await prisma.attendanceScan.create({
          data: {
            siteDayId: siteDay.id,
            employeeId: employee.id,
            workDate: workDateObj,
            siteId: targetSite.id,
            dayRateAtScan: 0,
            qrPayload: employee.qrCodeValue!,
            scanType: "REGULAR",
            scannedAt: new Date(`${day.workDate}T09:00:00+02:00`),
          },
        });
      }
      created++;
    }
  }

  console.log("\n" + "=".repeat(72));
  if (APPLY) {
    console.log(
      `Applied: ${created} created, ${deleted} deleted, ${skipped} kept.`,
    );
  } else {
    console.log(
      `Preview: ${created} would be created, ${deleted} would be deleted, ${skipped} would be kept. Add --apply to execute.`,
    );
  }
}

main()
  .catch((error) => {
    console.error("Sello Hereford attendance seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
