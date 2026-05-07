import { prisma } from "../lib/prisma";

// Corrected structure for David Nkwinika, period 2026-04-25 → 2026-05-08
// Source of truth: WhatsApp notes sent 07/05/2026 15:34
//
// 4 working days (Mon 04 – Thu 07 May):
//   Day 1  Mon 04: 6663 Rugged SA  D+4  | 6664 Package IT  0+3
//   Day 2  Tue 05: 6663 Rugged SA  0+3  | 6664 Package IT  D+5
//   Day 3  Wed 06: 6663 Rugged SA  0+2  | 6664 Package IT  D+7
//   Day 4  Thu 07: 6663 Rugged SA  0+3  | 6664 Package IT  D+6
//
// Problem: the generated PDF swapped the two sites — crew and David's
// own scan were recorded at the wrong site codes.

const DAVID_FOREMAN_ID = "cmnsi4jgc000509jun9gzljc6";
const PERIOD_START = new Date("2026-04-25T00:00:00Z");
const PERIOD_END = new Date("2026-05-09T00:00:00Z"); // exclusive

// Worker crew — each tuple is [firstName, lastName, correctSiteCode]
const CREW_ASSIGNMENTS: [string, string, string][] = [
  // 6663 — RIETVLEI BP - RUGGED SA
  ["Louis", "Ramohadi", "6663"],
  ["Micol", "Mashile", "6663"],
  ["Mahlodi", "Setata", "6663"],
  // 6664 — RIETVLEI BP - PACKAGE IT
  ["Solomon", "Chauke", "6664"],
  ["Mmamoloko", "Mathobela", "6664"],
  ["Nhlalala", "Sibisi", "6664"],
  ["Manosi", "Mahasha", "6664"],
  ["Cynthia", "Boloka", "6664"],
  ["Kenny", "Makhubele", "6664"],
];

// David's own attendance: which site he should be at on each day
// "0" in the WhatsApp entry means David was NOT at that site → he was at the other one
// Based directly on handwritten sheet in image
// Rule:
// - If entry starts with D+X → David belongs to that site
// - Plain numbers like 2 or 3 mean crew only, not David

const DAVID_CORRECT_SITE: Record<string, string> = {
  "2026-04-25": "6664", // 6664 = D+2
  "2026-04-26": "6664", // 6664 = D+1
  "2026-04-27": "6664", // 6664 = D+2
  "2026-04-28": "6664", // 6664 = D+3
  "2026-04-29": "6664", // 6664 = D+5
  "2026-04-30": "6663", // 6663 = D+6
  "2026-05-01": "6663", // 6663 = D+6
  "2026-05-02": "6663", // 6663 = D+5
  "2026-05-03": "6664", // 6664 = D+4
  "2026-05-04": "6663", // 6663 = D+4
  "2026-05-05": "6664", // 6664 = D+5
  "2026-05-06": "6664", // 6664 = D+7
  "2026-05-07": "6664", // 6664 = D+6
};

// ─── helpers ──────────────────────────────────────────────────────────────────

