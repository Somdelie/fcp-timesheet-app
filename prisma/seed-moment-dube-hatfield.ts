// prisma/seed-moment-dube-hatfield.ts
//
// Seed attendance for MOMENT DUBE's team at Hatfield Square (Jul 4-10 2026).
//
// Preview:  pnpm tsx prisma/seed-moment-dube-hatfield.ts
// Apply:    pnpm tsx prisma/seed-moment-dube-hatfield.ts --apply
//
// Optional: specify foreman ID directly via FOREMAN_ID env var

import { prisma } from "@/lib/prisma";
import { computeDayRateAtScan } from "@/lib/employeeDayRate";

const FOREMAN_NAME = "Moment Dube";
const SITE_NAME_PATTERN = "HATFIELD|SQUARE"; // Search pattern for site
const FOREMAN_ID = process.env.FOREMAN_ID; // Override via env var
const BATCH_REASON =
  "Manual attendance seed – MOMENT DUBE team: Hatfield Square (Jul 4-10), 2026-07-11";

// ---------------------------------------------------------------------------
// Attendance roster – canonical names only.
// ---------------------------------------------------------------------------
const DAY_ROSTER: Record<string, { employees: string[] }> = {
  "2026-07-04": {
    employees: [
      "Boikanyo Machaka",
      "Kamuhelo Moteong",
      "Tshiamo Tsabalala",
      "Khulumani Moyo",
      "Shadreck Mbewe",
    ],
  },

  "2026-07-05": {
    employees: ["Kamuhelo Moteong"],
  },

  "2026-07-06": {
    employees: [
      "Akani Mnisi",
      "Thomas Mathebula",
      "Boikanyo Machaka",
      "Kamuhelo Moteong",
      "Tshiamo Tsabalala",
      "Shadreck Mbewe",
    ],
  },

  "2026-07-07": {
    employees: [
      "Akani Mnisi",
      "Thomas Mathebula",
      "Boikanyo Machaka",
      "Kamuhelo Moteong",
      "Tshiamo Tsabalala",
      "Khulumani Moyo",
    ],
  },

  "2026-07-08": {
    employees: [
      "Akani Mnisi",
      "Thomas Mathebula",
      "Sbusiso Mahlangu",
      "Boikanyo Machaka",
      "Kamuhelo Moteong",
      "Tshiamo Tsabalala",
      "Khulumani Moyo",
    ],
  },

  "2026-07-09": {
    employees: [
      "Akani Mnisi",
      "Thomas Mathebula",
      "Boikanyo Machaka",
      "Kamuhelo Moteong",
      "Tshiamo Tsabalala",
    ],
  },

  "2026-07-10": {
    employees: [
      "Akani Mnisi",
      "Thomas Mathebula",
      "Boikanyo Machaka",
      "Kamuhelo Moteong",
      "Tshiamo Tsabalala",
    ],
  },
};

// ---------------------------------------------------------------------------

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

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "" };
  const lastName = parts.pop()!;
  return { firstName: parts.join(" "), lastName };
}

type PlannedScan = {
  workDate: string;
  fullName: string;
  employeeId: string | null;
  qrCodeValue: string | null;
  skipReason: string | null;
};

// ---------------------------------------------------------------------------

