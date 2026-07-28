// prisma/seed-moment-dube-fix-sites.ts
//
// Fix site assignment for MOMENT DUBE's team (Jul 4-10 2026).
//
// The previous seed placed all 8 employees at Hatfield Square.
// Moment Dube re-scanned to clarify the correct split:
//
//   Hatfield Square → Akani Mnisi, Thomas Mathebula, Sbusiso Mahlangu
//   Indus Menlyn    → Boikanyo Machaka, Kamuhelo Moteong, Tshiamo Tsabalala,
//                     Khulumani Moyo, Shadreck Mbewe
//
// This script:
//   1. Removes Boikanyo/Kamuhelo/Tshiamo/Khulumani/Shadreck from Hatfield Square
//   2. Creates their correct scans at Indus Menlyn
//
// Preview:  pnpm tsx prisma/seed-moment-dube-fix-sites.ts
// Apply:    pnpm tsx prisma/seed-moment-dube-fix-sites.ts --apply

import { prisma } from "@/lib/prisma";

const FOREMAN_NAME = "Moment Dube";
const FOREMAN_ID = process.env.FOREMAN_ID;

// ---------------------------------------------------------------------------
// Hatfield Square – keep ONLY these employees (delete everyone else)
// ---------------------------------------------------------------------------
const HATFIELD_PATTERN = "HATFIELD";

const hatfieldRoster: Record<string, string[]> = {
  "2026-07-06": ["AKANI MNISI", "THOMAS MAT"],
  "2026-07-07": ["AKANI MNISI", "THOMAS MAT"],
  "2026-07-08": ["AKANI MNISI", "THOMAS MAT", "Sbusiso Mahlangu"],
  "2026-07-09": ["AKANI MNISI", "THOMAS MAT"],
  "2026-07-10": ["AKANI MNISI", "THOMAS MAT"],
};

// ---------------------------------------------------------------------------
// Indus Menlyn – create scans for these employees
// ---------------------------------------------------------------------------
const MENLYN_PATTERN = "MENLYN";
const MENLYN_FALLBACK = "INDUS";

const menlynRoster: Record<string, string[]> = {
  "2026-07-04": [
    "BOIKANYO MA",
    "Kamogelo Moteleng",
    "Tsabalala Tshiamo",
    "Prosper Moyo",
    "SHADRECK M",
  ],
  "2026-07-05": ["Kamogelo Moteleng"],
  "2026-07-06": [
    "BOIKANYO MA",
    "Kamogelo Moteleng",
    "Tsabalala Tshiamo",
    "SHADRECK M",
  ],
  "2026-07-07": [
    "BOIKANYO MA",
    "Kamogelo Moteleng",
    "Tsabalala Tshiamo",
    "Prosper Moyo",
  ],
  "2026-07-08": [
    "BOIKANYO MA",
    "Kamogelo Moteleng",
    "Tsabalala Tshiamo",
    "Prosper Moyo",
  ],
  "2026-07-09": ["BOIKANYO MA", "Kamogelo Moteleng", "Tsabalala Tshiamo"],
  "2026-07-10": ["BOIKANYO MA", "Kamogelo Moteleng", "Tsabalala Tshiamo"],
};

// ---------------------------------------------------------------------------
// Helpers
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

function parseName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

async function findEmployee(fullName: string) {
  const { firstName, lastName } = parseName(fullName);
  return prisma.employee.findFirst({
    where: {
      firstName: { equals: firstName, mode: "insensitive" },
      lastName: { equals: lastName, mode: "insensitive" },
    },
    select: { id: true, firstName: true, lastName: true, qrCodeValue: true },
  });
}