async function getOrCreateSiteDay(
  siteId: string,
  workDate: Date,
): Promise<string> {
  const existing = await prisma.siteDay.findUnique({
    where: {
      siteId_foremanId_workDate: {
        siteId,
        foremanId: DAVID_FOREMAN_ID,
        workDate,
      },
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.siteDay.create({
    data: { siteId, foremanId: DAVID_FOREMAN_ID, workDate },
    select: { id: true },
  });
  console.log(
    `  + created SiteDay  site=${siteId}  date=${workDate.toISOString().slice(0, 10)}`,
  );
  return created.id;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Resolve site IDs
  const sites = await prisma.site.findMany({
    where: { code: { in: ["6663", "6664"] } },
    select: { id: true, code: true, name: true },
  });
  const byCode = Object.fromEntries(sites.map((s) => [s.code, s]));
  console.log("Sites:");
  for (const s of sites) console.log(`  ${s.code} → ${s.id}  (${s.name})`);

  let totalMoved = 0;

  // ── 1. Fix crew workers ────────────────────────────────────────────────────
  console.log("\n── Crew worker fixes ──");
  for (const [firstName, lastName, correctCode] of CREW_ASSIGNMENTS) {
    const correctSite = byCode[correctCode];

    const worker = await prisma.employee.findFirst({
      where: {
        firstName: { contains: firstName, mode: "insensitive" },
        lastName: { contains: lastName, mode: "insensitive" },
      },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!worker) {
      console.warn(`  NOT FOUND: ${firstName} ${lastName}`);
      continue;
    }

    // Search ALL sites — scans may be at a completely different site, not just the other Rietvlei one
    const wrongScans = await prisma.attendanceScan.findMany({
      where: {
        employeeId: worker.id,
        siteId: { not: correctSite.id },
        workDate: { gte: PERIOD_START, lt: PERIOD_END },
      },
      select: { id: true, workDate: true, site: { select: { code: true } } },
    });

    if (wrongScans.length === 0) {
      console.log(
        `  OK  ${worker.firstName} ${worker.lastName} — no mismatched scans`,
      );
      continue;
    }

    for (const scan of wrongScans) {
      const siteDayId = await getOrCreateSiteDay(correctSite.id, scan.workDate);
      await prisma.attendanceScan.update({
        where: { id: scan.id },
        data: { siteId: correctSite.id, siteDayId },
      });
      console.log(
        `  ✓ Moved ${worker.firstName} ${worker.lastName}  ${isoDate(scan.workDate)}  ${scan.site?.code ?? "?"} → ${correctCode}`,
      );
      totalMoved++;
    }
  }

  // ── 2. Fix David's own attendance scan ────────────────────────────────────
  console.log("\n── David's own scan fixes ──");

  const david = await prisma.employee.findFirst({
    where: {
      firstName: { contains: "David", mode: "insensitive" },
      lastName: { contains: "Nkwinika", mode: "insensitive" },
    },
    select: { id: true, firstName: true, lastName: true },
  });

  if (!david) {
    console.warn(
      "  David Nkwinika employee record not found — skipping foreman scan fix",
    );
  } else {
    // No siteId filter — his scan for some dates (e.g. Apr 30) may be at a site other than 6663/6664
    const davidScans = await prisma.attendanceScan.findMany({
      where: {
        employeeId: david.id,
        workDate: { gte: PERIOD_START, lt: PERIOD_END },
      },
      select: {
        id: true,
        workDate: true,
        siteId: true,
        site: { select: { code: true } },
      },
      orderBy: { workDate: "asc" },
    });

    console.log(
      `  David has ${davidScans.length} scan(s) across all sites in period`,
    );

    for (const scan of davidScans) {
      const dateKey = isoDate(scan.workDate);
      const shouldBeCode = DAVID_CORRECT_SITE[dateKey];

      if (!shouldBeCode) {
        console.log(
          `  --  ${dateKey} | currently at ${scan.site?.code} | not in correction map — skipping`,
        );
        continue;
      }

      const shouldBeSite = byCode[shouldBeCode];
      if (scan.siteId === shouldBeSite.id) {
        console.log(`  OK  ${dateKey} | David already at ${shouldBeCode}`);
        continue;
      }

      const siteDayId = await getOrCreateSiteDay(
        shouldBeSite.id,
        scan.workDate,
      );
      await prisma.attendanceScan.update({
        where: { id: scan.id },
        data: { siteId: shouldBeSite.id, siteDayId },
      });
      console.log(
        `  ✓ Moved David  ${dateKey}  ${scan.site?.code} → ${shouldBeCode} ${shouldBeSite.name}`,
      );
      totalMoved++;
    }
  }

  console.log(`\nDone. ${totalMoved} scan(s) corrected.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
