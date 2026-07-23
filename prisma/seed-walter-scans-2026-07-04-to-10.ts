import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const SITE_CODES = {
  chamberlain: "6658",
  curro: "6819",
  isando: "6743",
} as const;

type SiteKey = keyof typeof SITE_CODES;
type DayEntry = {
  date: string;
  sites: Partial<Record<SiteKey, string[]>>;
};

const attendance: DayEntry[] = [
  {
    date: "2026-07-04",
    sites: {
      curro: [
        "Walter Sebothoma",
        "Edward Maripa",
        "Ebick Ngobe",
        "Sfiso Skhos",
        "Junior Mashao",
        "Justice Ralebala",
      ],
      isando: ["Khutso Raphaka", "Gift Malatji"],
      chamberlain: [
        "Nelcome Dube",
        "Brandon Ndlovu",
        "Simbarashe Chiwani",
        "Thamani Zulu",
        "Hloniphani Moyo",
      ],
    },
  },
  {
    date: "2026-07-06",
    sites: {
      curro: [
        "Edward Maripa",
        "Justice Ralebala",
        "Ebick Ngobe",
        "Junior Mashao",
        "Sfiso Skhos",
        "Vongani Nkwinika",
        "Vincent Maluleke",
      ],
      isando: ["Khutso Raphaka", "Gift Malatji"],
      chamberlain: [
        "Nelcome Dube",
        "Owen Dube",
        "Eric Minguni",
        "Hloniphani Moyo",
      ],
    },
  },
  {
    date: "2026-07-07",
    sites: {
      curro: [
        "Walter Sebothoma",
        "Khutso Raphaka",
        "Gift Malatji",
        "Justice Ralebala",
        "Edward Maripa",
        "Junior Mashao",
        "Sfiso Skhos",
        "Ebick Ngobe",
        "Vongani Nkwinika",
        "Vincent Maluleke",
      ],
      chamberlain: ["Nelcome Dube", "Eric Minguni", "Hloniphani Moyo"],
    },
  },
  {
    date: "2026-07-08",
    sites: {
      curro: [
        "Walter Sebothoma",
        "Khutso Raphaka",
        "Gift Malatji",
        "Justice Ralebala",
        "Edward Maripa",
        "Ebick Ngobe",
        "Junior Mashao",
        "Sfiso Skhos",
        "Vongani Nkwinika",
        "Vincent Maluleke",
      ],
      chamberlain: ["Nelcome Dube", "Eric Minguni", "Hloniphani Moyo"],
    },
  },
  {
    date: "2026-07-09",
    sites: {
      curro: [
        "Walter Sebothoma",
        "Gift Malatji",
        "Justice Ralebala",
        "Edward Maripa",
        "Junior Mashao",
        "Sfiso Skhos",
        "Ebick Ngobe",
        "Vongani Nkwinika",
        "Vincent Maluleke",
      ],
      isando: ["Khutso Raphaka"],
      chamberlain: ["Nelcome Dube", "Eric Minguni", "Hloniphani Moyo"],
    },
  },
  {
    date: "2026-07-10",
    sites: {
      curro: [
        "Walter Sebothoma",
        "Khutso Raphaka",
        "Gift Malatji",
        "Justice Ralebala",
        "Edward Maripa",
        "Junior Mashao",
        "Sfiso Skhos",
        "Ebick Ngobe",
        "Vongani Nkwinika",
        "Vincent Maluleke",
      ],
      chamberlain: ["Nelcome Dube", "Hloniphani Moyo", "Eric Minguni"],
    },
  },
];

