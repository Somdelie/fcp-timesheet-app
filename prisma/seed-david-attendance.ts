// prisma/seed-david-attendance.ts
//
// Step 2 of 2 for David Swathedi's team attendance (Jul 4-9 2026).
//
// Run AFTER prisma/seed-corrected-david-team.ts --apply so that every
// employee record has the canonical name and a card value.
//
// Preview:  pnpm tsx prisma/seed-david-attendance.ts
// Apply:    pnpm tsx prisma/seed-david-attendance.ts --apply
//
// Optional: specify foreman ID directly via FOREMAN_ID env var
//   FOREMAN_ID=EMP-2FB4CF8D79B6EA1E pnpm tsx prisma/seed-david-attendance.ts --apply

import { prisma } from "@/lib/prisma";
import { computeDayRateAtScan } from "@/lib/employeeDayRate";

const FOREMAN_NAME = "David Swathedi";
const FOREMAN_ID = process.env.FOREMAN_ID; // Override via env var
const BATCH_REASON =
  "Manual attendance seed – David Swathedi team: 6745 (Jul 4-6) + 6827 (Jul 7-9), corrected names 2026-07-11";

// ---------------------------------------------------------------------------
// Attendance roster – canonical names only (corrected from physical cards).
// ---------------------------------------------------------------------------
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
    employees: ["David Swathedi", "Stephen Sithole", "Lucas Molokomme"],
  },

  "2026-07-08": {
    siteCode: "6827",
    siteName: "CURRO HAZELDEAN PRE&PRIMARY SCHOOL",
    employees: [
      "Koketso Motau",
      "Tshepiso Chabalala",
      "Tshepiso Mmatli",
      "Stephen Sithole",
      "Lucas Molokomme",
      "Kgothatso Pelo",
      "Jerry Mnguni",
      "Bonolo Marema",
      "David Swathedi",
    ],
  },

  "2026-07-09": {
    siteCode: "6827",
    siteName: "CURRO HAZELDEAN PRE&PRIMARY SCHOOL",
    employees: [
      "Koketso Motau",
      "Tshepiso Chabalala",
      "Tshepiso Mmatli",
      "Stephen Sithole",
      "Lucas Molokomme",
      "Kgothatso Pelo",
      "Jerry Mnguni",
      "Bonolo Marema",
    ],
  },
};

