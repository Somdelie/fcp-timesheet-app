import { prisma } from "../lib/prisma";
import { computeDayRateAtScan } from "../lib/employeeDayRate";

const SITE_CODE = "6710";
const FOREMAN_FULL_NAME = "Samuel Ncube";
const BATCH_REASON =
  "Manual attendance seed for Hereford Complex (job 6710) under Samuel Ncube: Sat + Mon-Wed list provided 2026-07-10";

const NAME_ALIASES: Record<string, string> = {
  "xolisani ncube": "xolisani nc",
  "langton sibanda": "langton sib",
  "ntokozo sbanda": "ntokozo sibanda",
  "matshidiso kopan": "matshidiso kapok",
  "lamlani nyoni": "lamulani nyoni",
  "wiallard msebele": "willard msebele",
};

const DAY_ROSTER: Record<string, string[]> = {
  "2026-07-04": [
    "Samuel Ncube",
    "Trust Tshuma",
    "Nomore Chimpap",
    "Lamulani Nyoni",
    "Xolisani Ncube",
    "Matshidiso Kopan",
    "Masonwabe Mabetu",
    "Gift Moyo",
    "Langton Sibanda",
    "Neverson Banga",
    "Nduna Moyo",
    "Nduduzo Ncube",
  ],
  "2026-07-06": [
    "Samuel Ncube",
    "Trust Tshuma",
    "Nomore Chimpap",
    "Lamulani Nyoni",
    "Xolisani Ncube",
    "Matshidiso Kopan",
    "Masonwabe Mabetu",
    "Gift Moyo",
    "Langton Sibanda",
    "Neverson Banga",
    "Nduna Moyo",
    "Nduduzo Ncube",
  ],
  "2026-07-07": [
    "Samuel Ncube",
    "Trust Tshuma",
    "Nomore Chimpap",
    "Lamlani Nyoni",
    "Xolisani Ncube",
    "Masonwabe Mabetu",
    "Gift Moyo",
    "Langton Sibanda",
    "Neverson Banga",
    "Nduna Moyo",
    "Nduduzo Ncube",
    "Willard Msebele",
    "Ntokozo Sbanda",
  ],
  "2026-07-08": [
    "Samuel Ncube",
    "Trust Tshuma",
    "Nomore Chimpap",
    "Lamlani Nyoni",
    "Xolisani Ncube",
    "Matshidiso Kopan",
    "Masonwabe Mabetu",
    "Gift Moyo",
    "Langton Sibanda",
    "Neverson Banga",
    "Nduna Moyo",
    "Nduduzo Ncube",
    "Wiallard Msebele",
    "Ntokozo Sbanda",
    "Godknows Msebele",
  ],
};

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

function normalizeWithAlias(input: string) {
  const normalized = normalizeName(input);
  return NAME_ALIASES[normalized] ?? normalized;
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: "", lastName: "" };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }

  // Match /admin/cards/bulk-seed logic: surname is the final token.
  const lastName = parts.pop() ?? "";
  return { firstName: parts.join(" "), lastName };
}

type PlannedScan = {
  workDate: string;
  fullName: string;
  employeeId: string | null;
  qrCodeValue: string | null;
  skipReason: string | null;
};

