// prisma/seed-limukani-missing-days.ts
//
// Adds only Limukani Ndlovu's missing attendance for 4–7 July 2026.
//
// It does NOT:
// - delete existing attendance;
// - move attendance between sites;
// - change anything from 8 July onward;
// - overwrite existing scans.
//
// Required:
//   TRILOGY_SITE_CODE
//
// Optional:
//   FOREMAN_ID
//   INDUS_SITE_CODE (defaults to 6606)
//
// PowerShell preview:
//   $env:TRILOGY_SITE_CODE="YOUR_TRILOGY_CODE"
//   pnpm tsx prisma/seed-limukani-missing-days.ts
//
// PowerShell apply:
//   pnpm tsx prisma/seed-limukani-missing-days.ts --apply

import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--apply");

const FOREMAN_ID = process.env.FOREMAN_ID;
const FOREMAN_NAME = "Limukani Ndlovu";

const INDUS_SITE_CODE = "6606";
const TRILOGY_SITE_CODE = "6005";

type AttendanceEntry = {
  workDate: string;
  siteCode: string;
  employees: string[];
};

const attendanceByDateSite: AttendanceEntry[] = [
  // ------------------------------------------------------------
  // 6606 · INDUS MENLYN
  // ------------------------------------------------------------
  {
    workDate: "2026-07-04",
    siteCode: INDUS_SITE_CODE,
    employees: [
      "Tendai Ndlamini",
      "Priority Moyo",
      "Fortune Ndlovu",
      "Peter Mojelele",
      "Steve Motsushi",
      "Brighton Sibanda",
      "Mlandulwa Ngwenya",
      "Given Shiburi",
    ],
  },
  {
    workDate: "2026-07-05",
    siteCode: INDUS_SITE_CODE,
    employees: [
      "Tendai Ndlamini",
      "Ernest Ndlovu",
      "Fortune Ndlovu",
      "Peter Mojelele",
      "Steve Motsushi",
      "Brighton Sibanda",
      "Mlandulwa Ngwenya",
    ],
  },
  {
    workDate: "2026-07-06",
    siteCode: INDUS_SITE_CODE,
    employees: [
      "Tendai Ndlamini",
      "Ernest Ndlovu",
      "Fortune Ndlovu",
      "Peter Mojelele",
      "Steve Motsushi",
      "Given Shiburi",
      "Thabo Mboweni",
      "Priority Moyo",
    ],
  },
  {
    workDate: "2026-07-07",
    siteCode: INDUS_SITE_CODE,
    employees: [
      "Limukani Ndlovu",
      "Tendai Ndlamini",
      "Ernest Ndlovu",
      "Fortune Ndlovu",
      "Peter Mojelele",
      "Steve Motsushi",
      "Priority Moyo",
      "Thabo Mboweni",
      "Given Shiburi",
    ],
  },

  // ------------------------------------------------------------
  // TRILOGY PHASE 2
  // ------------------------------------------------------------
  {
    workDate: "2026-07-04",
    siteCode: TRILOGY_SITE_CODE ?? "",
    employees: ["Nkanyiso Ndlovu", "Shepherd Manyise"],
  },
  {
    workDate: "2026-07-05",
    siteCode: TRILOGY_SITE_CODE ?? "",
    employees: ["Shepherd Manyise"],
  },
  {
    workDate: "2026-07-06",
    siteCode: TRILOGY_SITE_CODE ?? "",
    employees: ["Nkanyiso Ndlovu", "Shepherd Manyise"],
  },
  {
    workDate: "2026-07-07",
    siteCode: TRILOGY_SITE_CODE ?? "",
    employees: ["Nkanyiso Ndlovu", "Shepherd Manyise"],
  },
];

