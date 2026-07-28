// prisma/seed-fix-moment-team.ts
//
// Fix/add Moment Dube team's historical attendance for 4–9 July 2026.
//
// Correct sites:
//   6606 · INDUS MENLYN
//   6815 · HS PO 07640&41
//
// Known wrong historical sites:
//   6322 → should be 6606
//   6052 → should be 6815
//
// IMPORTANT:
// - 10 July 2026 onward is protected and will not be touched.
// - This script does not delete unrelated attendance.
// - Existing attendance on an unexpected site is reported and left untouched.
//
// Preview:
//   pnpm tsx prisma/seed-fix-moment-team.ts
//
// Apply:
//   pnpm tsx prisma/seed-fix-moment-team.ts --apply
//
// Optional:
//   $env:FOREMAN_ID="actual-foreman-id"

import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--apply");

const FOREMAN_NAME = "Moment Dube";
const FOREMAN_ID = process.env.FOREMAN_ID;

const HISTORICAL_START_DATE = "2026-07-04";
const HISTORICAL_END_DATE = "2026-07-09";

const SITE_CODES = {
  INDUS: "6606",
  HS_PO: "6815",

  // Historical records currently attached to these incorrect sites.
  WRONG_MENLYN_PLACE: "6322",
  WRONG_HATFIELD_SQUARE: "6052",
} as const;

type AttendanceEntry = {
  workDate: string;
  targetSiteCode: string;
  allowedSourceSiteCodes: string[];
  employees: string[];
};

const attendanceByDateSite: AttendanceEntry[] = [
  // ============================================================
  // 6815 · HS PO 07640&41
  // ============================================================
  {
    workDate: "2026-07-06",
    targetSiteCode: SITE_CODES.HS_PO,
    allowedSourceSiteCodes: [
      SITE_CODES.INDUS,
      SITE_CODES.WRONG_HATFIELD_SQUARE,
    ],
    employees: ["Akani Mnisi", "Thomas Mathebula"],
  },
  {
    workDate: "2026-07-07",
    targetSiteCode: SITE_CODES.HS_PO,
    allowedSourceSiteCodes: [
      SITE_CODES.INDUS,
      SITE_CODES.WRONG_HATFIELD_SQUARE,
    ],
    employees: ["Akani Mnisi", "Thomas Mathebula"],
  },
  {
    workDate: "2026-07-08",
    targetSiteCode: SITE_CODES.HS_PO,
    allowedSourceSiteCodes: [
      SITE_CODES.INDUS,
      SITE_CODES.WRONG_HATFIELD_SQUARE,
    ],
    employees: ["Akani Mnisi", "Thomas Mathebula", "Sbusiso Mahlangu"],
  },
  {
    workDate: "2026-07-09",
    targetSiteCode: SITE_CODES.HS_PO,
    allowedSourceSiteCodes: [
      SITE_CODES.INDUS,
      SITE_CODES.WRONG_HATFIELD_SQUARE,
    ],
    employees: ["Akani Mnisi", "Thomas Mathebula"],
  },

  // ============================================================
  // 6606 · INDUS MENLYN
  // ============================================================
  {
    workDate: "2026-07-04",
    targetSiteCode: SITE_CODES.INDUS,
    allowedSourceSiteCodes: [SITE_CODES.WRONG_MENLYN_PLACE],
    employees: [
      "Boikanyo Machaka",
      "Kamogelo Moteleng",
      "Tsabalala Tshiamo",
      "Khulumani Moyo",
      "Shadreck Mbewe",
    ],
  },
  {
    workDate: "2026-07-05",
    targetSiteCode: SITE_CODES.INDUS,
    allowedSourceSiteCodes: [SITE_CODES.WRONG_MENLYN_PLACE],
    employees: ["Kamogelo Moteleng"],
  },
  {
    workDate: "2026-07-06",
    targetSiteCode: SITE_CODES.INDUS,
    allowedSourceSiteCodes: [SITE_CODES.WRONG_MENLYN_PLACE],
    employees: [
      "Boikanyo Machaka",
      "Kamogelo Moteleng",
      "Tsabalala Tshiamo",
      "Shadreck Mbewe",
    ],
  },
  {
    workDate: "2026-07-07",
    targetSiteCode: SITE_CODES.INDUS,
    allowedSourceSiteCodes: [SITE_CODES.WRONG_MENLYN_PLACE],
    employees: [
      "Boikanyo Machaka",
      "Kamogelo Moteleng",
      "Tsabalala Tshiamo",
      "Khulumani Moyo",
    ],
  },
  {
    workDate: "2026-07-08",
    targetSiteCode: SITE_CODES.INDUS,
    allowedSourceSiteCodes: [SITE_CODES.WRONG_MENLYN_PLACE],
    employees: [
      "Boikanyo Machaka",
      "Kamogelo Moteleng",
      "Tsabalala Tshiamo",
      "Khulumani Moyo",
    ],
  },
  {
    workDate: "2026-07-09",
    targetSiteCode: SITE_CODES.INDUS,
    allowedSourceSiteCodes: [SITE_CODES.WRONG_MENLYN_PLACE],
    employees: ["Boikanyo Machaka", "Kamogelo Moteleng", "Tsabalala Tshiamo"],
  },

  // 10 July is intentionally excluded.
];