function startOfDay(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function scanTime(date: string, index: number) {
  return new Date(`${date}T06:${String(index).padStart(2, "0")}:00.000Z`);
}

function splitName(fullName: string) {
  const [firstName, ...rest] = fullName.trim().split(/\s+/);
  return { firstName, lastName: rest.join(" ") };
}

async function findEmployee(fullName: string) {
  const { firstName, lastName } = splitName(fullName);

  const directMatch = await prisma.employee.findFirst({
    where: {
      firstName: { equals: firstName, mode: "insensitive" },
      lastName: { equals: lastName, mode: "insensitive" },
    },
  });

  if (directMatch) return directMatch;

  // Some imported cards have the surname and first name reversed.
  return prisma.employee.findFirst({
    where: {
      firstName: { equals: lastName, mode: "insensitive" },
      lastName: { equals: firstName, mode: "insensitive" },
    },
  });
}

function historicalQrValue(fullName: string) {
  return `HIST-WALTER-${fullName
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase()}`;
}

async function findOrCreateEmployee(fullName: string) {
  const existing = await findEmployee(fullName);
  if (existing) return { employee: existing, created: false };

  const { firstName, lastName } = splitName(fullName);
  const qrCodeValue = historicalQrValue(fullName);

  const employee = await prisma.employee.upsert({
    where: { qrCodeValue },
    update: {},
    create: {
      firstName,
      lastName,
      qrCodeValue,
      isActive: true,
    },
  });

  return { employee, created: true };
}

async function resolveDayRate(
  employeeId: string,
  siteId: string,
  foremanId: string,
  workDate: Date,
  employeeDefault: Prisma.Decimal | null,
  foremanDefault: Prisma.Decimal | null,
  team: string,
) {
  const [employeeOverride, foremanOverride, teamRate, settings] =
    await Promise.all([
      prisma.employeeDayRateOverride.findFirst({
        where: {
          employeeId,
          OR: [{ siteId }, { siteId: null }],
          startsOn: { lte: workDate },
          AND: [{ OR: [{ endsOn: null }, { endsOn: { gte: workDate } }] }],
        },
        orderBy: [{ siteId: "asc" }, { startsOn: "desc" }],
      }),
      prisma.siteForemanDayRateOverride.findFirst({
        where: {
          siteId,
          foremanId,
          startsOn: { lte: workDate },
          OR: [{ endsOn: null }, { endsOn: { gte: workDate } }],
        },
        orderBy: { startsOn: "desc" },
      }),
      prisma.companyTeamRate.findUnique({ where: { code: team } }),
      prisma.companySettings.findUnique({ where: { id: "singleton" } }),
    ]);

  return (
    employeeOverride?.dayRate ??
    foremanOverride?.dayRate ??
    employeeDefault ??
    foremanDefault ??
    teamRate?.dayRate ??
    settings?.defaultEmployeeDayRate ??
    new Prisma.Decimal(0)
  );
}

async function main() {
  const foreman = await prisma.foreman.findFirst({
    where: {
      user: {
        OR: [
          { name: { contains: "Walter", mode: "insensitive" } },
          { name: { contains: "Sebothoma", mode: "insensitive" } },
        ],
      },
    },
    include: { user: true },
  });

  if (!foreman) {
    throw new Error("Walter Sebothoma's foreman record was not found.");
  }

  const sites = new Map<
    SiteKey,
    { id: string; name: string; code: string | null }
  >();

  for (const siteKey of Object.keys(SITE_CODES) as SiteKey[]) {
    const code = SITE_CODES[siteKey];
    const site = await prisma.site.findUnique({ where: { code } });

    if (!site) {
      throw new Error(`Site ${code} (${siteKey}) was not found.`);
    }

    sites.set(siteKey, site);
  }

  const uniqueNames = [
    ...new Set(
      attendance.flatMap((day) =>
        Object.values(day.sites).flatMap((names) => names ?? []),
      ),
    ),
  ];
  const employees = new Map<
    string,
    NonNullable<Awaited<ReturnType<typeof findEmployee>>>
  >();
  const createdEmployees: string[] = [];

  for (const name of uniqueNames) {
    const result = await findOrCreateEmployee(name);
    employees.set(name, result.employee);
    if (result.created) createdEmployees.push(name);
  }

  let created = 0;
  let updated = 0;

  for (const day of attendance) {
    const workDate = startOfDay(day.date);

    for (const [siteKey, names] of Object.entries(day.sites) as [
      SiteKey,
      string[],
    ][]) {
      const site = sites.get(siteKey);
      if (!site) throw new Error(`Site data missing for ${siteKey}.`);

      const siteDay = await prisma.siteDay.upsert({
        where: {
          siteId_foremanId_workDate: {
            siteId: site.id,
            foremanId: foreman.id,
            workDate,
          },
        },
        update: {},
        create: { siteId: site.id, foremanId: foreman.id, workDate },
      });

      for (const [index, name] of names.entries()) {
        const employee = employees.get(name)!;
        const existing = await prisma.attendanceScan.findUnique({
          where: { employeeId_workDate: { employeeId: employee.id, workDate } },
        });
        const dayRateAtScan = await resolveDayRate(
          employee.id,
          site.id,
          foreman.id,
          workDate,
          employee.defaultDayRate,
          foreman.defaultDayRate,
          foreman.defaultTeam,
        );

        await prisma.attendanceScan.upsert({
          where: { employeeId_workDate: { employeeId: employee.id, workDate } },
          update: {
            siteDayId: siteDay.id,
            siteId: site.id,
            addedByForemanId: foreman.id,
            dayRateAtScan,
            team: foreman.defaultTeam,
            scanType: "MANUAL",
            direction: "IN",
            manualReason: "Historical attendance seeded under Walter Sebothoma",
          },
          create: {
            siteDayId: siteDay.id,
            employeeId: employee.id,
            workDate,
            siteId: site.id,
            scannedAt: scanTime(day.date, index),
            dayRateAtScan,
            team: foreman.defaultTeam,
            qrPayload: employee.qrCodeValue,
            addedByForemanId: foreman.id,
            scanType: "MANUAL",
            direction: "IN",
            manualReason: "Historical attendance seeded under Walter Sebothoma",
          },
        });

        if (existing) updated += 1;
        else created += 1;
      }
    }
  }

  console.log(`Foreman: ${foreman.user.name ?? "Walter Sebothoma"}`);
  if (createdEmployees.length) {
    console.log(`Created ${createdEmployees.length} missing employee records:`);
    console.log(`- ${createdEmployees.join("\n- ")}`);
  }
  console.log(
    `Created ${created} scans and updated ${updated} existing scans.`,
  );
  console.log("Seeded dates: 4 July and 6-10 July 2026.");
}

main()
  .catch((error) => {
    console.error("Walter attendance seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