function dateUTC(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function scanDate(isoDate: string): Date {
  return new Date(`${isoDate}T09:00:00+02:00`);
}

function normalizeName(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

/**
 * Aliases cover names/spellings shown in the submitted sheet
 * and shortened names displayed in the application.
 */
const employeeAliases: Record<string, string[]> = {
  "Limukani Ndlovu": ["Limukani ndlovu"],
  "Tendai Ndlamini": ["Tendai Ndlamini", "Tendai Ndlami"],
  "Priority Moyo": ["Priority Moyo"],
  "Fortune Ndlovu": ["Fortune Ndlovu", "Fortun Ndlovu"],
  "Peter Mojelele": ["Peter Mojelele", "Peter Mojel", "Peter Mojelеле"],
  "Steve Motsushi": ["Steve Motsushi", "Steve Motsush"],
  "Brighton Sibanda": ["Brighton Sibanda", "Brighton Si"],
  "Mlandulwa Ngwenya": ["Mlandulwa Ngwenya"],
  "Given Shiburi": ["Given Shiburi"],
  "Ernest Ndlovu": ["Ernest Ndlovu"],
  "Thabo Mboweni": ["Thabo Mboweni"],
  "Nkanyiso Ndlovu": ["Nkanyiso Ndlovu"],
  "Shepherd Manyise": ["Shepherd Manyise", "Shepherd M"],
};

async function findEmployee(canonicalName: string) {
  const possibleNames = [
    canonicalName,
    ...(employeeAliases[canonicalName] ?? []),
  ];

  const conditions = possibleNames.map((fullName) => {
    const { firstName, lastName } = splitName(fullName);

    return {
      AND: [
        {
          firstName: {
            equals: firstName,
            mode: "insensitive" as const,
          },
        },
        ...(lastName
          ? [
              {
                lastName: {
                  equals: lastName,
                  mode: "insensitive" as const,
                },
              },
            ]
          : []),
      ],
    };
  });

  const exactMatch = await prisma.employee.findFirst({
    where: {
      OR: conditions,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      qrCodeValue: true,
      defaultDayRate: true,
    },
  });

  if (exactMatch) {
    return exactMatch;
  }

  /*
   * Fallback for employee names displayed in shortened form,
   * such as "BRIGHTON SI" or "PETER MOJEL".
   */
  const { firstName, lastName } = splitName(canonicalName);

  return prisma.employee.findFirst({
    where: {
      firstName: {
        equals: firstName,
        mode: "insensitive",
      },
      ...(lastName
        ? {
            lastName: {
              startsWith: lastName.slice(0, Math.min(lastName.length, 5)),
              mode: "insensitive",
            },
          }
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
}

async function findForeman() {
  if (FOREMAN_ID) {
    return prisma.foreman.findUnique({
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
    });
  }

  const foremen = await prisma.foreman.findMany({
    select: {
      id: true,
      user: {
        select: {
          name: true,
        },
      },
    },
  });

  const aliases = ["Limukani Ndlovu", "Limukani ndlovu", "LIMUKANI NDLOVU"].map(
    normalizeName,
  );

  return (
    foremen.find((foreman) =>
      aliases.includes(normalizeName(foreman.user?.name ?? "")),
    ) ?? null
  );
}

async function getOrCreateSiteDay(args: {
  siteId: string;
  foremanId: string;
  workDate: Date;
}) {
  const existing = await prisma.siteDay.findFirst({
    where: {
      siteId: args.siteId,
      foremanId: args.foremanId,
      workDate: args.workDate,
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    return existing;
  }

  /*
   * Preview mode must not create database records.
   */
  if (!APPLY) {
    return null;
  }

  return prisma.siteDay.create({
    data: {
      siteId: args.siteId,
      foremanId: args.foremanId,
      workDate: args.workDate,
    },
    select: {
      id: true,
    },
  });
}

async function main() {
  if (!TRILOGY_SITE_CODE) {
    throw new Error(
      "Missing TRILOGY_SITE_CODE. " +
        'PowerShell example: $env:TRILOGY_SITE_CODE="YOUR_SITE_CODE"',
    );
  }

  const foreman = await findForeman();

  if (!foreman) {
    throw new Error(
      `Foreman not found: "${FOREMAN_ID ?? FOREMAN_NAME}". ` +
        "Pass FOREMAN_ID if the database name is different.",
    );
  }

  const requiredSiteCodes = [
    ...new Set(attendanceByDateSite.map((entry) => entry.siteCode)),
  ];

  const sites = await prisma.site.findMany({
    where: {
      code: {
        in: requiredSiteCodes,
      },
    },
    select: {
      id: true,
      code: true,
      name: true,
    },
  });

  const siteMap = new Map(
    sites.map((site) => [
      site.code,
      {
        id: site.id,
        code: site.code,
        name: site.name,
      },
    ]),
  );

  for (const siteCode of requiredSiteCodes) {
    if (!siteMap.has(siteCode)) {
      throw new Error(`Site not found for code ${siteCode}.`);
    }
  }

  let created = 0;
  let kept = 0;
  let existingElsewhere = 0;
  let employeeNotFound = 0;
  let missingQrCode = 0;
  let siteDaysToCreate = 0;

  console.log("");
  console.log(`Foreman: ${foreman.user?.name ?? FOREMAN_NAME}`);
  console.log("Mode:", APPLY ? "APPLY" : "PREVIEW");
  console.log("Seeding missing attendance only: 4–7 July 2026");
  console.log("No existing attendance will be deleted or moved.");
  console.log("=".repeat(78));

  for (const entry of attendanceByDateSite) {
    const site = siteMap.get(entry.siteCode);

    if (!site) {
      throw new Error(`Site ${entry.siteCode} was not loaded.`);
    }

    const workDate = dateUTC(entry.workDate);

    console.log("");
    console.log(`${entry.workDate} @ ${site.code} - ${site.name}`);

    let siteDay = await prisma.siteDay.findFirst({
      where: {
        siteId: site.id,
        foremanId: foreman.id,
        workDate,
      },
      select: {
        id: true,
      },
    });

    if (!siteDay) {
      console.log("  SITE DAY → will be created");

      siteDaysToCreate++;

      siteDay = await getOrCreateSiteDay({
        siteId: site.id,
        foremanId: foreman.id,
        workDate,
      });
    }

    for (const requestedName of entry.employees) {
      const employee = await findEmployee(requestedName);

      if (!employee) {
        console.log(`  NOT FOUND → ${requestedName}`);
        employeeNotFound++;
        continue;
      }

      const existingScan = await prisma.attendanceScan.findFirst({
        where: {
          employeeId: employee.id,
          workDate,
        },
        select: {
          id: true,
          siteId: true,
          siteDayId: true,
          site: {
            select: {
              code: true,
              name: true,
            },
          },
        },
      });

      if (existingScan) {
        if (existingScan.siteId === site.id) {
          console.log(`  KEEP → ${employee.firstName} ${employee.lastName}`);
          kept++;
        } else {
          console.log(
            `  SKIP → ${employee.firstName} ${employee.lastName} ` +
              `already has attendance at ` +
              `${existingScan.site?.code ?? "another site"} ` +
              `${existingScan.site?.name ?? ""}`,
          );

          existingElsewhere++;
        }

        continue;
      }

      if (!employee.qrCodeValue) {
        console.log(`  NO QR → ${employee.firstName} ${employee.lastName}`);

        missingQrCode++;
        continue;
      }

      console.log(`  CREATE → ${employee.firstName} ${employee.lastName}`);

      if (APPLY) {
        if (!siteDay) {
          throw new Error(
            `SiteDay could not be created for ${entry.workDate} at ${site.code}.`,
          );
        }

        await prisma.attendanceScan.create({
          data: {
            siteDayId: siteDay.id,
            employeeId: employee.id,
            workDate,
            siteId: site.id,
            dayRateAtScan: employee.defaultDayRate ?? 0,
            qrPayload: employee.qrCodeValue,
            scanType: "REGULAR",
            scannedAt: scanDate(entry.workDate),
          },
        });
      }

      created++;
    }
  }

  console.log("");
  console.log("=".repeat(78));

  if (APPLY) {
    console.log("Limukani missing-attendance seed applied.");
    console.log(`Created: ${created}`);
  } else {
    console.log("Preview completed. Nothing was changed.");
    console.log(`Would create: ${created}`);
    console.log(`SiteDays that may be created: ${siteDaysToCreate}`);
  }

  console.log(`Already correct and kept: ${kept}`);
  console.log(`Existing at another site and untouched: ${existingElsewhere}`);
  console.log(`Employees not found: ${employeeNotFound}`);
  console.log(`Employees without QR codes: ${missingQrCode}`);

  if (!APPLY) {
    console.log("");
    console.log("Add --apply to write the missing attendance.");
  }
}

main()
  .catch((error) => {
    console.error("Limukani missing-attendance seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