function dateUTC(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function scannedAt(isoDate: string): Date {
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

const employeeAliases: Record<string, string[]> = {
  "Akani Mnisi": ["Akani Mnisi"],

  "Thomas Mathebula": ["Thomas Mathebula", "Thomas Mat"],

  "Sbusiso Mahlangu": ["Sbusiso Mahlangu"],

  "Boikanyo Machaka": ["Boikanyo Machaka", "Boikanyo Ma"],

  "Kamogelo Moteleng": [
    "Kamogelo Moteleng",
    "Kamuhelo Moteong",
    "Kamogelo Moteleng",
  ],

  "Tsabalala Tshiamo": ["Tsabalala Tshiamo", "Tshiamo Tsabalala"],

  "Khulumani Moyo": ["Khulumani Moyo"],

  "Shadreck Mbewe": ["Shadreck Mbewe", "Shadreck M"],
};

type EmployeeResult = {
  id: string;
  firstName: string;
  lastName: string;
  qrCodeValue: string | null;
  defaultDayRate: number | string | null;
};

async function findEmployee(
  canonicalName: string,
): Promise<EmployeeResult | null> {
  const possibleNames = [
    canonicalName,
    ...(employeeAliases[canonicalName] ?? []),
  ];

  const exactConditions = possibleNames.map((name) => {
    const { firstName, lastName } = splitName(name);

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

  const exactEmployee = await prisma.employee.findFirst({
    where: {
      OR: exactConditions,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      qrCodeValue: true,
      defaultDayRate: true,
    },
  });

  if (exactEmployee) {
    return {
      ...exactEmployee,
      defaultDayRate: exactEmployee.defaultDayRate
        ? Number(exactEmployee.defaultDayRate)
        : null,
    };
  }

  /*
   * Conservative fallback for names displayed in shortened form,
   * such as "THOMAS MAT", "BOIKANYO MA" or "SHADRECK M".
   */
  const { firstName, lastName } = splitName(canonicalName);

  if (!firstName || !lastName) {
    return null;
  }

  const fallbackMatches = await prisma.employee.findMany({
    where: {
      firstName: {
        equals: firstName,
        mode: "insensitive",
      },
      lastName: {
        startsWith: lastName.slice(0, Math.min(lastName.length, 4)),
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      qrCodeValue: true,
      defaultDayRate: true,
    },
    take: 2,
  });

  if (fallbackMatches.length === 1) {
    const match = fallbackMatches[0];
    return {
      ...match,
      defaultDayRate: match.defaultDayRate
        ? Number(match.defaultDayRate)
        : null,
    };
  }

  if (fallbackMatches.length > 1) {
    console.log(
      `    ⚠ Multiple possible employee matches for "${canonicalName}"`,
    );
  }

  return null;
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

  const aliases = ["Moment Dube", "MOMENT DUBE"].map(normalizeName);

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

  return (
    foremen.find((foreman) =>
      aliases.includes(normalizeName(foreman.user?.name ?? "")),
    ) ?? null
  );
}

async function getTargetSiteDay(args: {
  siteId: string;
  siteCode: string;
  foremanId: string;
  workDate: Date;
  workDateText: string;
}) {
  const existingForMoment = await prisma.siteDay.findFirst({
    where: {
      siteId: args.siteId,
      foremanId: args.foremanId,
      workDate: args.workDate,
    },
    select: {
      id: true,
    },
  });

  if (existingForMoment) {
    return existingForMoment;
  }

  /*
   * Another foreman may already have a SiteDay at this site/date.
   * Leave their SiteDay untouched and create a separate one for Moment.
   */
  const otherForemanSiteDays = await prisma.siteDay.findMany({
    where: {
      siteId: args.siteId,
      workDate: args.workDate,
      NOT: {
        foremanId: args.foremanId,
      },
    },
    select: {
      id: true,
      foremanId: true,
    },
  });

  if (otherForemanSiteDays.length > 0) {
    console.log(
      `  INFO → ${args.siteCode} on ${args.workDateText} already has ` +
        `${otherForemanSiteDays.length} SiteDay(s) for another foreman. ` +
        `They will remain untouched.`,
    );
  }

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
  const foreman = await findForeman();

  if (!foreman) {
    throw new Error(
      `Moment Dube foreman record not found. ` +
        `Pass FOREMAN_ID if the user name differs.`,
    );
  }

  const requiredSiteCodes = [
    SITE_CODES.INDUS,
    SITE_CODES.HS_PO,
    SITE_CODES.WRONG_MENLYN_PLACE,
    SITE_CODES.WRONG_HATFIELD_SQUARE,
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

  for (const requiredCode of [SITE_CODES.INDUS, SITE_CODES.HS_PO]) {
    if (!siteMap.has(requiredCode)) {
      throw new Error(`Required target site not found: ${requiredCode}`);
    }
  }

  let created = 0;
  let moved = 0;
  let kept = 0;
  let notFound = 0;
  let missingQr = 0;
  let unexpectedSite = 0;
  let siteDaysToCreate = 0;

  console.log("");
  console.log(`Foreman: ${foreman.user?.name ?? FOREMAN_NAME}`);
  console.log(`Mode: ${APPLY ? "APPLY" : "PREVIEW"}`);
  console.log(
    `Protected dates: anything after ${HISTORICAL_END_DATE} is untouched.`,
  );
  console.log("=".repeat(80));

  for (const entry of attendanceByDateSite) {
    if (
      entry.workDate < HISTORICAL_START_DATE ||
      entry.workDate > HISTORICAL_END_DATE
    ) {
      console.log(`\nSKIP PROTECTED DATE → ${entry.workDate}`);
      continue;
    }

    const targetSite = siteMap.get(entry.targetSiteCode);

    if (!targetSite) {
      throw new Error(`Target site not found: ${entry.targetSiteCode}`);
    }

    const workDate = dateUTC(entry.workDate);

    console.log("");
    console.log(`${entry.workDate} @ ${targetSite.code} - ${targetSite.name}`);

    let targetSiteDay = await prisma.siteDay.findFirst({
      where: {
        siteId: targetSite.id,
        foremanId: foreman.id,
        workDate,
      },
      select: {
        id: true,
      },
    });

    if (!targetSiteDay) {
      console.log("  SITE DAY → will be created if required");
      siteDaysToCreate++;

      targetSiteDay = await getTargetSiteDay({
        siteId: targetSite.id,
        siteCode: targetSite.code ?? entry.targetSiteCode,
        foremanId: foreman.id,
        workDate,
        workDateText: entry.workDate,
      });
    }

    for (const requestedName of entry.employees) {
      const employee = await findEmployee(requestedName);

      if (!employee) {
        console.log(`  NOT FOUND → ${requestedName}`);
        notFound++;
        continue;
      }

      /*
       * Find the employee's scan for the date, regardless of site.
       */
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

      /*
       * Already correct.
       */
      if (existingScan?.siteId === targetSite.id) {
        console.log(`  KEEP → ${employee.firstName} ${employee.lastName}`);
        kept++;
        continue;
      }

      /*
       * Existing scan is at a different site.
       * Only move it when that source site is one of the explicitly
       * approved wrong site codes for this schedule entry.
       */
      if (existingScan) {
        const sourceSiteCode = existingScan.site?.code ?? "";

        if (!entry.allowedSourceSiteCodes.includes(sourceSiteCode)) {
          console.log(
            `  SKIP UNEXPECTED SITE → ` +
              `${employee.firstName} ${employee.lastName} is already at ` +
              `${sourceSiteCode || "unknown"} ` +
              `${existingScan.site?.name ?? ""}`,
          );

          unexpectedSite++;
          continue;
        }

        console.log(
          `  MOVE → ${employee.firstName} ${employee.lastName}: ` +
            `${sourceSiteCode} → ${targetSite.code}`,
        );

        if (APPLY) {
          if (!targetSiteDay) {
            throw new Error(
              `Target SiteDay missing for ${entry.workDate} ` +
                `at ${targetSite.code}.`,
            );
          }

          /*
           * Update the existing scan instead of delete/recreate.
           * This preserves the attendance record ID and related history.
           */
          await prisma.attendanceScan.update({
            where: {
              id: existingScan.id,
            },
            data: {
              siteId: targetSite.id,
              siteDayId: targetSiteDay.id,
            },
          });
        }

        moved++;
        continue;
      }

      /*
       * No scan exists for this employee/date, so create the missing one.
       */
      if (!employee.qrCodeValue) {
        console.log(`  NO QR → ${employee.firstName} ${employee.lastName}`);
        missingQr++;
        continue;
      }

      console.log(`  CREATE → ${employee.firstName} ${employee.lastName}`);

      if (APPLY) {
        if (!targetSiteDay) {
          throw new Error(
            `Target SiteDay missing for ${entry.workDate} ` +
              `at ${targetSite.code}.`,
          );
        }

        await prisma.attendanceScan.create({
          data: {
            siteDayId: targetSiteDay.id,
            employeeId: employee.id,
            workDate,
            siteId: targetSite.id,
            dayRateAtScan: employee.defaultDayRate
              ? Number(employee.defaultDayRate)
              : 0,
            qrPayload: employee.qrCodeValue,
            scanType: "REGULAR",
            scannedAt: scannedAt(entry.workDate),
          },
        });
      }

      created++;
    }
  }

  console.log("");
  console.log("=".repeat(80));

  if (APPLY) {
    console.log("Moment historical attendance correction applied.");
    console.log(`Created: ${created}`);
    console.log(`Moved to correct site: ${moved}`);
  } else {
    console.log("Preview complete. Nothing was changed.");
    console.log(`Would create: ${created}`);
    console.log(`Would move: ${moved}`);
    console.log(`SiteDays that may be created: ${siteDaysToCreate}`);
  }

  console.log(`Already correct and kept: ${kept}`);
  console.log(`Employees not found: ${notFound}`);
  console.log(`Employees without QR codes: ${missingQr}`);
  console.log(`Unexpected-site scans left untouched: ${unexpectedSite}`);

  if (!APPLY) {
    console.log("");
    console.log("Review every CREATE and MOVE, then add --apply to execute.");
  }
}

main()
  .catch((error) => {
    console.error("Moment attendance fix failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