async function main() {
  const apply = process.argv.includes("--apply");

  const [site, foremen] = await Promise.all([
    prisma.site.findFirst({
      where: { code: SITE_CODE },
      select: { id: true, code: true, name: true },
    }),
    prisma.foreman.findMany({
      select: {
        id: true,
        user: { select: { name: true, email: true } },
      },
    }),
  ]);

  if (!site) {
    throw new Error(`Site ${SITE_CODE} not found.`);
  }

  const targetForeman = foremen.find((f) => {
    const n = normalizeName(f.user?.name ?? "");
    return n === normalizeName(FOREMAN_FULL_NAME);
  });

  if (!targetForeman) {
    throw new Error(`Foreman ${FOREMAN_FULL_NAME} not found.`);
  }

  const requestedNames = Array.from(
    new Set(
      Object.values(DAY_ROSTER)
        .flat()
        .map((n) => normalizeWithAlias(n.replace(/\.+$/, ""))),
    ),
  );

  const requestedNameParts = requestedNames.map((name) => {
    const split = splitName(name);
    return {
      raw: name,
      firstName: normalizeName(split.firstName),
      lastName: normalizeName(split.lastName),
    };
  });

  const employeeNameConditions: any[] = [];
  for (const part of requestedNameParts) {
    if (!part.firstName && !part.lastName) continue;
    if (!part.lastName) {
      employeeNameConditions.push({
        OR: [
          {
            firstName: { equals: part.firstName, mode: "insensitive" as const },
          },
          {
            lastName: { equals: part.firstName, mode: "insensitive" as const },
          },
        ],
      });
      continue;
    }

    employeeNameConditions.push({
      AND: [
        { firstName: { equals: part.firstName, mode: "insensitive" as const } },
        { lastName: { equals: part.lastName, mode: "insensitive" as const } },
      ],
    });
  }

  const allEmployees = employeeNameConditions.length
    ? await prisma.employee.findMany({
        where: { OR: employeeNameConditions },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          qrCodeValue: true,
          isActive: true,
        },
      })
    : await prisma.employee.findMany({
        select: {
          id: true,
          firstName: true,
          lastName: true,
          qrCodeValue: true,
          isActive: true,
        },
      });

  const employeeByExactFullName = new Map<
    string,
    (typeof allEmployees)[number]
  >();
  const employeeBySplitName = new Map<string, (typeof allEmployees)[number]>();
  for (const employee of allEmployees) {
    const fullKey = normalizeName(`${employee.firstName} ${employee.lastName}`);
    if (!employeeByExactFullName.has(fullKey)) {
      employeeByExactFullName.set(fullKey, employee);
    }

    const splitKey = `${normalizeName(employee.firstName)}|${normalizeName(employee.lastName)}`;
    if (!employeeBySplitName.has(splitKey)) {
      employeeBySplitName.set(splitKey, employee);
    }
  }

  const dayDates = Object.keys(DAY_ROSTER);
  const minDate = dayDates.slice().sort()[0]!;
  const maxDate = dayDates.slice().sort().at(-1)!;

  const planned: PlannedScan[] = [];
  const matchedEmployeeIds = new Set<string>();

  for (const [workDate, names] of Object.entries(DAY_ROSTER)) {
    for (const fullNameRaw of names) {
      const fullName = fullNameRaw.replace(/\.+$/, "").trim();
      const fullKey = normalizeWithAlias(fullName);
      const split = splitName(fullKey);
      const splitKey = `${normalizeName(split.firstName)}|${normalizeName(split.lastName)}`;

      const employee =
        employeeByExactFullName.get(fullKey) ??
        employeeBySplitName.get(splitKey);

      if (!employee) {
        planned.push({
          workDate,
          fullName,
          employeeId: null,
          qrCodeValue: null,
          skipReason: "Card/employee not found",
        });
        continue;
      }

      matchedEmployeeIds.add(employee.id);

      planned.push({
        workDate,
        fullName,
        employeeId: employee.id,
        qrCodeValue: employee.qrCodeValue,
        skipReason: !employee.qrCodeValue ? "No card code (qrCodeValue)" : null,
      });
    }
  }

  const existingScans = matchedEmployeeIds.size
    ? await prisma.attendanceScan.findMany({
        where: {
          employeeId: { in: Array.from(matchedEmployeeIds) },
          workDate: {
            gte: dateUTC(minDate),
            lte: dateUTC(maxDate),
          },
        },
        select: {
          employeeId: true,
          workDate: true,
        },
      })
    : [];

  const existingSet = new Set(
    existingScans.map(
      (scan) =>
        `${scan.employeeId}|${scan.workDate.toISOString().slice(0, 10)}`,
    ),
  );

  for (const row of planned) {
    if (row.skipReason || !row.employeeId) continue;
    const existingKey = `${row.employeeId}|${row.workDate}`;
    if (existingSet.has(existingKey)) {
      row.skipReason = "Already scanned for this date";
    }
  }

  const createRows = planned.filter((row) => !row.skipReason);
  const skipRows = planned.filter((row) => row.skipReason);

  console.log(
    `${apply ? "Applying" : "Previewing"} attendance seed for ${site.code} ${site.name} under ${targetForeman.user?.name ?? FOREMAN_FULL_NAME}`,
  );
  console.log(`Planned creates: ${createRows.length}`);
  console.log(`Planned skips:   ${skipRows.length}`);

  if (skipRows.length > 0) {
    console.log("\nSkip reasons:");
    for (const row of skipRows) {
      console.log(`- ${row.workDate} | ${row.fullName} -> ${row.skipReason}`);
    }
  }

  if (!apply) return;

  let created = 0;
  for (const row of createRows) {
    const workDate = dateUTC(row.workDate);
    const employeeId = row.employeeId!;

    // Idempotent guard in case of reruns/partial runs.
    const alreadyThere = await prisma.attendanceScan.findUnique({
      where: {
        employeeId_workDate: {
          employeeId,
          workDate,
        },
      },
      select: { id: true },
    });
    if (alreadyThere) {
      console.log(
        `SKIP ${row.workDate} | ${row.fullName} -> Already scanned for this date`,
      );
      continue;
    }

    const rate = await computeDayRateAtScan({
      employeeId,
      foremanId: targetForeman.id,
      siteId: site.id,
      workDate,
    });

    const siteDay =
      (await prisma.siteDay.findFirst({
        where: {
          siteId: site.id,
          foremanId: targetForeman.id,
          workDate,
        },
        select: { id: true },
      })) ??
      (await prisma.siteDay.create({
        data: {
          siteId: site.id,
          foremanId: targetForeman.id,
          workDate,
        },
        select: { id: true },
      }));

    await prisma.attendanceScan.create({
      data: {
        siteDayId: siteDay.id,
        employeeId,
        siteId: site.id,
        workDate,
        dayRateAtScan: rate.dayRate,
        team: rate.team,
        qrPayload: row.qrCodeValue,
        scanType: "MANUAL",
        manualReason: BATCH_REASON,
      },
    });

    created += 1;
    console.log(`CREATE ${row.workDate} | ${row.fullName}`);
  }

  console.log(`\nDone. Created ${created} attendance scans.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
