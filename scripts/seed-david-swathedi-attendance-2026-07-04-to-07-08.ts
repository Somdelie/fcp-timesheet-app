import { prisma } from "../lib/prisma";
import { computeDayRateAtScan } from "../lib/employeeDayRate";

const FOREMAN_NAME = "David Swathedi";
const BATCH_REASON =
  "Manual attendance seed for David Swathedi: 6745 (Jul 4-6) + 6827 (Jul 7-8) list provided 2026-07-10";

const DAY_ROSTER: Record<
  string,
  { siteCode: string; siteName: string; employees: string[] }
> = {
  "2026-07-04": {
    siteCode: "6745",
    siteName: "MMI INDUS NEDBANK TI",
    employees: ["David Swathedi"],
  },
  "2026-07-05": {
    siteCode: "6745",
    siteName: "MMI INDUS NEDBANK TI",
    employees: ["David Swathedi"],
  },
  "2026-07-06": {
    siteCode: "6745",
    siteName: "MMI INDUS NEDBANK TI",
    employees: ["David Swathedi"],
  },
  "2026-07-07": {
    siteCode: "6827",
    siteName: "CURRO HAZELDEAN PRE&PRIMARY SCHOOL",
    employees: ["David Swathedi", "Sthephens Sithole", "Lucas Molokomme"],
  },
  "2026-07-08": {
    siteCode: "6827",
    siteName: "CURRO HAZELDEAN PRE&PRIMARY SCHOOL",
    employees: [
      "Koketso Motau",
      "Tshepiso Chabalala",
      "Tshepiso Mmatli",
      "Sthephens Sithole",
      "Lucas Molokomme",
      "Kgothatso Pelo",
      "Jerry Mnguni",
      "Bonolo Marema",
      "David Swathedi",
    ],
  },
};

const NAME_ALIASES: Record<string, string> = {
  "sthephens sithole": "sthephens s",
  "stephen sithole": "sthephens s",
  "lucas molokomme": "lucas molo",
  "lucus molokomme": "lucas molo",
  "koketso motau": "koketso mo",
  "koletso motau": "koketso mo",
  "kgothatso pelo": "kgothatso",
  "basil pelo": "kgothatso",
  "jerry mguni": "jerry mnguni",
  "jerry mnguni": "jerry mnguni",
  "tshepiso chabalala": "tshepiso ch",
  "tshepiso mmatli": "tshepiso mm",
  "bonolo marema": "bonolo mar",
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
  siteCode: string;
  siteName: string;
  fullName: string;
  employeeId: string | null;
  qrCodeValue: string | null;
  skipReason: string | null;
};

async function main() {
  const apply = process.argv.includes("--apply");

  const [foremen, sites] = await Promise.all([
    prisma.foreman.findMany({
      select: {
        id: true,
        user: { select: { name: true } },
      },
    }),
    prisma.site.findMany({
      select: {
        id: true,
        code: true,
        name: true,
      },
    }),
  ]);

  const targetForeman = foremen.find((f) => {
    const n = normalizeName(f.user?.name ?? "");
    return n === normalizeName(FOREMAN_NAME);
  });

  if (!targetForeman) {
    throw new Error(`Foreman "${FOREMAN_NAME}" not found.`);
  }

  const siteByCode = new Map(sites.map((s) => [s.code, s]));

  const requestedNames = Array.from(
    new Set(
      Object.values(DAY_ROSTER)
        .flatMap((d) => d.employees)
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

  for (const [workDate, dayData] of Object.entries(DAY_ROSTER)) {
    for (const fullNameRaw of dayData.employees) {
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
          siteCode: dayData.siteCode,
          siteName: dayData.siteName,
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
        siteCode: dayData.siteCode,
        siteName: dayData.siteName,
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

  console.log(`\nSeeding attendance for foreman: ${FOREMAN_NAME}`);
  console.log(`Date range: ${minDate} to ${maxDate}`);
  console.log("=".repeat(80));

  let created = 0;
  let skipped = 0;

  for (const row of planned) {
    const {
      workDate,
      siteCode,
      siteName,
      fullName,
      employeeId,
      qrCodeValue,
      skipReason,
    } = row;

    if (skipReason) {
      console.log(`[${workDate} ${siteCode}] SKIP ${fullName}: ${skipReason}`);
      skipped++;
      continue;
    }

    if (!employeeId || !qrCodeValue) {
      console.log(
        `[${workDate} ${siteCode}] SKIP ${fullName}: missing employee or card`,
      );
      skipped++;
      continue;
    }

    try {
      const site = siteByCode.get(siteCode);
      if (!site) {
        console.log(
          `[${workDate} ${siteCode}] SKIP ${fullName}: site not found`,
        );
        skipped++;
        continue;
      }

      let siteDay = await prisma.siteDay.findFirst({
        where: {
          siteId: site.id,
          workDate: dateUTC(workDate),
        },
        select: { id: true },
      });

      if (!siteDay) {
        siteDay = await prisma.siteDay.create({
          data: {
            siteId: site.id,
            workDate: dateUTC(workDate),
            foremanId: targetForeman.id,
          },
          select: { id: true },
        });
      }

      const workDateObj = dateUTC(workDate);

      // Check for existing scan
      const alreadyThere = await prisma.attendanceScan.findUnique({
        where: {
          employeeId_workDate: { employeeId, workDate: workDateObj },
        },
        select: { id: true },
      });

      if (alreadyThere) {
        console.log(
          `[${workDate} ${siteCode}] SKIP ${fullName}: already scanned`,
        );
        skipped++;
        continue;
      }

      if (!apply) {
        console.log(`[${workDate} ${siteCode}] → ${fullName}`);
        created++;
        continue;
      }

      const dayRate = await computeDayRateAtScan({
        employeeId,
        foremanId: targetForeman.id,
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

      console.log(
        `[${workDate} ${siteCode}] ✓ ${fullName} (R${dayRate.dayRate?.toFixed(2) ?? "N/A"})`,
      );
      created++;
    } catch (err) {
      console.log(
        `[${workDate} ${siteCode}] ✗ ${fullName}: ${(err as Error).message}`,
      );
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