// ---------------------------------------------------------------------------
// Fallback aliases – map physical-card spellings to canonical forms in case
// seed-corrected-david-team.ts has not yet renamed every record.
// ---------------------------------------------------------------------------
const NAME_ALIASES: Record<string, string> = {
  // Sithole
  "sthephens sithole": "stephen sithole",
  // Molokomme
  "lucus molokomme": "lucas molokomme",
  "locus molokomme": "lucas molokomme",
  // Motau
  "koletso motau": "koketso motau",
  // Pelo
  "basil pelo": "kgothatso pelo",
  // Mnguni
  "jerry mguni": "jerry mnguni",
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

function normalizeWithAlias(input: string) {
  const normalized = normalizeName(input);
  return NAME_ALIASES[normalized] ?? normalized;
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
  siteCode: string;
  siteName: string;
  fullName: string;
  employeeId: string | null;
  qrCodeValue: string | null;
  skipReason: string | null;
};

// ---------------------------------------------------------------------------

async function main() {
  const apply = process.argv.includes("--apply");

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

  if (!targetForeman)
    throw new Error(
      `Foreman not found. ${FOREMAN_ID ? `ID: ${FOREMAN_ID}` : `Name: "${FOREMAN_NAME}"`}`,
    );

  const siteByCode = new Map(sites.map((s) => [s.code, s]));

  // ── Resolve unique canonical names to Employee records ──────────────────
  const canonicalNames = Array.from(
    new Set(
      Object.values(DAY_ROSTER)
        .flatMap((d) => d.employees)
        .map((n) => normalizeWithAlias(n.replace(/\.+$/, ""))),
    ),
  );

  const nameParts = canonicalNames.map((name) => {
    const split = splitName(name);
    return {
      raw: name,
      firstName: normalizeName(split.firstName),
      lastName: normalizeName(split.lastName),
    };
  });

  const conditions: any[] = nameParts
    .filter((p) => p.firstName || p.lastName)
    .map((p) =>
      p.lastName
        ? {
            AND: [
              {
                firstName: {
                  equals: p.firstName,
                  mode: "insensitive" as const,
                },
              },
              {
                lastName: { equals: p.lastName, mode: "insensitive" as const },
              },
            ],
          }
        : {
            OR: [
              {
                firstName: {
                  equals: p.firstName,
                  mode: "insensitive" as const,
                },
              },
              {
                lastName: { equals: p.firstName, mode: "insensitive" as const },
              },
            ],
          },
    );

  const allEmployees = conditions.length
    ? await prisma.employee.findMany({
        where: { OR: conditions },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          qrCodeValue: true,
          isActive: true,
        },
      })
    : [];

  const employeeByExact = new Map<string, (typeof allEmployees)[number]>();
  const employeeBySplit = new Map<string, (typeof allEmployees)[number]>();

  for (const emp of allEmployees) {
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
      const fullKey = normalizeWithAlias(fullName);
      const split = splitName(fullKey);
      const splitKey = `${normalizeName(split.firstName)}|${normalizeName(split.lastName)}`;

      const emp = employeeByExact.get(fullKey) ?? employeeBySplit.get(splitKey);

      if (!emp) {
        planned.push({
          workDate,
          siteCode: dayData.siteCode,
          siteName: dayData.siteName,
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
        siteCode: dayData.siteCode,
        siteName: dayData.siteName,
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
  // (This corrects scans that may have been booked under wrong foreman)

  // ── Preview / apply ─────────────────────────────────────────────────────
  console.log(`\nSeeding attendance for foreman: ${FOREMAN_NAME}`);
  console.log(`Date range: ${minDate} → ${maxDate}`);
  console.log("=".repeat(72));

  let created = 0;
  let deleted = 0;
  let skipped = 0;

  for (const row of planned) {
    const {
      workDate,
      siteCode,
      fullName,
      employeeId,
      qrCodeValue,
      skipReason,
    } = row;

    if (skipReason || !employeeId || !qrCodeValue) {
      console.log(
        `[${workDate} ${siteCode}] SKIP  ${fullName}: ${skipReason ?? "missing employee/card"}`,
      );
      skipped++;
      continue;
    }

    if (!apply) {
      console.log(`[${workDate} ${siteCode}] → ${fullName}`);
      created++;
      continue;
    }

    try {
      const site = siteByCode.get(siteCode);
      if (!site) throw new Error(`Site ${siteCode} not found`);

      const workDateObj = dateUTC(workDate);

      // Delete any existing scan for this employee on this date
      const existingScan = await prisma.attendanceScan.findUnique({
        where: { employeeId_workDate: { employeeId, workDate: workDateObj } },
        select: { id: true, siteDayId: true },
      });

      if (existingScan) {
        await prisma.attendanceScan.delete({
          where: { id: existingScan.id },
        });
        deleted++;
      }

      let siteDay = await prisma.siteDay.findFirst({
        where: { siteId: site.id, workDate: workDateObj },
        select: { id: true, foremanId: true },
      });

      if (!siteDay) {
        siteDay = await prisma.siteDay.create({
          data: {
            siteId: site.id,
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
        `[${workDate} ${siteCode}] ✓  ${fullName} (R${dayRate.dayRate?.toFixed(2) ?? "N/A"})`,
      );
      created++;
    } catch (err) {
      console.log(
        `[${workDate} ${siteCode}] ✗  ${fullName}: ${(err as Error).message}`,
      );
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
