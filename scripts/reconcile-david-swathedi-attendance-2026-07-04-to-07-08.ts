import { prisma } from "../lib/prisma";

const SITE_CODES = ["6745", "6827"];
const DAY_ROSTER: Record<string, Record<string, string[]>> = {
  "6745": {
    "2026-07-04": ["David Swathedi"],
    "2026-07-05": ["David Swathedi"],
    "2026-07-06": ["David Swathedi"],
  },
  "6827": {
    "2026-07-07": ["David Swathedi", "Stephen Sithole", "Lucus Molokomme"],
    "2026-07-08": [
      "Koletso Motau",
      "Tshepiso Chabalala",
      "Tshepiso Mmatli",
      "Stephen Sithole",
      "Lucus Molokomme",
      "Basil Pelo",
      "Jerry Mguni",
      "Bonolo Marema",
      "David Swathedi",
    ],
  },
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

async function main() {
  const apply = process.argv.includes("--apply");

  console.log(`\nReconciling David Swathedi attendance`);
  console.log("=".repeat(80));

  for (const siteCode of SITE_CODES) {
    const roster = DAY_ROSTER[siteCode];
    if (!roster) continue;

    const site = await prisma.site.findFirst({
      where: { code: siteCode },
      select: { id: true, code: true, name: true },
    });

    if (!site) {
      console.log(`\n[${siteCode}] Site not found, skipping`);
      continue;
    }

    const dayDates = Object.keys(roster);
    const minDate = dayDates.slice().sort()[0]!;
    const maxDate = dayDates.slice().sort().at(-1)!;

    const scans = await prisma.attendanceScan.findMany({
      where: {
        siteId: site.id,
        workDate: {
          gte: dateUTC(minDate),
          lte: dateUTC(maxDate),
        },
      },
      select: {
        id: true,
        employeeId: true,
        workDate: true,
        employee: { select: { firstName: true, lastName: true } },
      },
      orderBy: { workDate: "asc" },
    });

    console.log(`\n[${siteCode} ${site.name}]`);
    console.log(`Scans in window: ${scans.length}`);

    const toDelete: typeof scans = [];

    for (const scan of scans) {
      const workDateStr = scan.workDate.toISOString().slice(0, 10);
      const expectedNames = roster[workDateStr];

      if (!expectedNames) {
        console.log(
          `  DELETE ${workDateStr} | ${scan.employee.firstName} ${scan.employee.lastName} | NOT IN ROSTER (date not expected)`,
        );
        toDelete.push(scan);
        continue;
      }

      const scanFullName = `${scan.employee.firstName} ${scan.employee.lastName}`;
      const scanNormalized = normalizeName(scanFullName);

      const found = expectedNames.some(
        (name) => normalizeName(name) === scanNormalized,
      );

      if (!found) {
        console.log(
          `  DELETE ${workDateStr} | ${scanFullName} | NOT IN ROSTER (person not listed for date)`,
        );
        toDelete.push(scan);
      }
    }

    console.log(`\nScans to delete: ${toDelete.length}`);

    if (toDelete.length > 0 && !apply) {
      console.log("\nRun with --apply to delete these scans");
      continue;
    }

    for (const scan of toDelete) {
      if (!apply) continue;

      await prisma.attendanceScan.delete({
        where: { id: scan.id },
      });

      const workDateStr = scan.workDate.toISOString().slice(0, 10);
      console.log(
        `  ✓ Deleted ${workDateStr} | ${scan.employee.firstName} ${scan.employee.lastName}`,
      );
    }

    if (apply && toDelete.length > 0) {
      console.log(`Done. Deleted ${toDelete.length} out-of-roster scans.`);
    }
  }

  console.log("\n" + "=".repeat(80));
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
