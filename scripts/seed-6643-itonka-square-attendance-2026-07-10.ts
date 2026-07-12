import { prisma } from "../lib/prisma";
import { computeDayRateAtScan } from "../lib/employeeDayRate";

const SITE_CODE = "6643";
const SITE_NAME = "ITONKA SQUARE";
const WORK_DATE = "2026-07-10";
const BATCH_REASON =
  "Manual attendance seed for Itonka Square (job 6643): Friday 10 Jul list provided 2026-07-10";

const EMPLOYEES = [
  "Walter Mabasa",
  "Sibusiso Makhafula",
  "Loyiso Mofukeng",
  "Dingani Zondo",
  "Thabang Segodi",
];

const NAME_ALIASES: Record<string, string> = {
  "thabang segodi": "thabang happy segodi",
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
        user: { select: { name: true } },
      },
    }),
  ]);

  if (!site) {
    throw new Error(`Site ${SITE_CODE} not found.`);
  }

  // Try to resolve foreman from existing site assignments
  const existingSiteDay = await prisma.siteDay.findFirst({
    where: {
      siteId: site.id,
      workDate: { lte: dateUTC(WORK_DATE) },
    },
    select: { foremanId: true },
    orderBy: { createdAt: "desc" },
  });

  let foremanId = existingSiteDay?.foremanId;
  if (!foremanId) {
    const activeAssignment = await prisma.foremanSiteAssignment.findFirst({
      where: {
        siteId: site.id,
        startsOn: { lte: dateUTC(WORK_DATE) },
        OR: [{ endsOn: null }, { endsOn: { gte: dateUTC(WORK_DATE) } }],
      },
      select: { foremanId: true },
      orderBy: { startsOn: "desc" },
    });
    foremanId = activeAssignment?.foremanId;
  }

  if (!foremanId) {
    throw new Error(`Could not determine foreman for site ${SITE_CODE}`);
  }

  const requestedNames = EMPLOYEES.map((n) =>
    normalizeWithAlias(n.replace(/\.+$/, "")),
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

  const planned: PlannedScan[] = [];
  const matchedEmployeeIds = new Set<string>();

  for (const fullNameRaw of EMPLOYEES) {
    const fullName = fullNameRaw.replace(/\.+$/, "").trim();
    const fullKey = normalizeWithAlias(fullName);
    const split = splitName(fullKey);
    const splitKey = `${normalizeName(split.firstName)}|${normalizeName(split.lastName)}`;

    const employee =
      employeeByExactFullName.get(fullKey) ?? employeeBySplitName.get(splitKey);

    if (!employee) {
      planned.push({
        fullName,
        employeeId: null,
        qrCodeValue: null,
        skipReason: "Card/employee not found",
      });
      continue;
    }

    matchedEmployeeIds.add(employee.id);

    planned.push({
      fullName,
      employeeId: employee.id,
      qrCodeValue: employee.qrCodeValue,
      skipReason: !employee.qrCodeValue ? "No card code (qrCodeValue)" : null,
    });
  }

  const workDateObj = dateUTC(WORK_DATE);

  const existingScans = matchedEmployeeIds.size
    ? await prisma.attendanceScan.findMany({
        where: {
          employeeId: { in: Array.from(matchedEmployeeIds) },
          workDate: workDateObj,
        },
        select: {
          employeeId: true,
        },
      })
    : [];

  const existingSet = new Set(existingScans.map((scan) => scan.employeeId));

  for (const row of planned) {
    if (row.skipReason || !row.employeeId) continue;
    if (existingSet.has(row.employeeId)) {
      row.skipReason = "Already scanned for this date";
    }
  }

  console.log(
    `\n${apply ? "Applying" : "Previewing"} attendance seed for ${site.code} ${site.name}`,
  );
  console.log(`Work date: ${WORK_DATE}`);
  console.log("=".repeat(80));

  let created = 0;
  let skipped = 0;

  for (const row of planned) {
    const { fullName, employeeId, qrCodeValue, skipReason } = row;

    if (skipReason) {
      console.log(`SKIP ${fullName}: ${skipReason}`);
      skipped++;
      continue;
    }

    if (!employeeId || !qrCodeValue) {
      console.log(`SKIP ${fullName}: missing employee or card`);
      skipped++;
      continue;
    }

    try {
      if (!apply) {
        console.log(`→ ${fullName}`);
        created++;
        continue;
      }

      let siteDay = await prisma.siteDay.findFirst({
        where: {
          siteId: site.id,
          workDate: workDateObj,
        },
        select: { id: true },
      });

      if (!siteDay) {
        siteDay = await prisma.siteDay.create({
          data: {
            siteId: site.id,
            workDate: workDateObj,
            foremanId,
          },
          select: { id: true },
        });
      }

      const dayRate = await computeDayRateAtScan({
        employeeId,
        foremanId,
        siteId: site.id,
        workDate: workDateObj,
      });

      await prisma.attendanceScan.create({
        data: {
          siteDayId: siteDay.id,
          employeeId,
          siteId: site.id,
          workDate: workDateObj,
          dayRateAtScan: dayRate.dayRate,
          team: dayRate.team,
          qrPayload: qrCodeValue,
          scanType: "MANUAL",
          manualReason: BATCH_REASON,
        },
      });

      console.log(`✓ ${fullName} (R${dayRate.dayRate?.toFixed(2) ?? "N/A"})`);
      created++;
    } catch (err) {
      console.log(`✗ ${fullName}: ${(err as Error).message}`);
      skipped++;
    }
  }

  console.log("\n" + "=".repeat(80));
  if (apply) {
    console.log(`Seeding applied: ${created} created, ${skipped} skipped`);
  } else {
    console.log(
      `Preview mode: ${created} would be created, ${skipped} would be skipped. Run with --apply to execute.`,
    );
  }
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