async function resolveSiteDay(
  siteId: string,
  foremanId: string,
  workDateObj: Date,
) {
  let siteDay = await prisma.siteDay.findFirst({
    where: { siteId, foremanId, workDate: workDateObj },
    select: { id: true },
  });

  if (!siteDay) {
    const other = await prisma.siteDay.findFirst({
      where: { siteId, workDate: workDateObj },
      select: { id: true, foremanId: true },
    });

    if (!other) {
      siteDay = await prisma.siteDay.create({
        data: { siteId, foremanId, workDate: workDateObj },
        select: { id: true },
      });
    } else if (other.foremanId !== foremanId) {
      siteDay = await prisma.siteDay.update({
        where: { id: other.id },
        data: { foremanId },
        select: { id: true },
      });
    } else {
      siteDay = { id: other.id };
    }
  }

  return siteDay;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const APPLY = process.argv.includes("--apply");
  let created = 0;
  let deleted = 0;
  let skipped = 0;

  const sites = await prisma.site.findMany({
    select: { id: true, code: true, name: true },
  });

  const foremen = await prisma.foreman.findMany({
    select: { id: true, user: { select: { name: true } } },
  });

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
    throw new Error(`Foreman not found: "${FOREMAN_ID ?? FOREMAN_NAME}"`);
  }

  const hatfieldSite = sites.find((s) =>
    normalizeName(s.name).includes(normalizeName(HATFIELD_PATTERN)),
  );
  if (!hatfieldSite) throw new Error(`Hatfield Square site not found`);

  const menlynSite =
    sites.find((s) =>
      normalizeName(s.name).includes(normalizeName(MENLYN_PATTERN)),
    ) ??
    sites.find((s) =>
      normalizeName(s.name).includes(normalizeName(MENLYN_FALLBACK)),
    );
  if (!menlynSite) throw new Error(`Indus Menlyn site not found`);

  console.log(`\nForeman: ${targetForeman.user?.name ?? FOREMAN_NAME}`);
  console.log(`Hatfield: ${hatfieldSite.code} - ${hatfieldSite.name}`);
  console.log(`Menlyn:   ${menlynSite.code} - ${menlynSite.name}`);
  console.log("=".repeat(72));

  // =========================================================================
  // STEP 1: Resync Hatfield Square
  // Keep only Akani/Thomas/Sbusiso on their approved dates.
  // Delete any other employees that were seeded there previously.
  // =========================================================================
  console.log("\n--- HATFIELD SQUARE ---");

  for (const [workDate, approvedNames] of Object.entries(hatfieldRoster)) {
    const workDateObj = dateUTC(workDate);

    const siteDay = await prisma.siteDay.findFirst({
      where: {
        siteId: hatfieldSite.id,
        foremanId: targetForeman.id,
        workDate: workDateObj,
      },
      select: { id: true },
    });

    if (!siteDay) {
      console.log(`[${workDate}] No SiteDay – nothing to clean`);
      continue;
    }

    // Resolve approved employee IDs
    const approvedEmployees = [];
    for (const fullName of approvedNames) {
      const emp = await findEmployee(fullName);
      if (!emp) throw new Error(`Employee not found: ${fullName}`);
      approvedEmployees.push(emp);
    }
    const approvedIds = approvedEmployees.map((e) => e.id);

    // Delete non-approved scans
    const toDelete = await prisma.attendanceScan.findMany({
      where: { siteDayId: siteDay.id, employeeId: { notIn: approvedIds } },
      include: { employee: { select: { firstName: true, lastName: true } } },
    });

    for (const scan of toDelete) {
      console.log(
        `[${workDate}] Hatfield DELETE → ${scan.employee.firstName} ${scan.employee.lastName}`,
      );
      if (APPLY) await prisma.attendanceScan.delete({ where: { id: scan.id } });
      deleted++;
    }

    // Confirm approved scans exist
    for (const emp of approvedEmployees) {
      const existing = await prisma.attendanceScan.findFirst({
        where: { siteDayId: siteDay.id, employeeId: emp.id },
        select: { id: true },
      });
      if (existing) {
        console.log(
          `[${workDate}] Hatfield KEEP → ${emp.firstName} ${emp.lastName}`,
        );
        skipped++;
        continue;
      }

      // Check if already scanned on this date at ANY site (unique constraint)
      const anyDateScan = await prisma.attendanceScan.findFirst({
        where: { employeeId: emp.id, workDate: workDateObj },
        select: { id: true, siteId: true },
      });

      if (anyDateScan) {
        // Already scanned elsewhere on same date - skip
        console.log(
          `[${workDate}] Hatfield SKIP (already scanned) → ${emp.firstName} ${emp.lastName}`,
        );
        skipped++;
        continue;
      }

      console.log(
        `[${workDate}] Hatfield CREATE → ${emp.firstName} ${emp.lastName}`,
      );
      if (APPLY) {
        await prisma.attendanceScan.create({
          data: {
            siteDayId: siteDay.id,
            employeeId: emp.id,
            workDate: workDateObj,
            siteId: hatfieldSite.id,
            dayRateAtScan: 0,
            qrPayload: emp.qrCodeValue!,
            scanType: "REGULAR",
            scannedAt: new Date(`${workDate}T09:00:00+02:00`),
          },
        });
      }
      created++;
    }
  }

  // =========================================================================
  // STEP 2: Create / confirm scans at Indus Menlyn
  // =========================================================================
  console.log("\n--- INDUS MENLYN ---");

  for (const [workDate, employeeNames] of Object.entries(menlynRoster)) {
    const workDateObj = dateUTC(workDate);

    const siteDay = await resolveSiteDay(
      menlynSite.id,
      targetForeman.id,
      workDateObj,
    );

    console.log(`\n${workDate}`);

    for (const fullName of employeeNames) {
      const emp = await findEmployee(fullName);
      if (!emp) throw new Error(`Employee not found: ${fullName}`);

      const existing = await prisma.attendanceScan.findFirst({
        where: { siteDayId: siteDay.id, employeeId: emp.id },
        select: { id: true },
      });

      if (existing) {
        console.log(
          `[${workDate}] Menlyn KEEP → ${emp.firstName} ${emp.lastName}`,
        );
        skipped++;
        continue;
      }

      // Also check if this employee was scanned at Hatfield on the same date
      // (wrong site) – if so, delete that scan first
      const wrongSiteScan = await prisma.attendanceScan.findFirst({
        where: {
          employeeId: emp.id,
          workDate: workDateObj,
          siteId: hatfieldSite.id,
        },
        select: { id: true },
      });

      if (wrongSiteScan) {
        console.log(
          `[${workDate}] Menlyn MOVE (delete Hatfield) → ${emp.firstName} ${emp.lastName}`,
        );
        if (APPLY) {
          await prisma.attendanceScan.delete({
            where: { id: wrongSiteScan.id },
          });
        }
        deleted++;
        // Now create at Menlyn
      } else {
        // Check if already scanned on this date at ANY site
        const anyDateScan = await prisma.attendanceScan.findFirst({
          where: { employeeId: emp.id, workDate: workDateObj },
          select: { id: true },
        });
        if (anyDateScan) {
          console.log(
            `[${workDate}] Menlyn SKIP (already scanned elsewhere) → ${emp.firstName} ${emp.lastName}`,
          );
          skipped++;
          continue;
        }
      }

      console.log(
        `[${workDate}] Menlyn CREATE → ${emp.firstName} ${emp.lastName}`,
      );

      if (APPLY) {
        await prisma.attendanceScan.create({
          data: {
            siteDayId: siteDay.id,
            employeeId: emp.id,
            workDate: workDateObj,
            siteId: menlynSite.id,
            dayRateAtScan: 0,
            qrPayload: emp.qrCodeValue!,
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
      `Applied: ${created} created, ${deleted} deleted/moved, ${skipped} kept.`,
    );
  } else {
    console.log(
      `Preview: ${created} to create, ${deleted} to delete/move, ${skipped} to keep. Add --apply to execute.`,
    );
  }
}

main()
  .catch((error) => {
    console.error("Moment Dube fix-sites seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