async function main() {
  const apply = process.argv.includes("--apply");

  const [foremen, sites, employees] = await Promise.all([
    prisma.foreman.findMany({
      select: { id: true, user: { select: { name: true } } },
    }),
    prisma.site.findMany({
      select: { id: true, code: true, name: true },
    }),
    prisma.employee.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        qrCodeValue: true,
        isActive: true,
      },
    }),
  ]);

  // Find foreman
  const targetForeman = FOREMAN_ID
    ? foremen.find((f) => f.id === FOREMAN_ID)
    : foremen.find(
        (f) =>
          normalizeName(f.user?.name ?? "") === normalizeName(FOREMAN_NAME),
      );

  if (!targetForeman)
    throw new Error(
      `Foreman not found. ${FOREMAN_ID ? `ID: ${FOREMAN_ID}` : `Name: "${FOREMAN_NAME}"`}`,
    );

  // Find site
  const siteNamePattern = new RegExp(SITE_NAME_PATTERN, "i");
  const targetSite = sites.find((s) => siteNamePattern.test(s.name ?? ""));

  if (!targetSite)
    throw new Error(
      `Site matching "${SITE_NAME_PATTERN}" not found. Available: ${sites.map((s) => s.name).join(", ")}`,
    );

  // Build employee lookup
  const employeeByExact = new Map<string, (typeof employees)[number]>();
  const employeeBySplit = new Map<string, (typeof employees)[number]>();

  for (const emp of employees) {
    const fullKey = normalizeName(`${emp.firstName} ${emp.lastName}`);
    if (!employeeByExact.has(fullKey)) employeeByExact.set(fullKey, emp);

    const splitKey = `${normalizeName(emp.firstName)}|${normalizeName(emp.lastName)}`;
    if (!employeeBySplit.has(splitKey)) employeeBySplit.set(splitKey, emp);
  }

  // ── Build planned scan list ─────────────────────────────────────────────
  const dayDates = Object.keys(DAY_ROSTER);
  const minDate = dayDates.slice().sort()[0]!;
  const maxDate = dayDates.slice().sort().at(-1)!;

  const planned: PlannedScan[] = [];
  const matchedEmployeeIds = new Set<string>();

  for (const [workDate, dayData] of Object.entries(DAY_ROSTER)) {
    for (const rawName of dayData.employees) {
      const fullName = rawName.replace(/\.+$/, "").trim();
      const fullKey = normalizeName(fullName);
      const split = splitName(fullKey);
      const splitKey = `${normalizeName(split.firstName)}|${normalizeName(split.lastName)}`;

      const emp = employeeByExact.get(fullKey) ?? employeeBySplit.get(splitKey);

      if (!emp) {
        planned.push({
          workDate,
          fullName,
          employeeId: null,
          qrCodeValue: null,
          skipReason: "Employee not found in DB",
        });
        continue;
      }

      matchedEmployeeIds.add(emp.id);

      planned.push({
        workDate,
        fullName,
        employeeId: emp.id,
        qrCodeValue: emp.qrCodeValue,
        skipReason: !emp.qrCodeValue ? "No card value (qrCodeValue)" : null,
      });
    }
  }

  // ── Mark already-scanned rows ───────────────────────────────────────────
  const existingScans = matchedEmployeeIds.size
    ? await prisma.attendanceScan.findMany({
        where: {
          employeeId: { in: Array.from(matchedEmployeeIds) },
          siteId: targetSite.id,
          workDate: { gte: dateUTC(minDate), lte: dateUTC(maxDate) },
        },
        select: { employeeId: true, workDate: true },
      })
    : [];

  const existingSet = new Set(
    existingScans.map(
      (s) => `${s.employeeId}|${s.workDate.toISOString().slice(0, 10)}`,
    ),
  );

  // Don't skip existing scans – we'll delete them and rescan under correct foreman

  // ── Preview / apply ─────────────────────────────────────────────────────
  console.log(`\nSeeding attendance for foreman: ${FOREMAN_NAME}`);
  console.log(`Site: ${targetSite.name} (${targetSite.code})`);
  console.log(`Date range: ${minDate} → ${maxDate}`);
  console.log("=".repeat(72));

  let created = 0;
  let deleted = 0;
  let skipped = 0;

  for (const row of planned) {
    const { workDate, fullName, employeeId, qrCodeValue, skipReason } = row;

    if (skipReason || !employeeId || !qrCodeValue) {
      console.log(
        `[${workDate}] SKIP  ${fullName}: ${skipReason ?? "missing employee/card"}`,
      );
      skipped++;
      continue;
    }

    if (!apply) {
      console.log(`[${workDate}] → ${fullName}`);
      created++;
      continue;
    }

    try {
      const workDateObj = dateUTC(workDate);

      // Delete any existing scan for this employee on this date at this site
      const existingScan = await prisma.attendanceScan.findFirst({
        where: {
          employeeId,
          siteId: targetSite.id,
          workDate: workDateObj,
        },
        select: { id: true },
      });

      if (existingScan) {
        await prisma.attendanceScan.delete({
          where: { id: existingScan.id },
        });
        deleted++;
      }

      let siteDay = await prisma.siteDay.findFirst({
        where: { siteId: targetSite.id, workDate: workDateObj },
        select: { id: true, foremanId: true },
      });

      if (!siteDay) {
        siteDay = await prisma.siteDay.create({
          data: {
            siteId: targetSite.id,
            workDate: workDateObj,
            foremanId: targetForeman.id,
          },
          select: { id: true, foremanId: true },
        });
      } else if (siteDay.foremanId !== targetForeman.id) {
        // Update existing SiteDay to correct foreman if it was assigned to wrong one
        siteDay = await prisma.siteDay.update({
          where: { id: siteDay.id },
          data: { foremanId: targetForeman.id },
          select: { id: true, foremanId: true },
        });
      }

      if (!siteDay) throw new Error(`Failed to get/create siteDay`);

      const dayRate = await computeDayRateAtScan({
        employeeId,
        foremanId: targetForeman.id,
        siteId: targetSite.id,
        workDate: workDateObj,
      });

      await prisma.attendanceScan.create({
        data: {
          siteDayId: siteDay.id,
          employeeId,
          siteId: targetSite.id,
          workDate: workDateObj,
          dayRateAtScan: dayRate.dayRate,
          team: dayRate.team,
          qrPayload: qrCodeValue,
          scanType: "MANUAL",
          manualReason: BATCH_REASON,
        },
      });

      console.log(
        `[${workDate}] ✓  ${fullName} (R${dayRate.dayRate?.toFixed(2) ?? "N/A"})`,
      );
      created++;
    } catch (err) {
      console.log(`[${workDate}] ✗  ${fullName}: ${(err as Error).message}`);
      skipped++;
    }
  }

  console.log("\n" + "=".repeat(72));
  if (apply) {
    console.log(
      `Applied: ${created} created, ${deleted} deleted/resynced, ${skipped} skipped.`,
    );
  } else {
    console.log(
      `Preview: ${created} would be created, ${deleted} would be deleted/resynced, ${skipped} would be skipped.  Add --apply to execute.`,
    );
  }
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
