import { prisma } from "../lib/prisma";

const SITE_CODE = "6710";

const attendance: Record<string, string[]> = {
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
    "Lamulani Nyoni",
    "Xolisani Ncube",
    "Masonwabe Mabetu",
    "Gift Moyo",
    "Langton Sibanda",
    "Neverson Banga",
    "Nduna Moyo",
    "Nduduzo Ncube",
    "Willard Msebele",
    "Ntokozo Sibanda",
  ],
  "2026-07-08": [
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
    "Willard Msebele",
    "Ntokozo Sibanda",
    "Godknows Msebele",
  ],
};

// Keep aligned with seeding/card alias behavior.
const NAME_ALIASES: Record<string, string> = {
  "xolisani ncube": "xolisani nc",
  "langton sibanda": "langton sib",
  "ntokozo sbanda": "ntokozo sibanda",
  "matshidiso kopan": "matshidiso kapok",
  "lamlani nyoni": "lamulani nyoni",
  "wiallard msebele": "willard msebele",
};

function normalizeName(input: string) {
  return String(input ?? "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeWithAlias(input: string) {
  const n = normalizeName(input);
  return NAME_ALIASES[n] ?? n;
}

function dateUTC(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

async function main() {
  const apply = process.argv.includes("--apply");

  const site = await prisma.site.findFirst({
    where: { code: SITE_CODE },
    select: { id: true, code: true, name: true },
  });

  if (!site) throw new Error(`Site ${SITE_CODE} not found.`);

  const dates = Object.keys(attendance).sort();
  const minDate = dates[0]!;
  const maxDate = dates[dates.length - 1]!;

  const expectedByDate = new Map<string, Set<string>>();
  for (const [date, names] of Object.entries(attendance)) {
    const set = new Set<string>();
    for (const name of names) {
      const raw = normalizeName(name);
      const aliased = normalizeWithAlias(name);
      set.add(raw);
      set.add(aliased);
    }
    expectedByDate.set(date, set);
  }

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
      workDate: true,
      scanType: true,
      direction: true,
      employee: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: [{ workDate: "asc" }, { createdAt: "asc" }],
  });

  const toDelete = scans.filter((scan) => {
    const date = scan.workDate.toISOString().slice(0, 10);
    const expected = expectedByDate.get(date);
    if (!expected) return false;

    const fullName = `${scan.employee.firstName} ${scan.employee.lastName}`;
    const normalized = normalizeName(fullName);
    const normalizedAliased = normalizeWithAlias(fullName);

    return !expected.has(normalized) && !expected.has(normalizedAliased);
  });

  console.log(
    `${apply ? "Applying" : "Previewing"} reconciliation for ${site.code} ${site.name}`,
  );
  console.log(`Scans in window: ${scans.length}`);
  console.log(`Scans to delete: ${toDelete.length}`);

  for (const s of toDelete) {
    const date = s.workDate.toISOString().slice(0, 10);
    console.log(
      `- DELETE ${date} | ${s.employee.firstName} ${s.employee.lastName} | ${s.scanType}/${s.direction} | ${s.id}`,
    );
  }

  if (!apply) return;

  let deleted = 0;
  for (const s of toDelete) {
    await prisma.attendanceScan.delete({ where: { id: s.id } });
    deleted += 1;
  }

  console.log(`\nDone. Deleted ${deleted} out-of-roster scans.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
