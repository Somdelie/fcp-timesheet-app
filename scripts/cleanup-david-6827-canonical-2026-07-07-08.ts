import { prisma } from "../lib/prisma";

const SITE_CODE = "6827";

const CANONICAL_BY_DATE: Record<string, string[]> = {
  "2026-07-07": ["david swathedi", "sthephens s", "lucas molo"],
  "2026-07-08": [
    "david swathedi",
    "sthephens s",
    "lucas molo",
    "koketso mo",
    "kgothatso",
    "jerry mnguni",
    "bonolo mar",
    "tshepiso ch",
    "tshepiso mm",
  ],
};

function normalizeName(input: string) {
  return String(input ?? "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const apply = process.argv.includes("--apply");

  const site = await prisma.site.findFirst({
    where: { code: SITE_CODE },
    select: { id: true, code: true, name: true },
  });
  if (!site) throw new Error(`Site ${SITE_CODE} not found`);

  const scans = await prisma.attendanceScan.findMany({
    where: {
      siteId: site.id,
      workDate: {
        gte: new Date("2026-07-07T00:00:00.000Z"),
        lte: new Date("2026-07-08T00:00:00.000Z"),
      },
    },
    select: {
      id: true,
      workDate: true,
      employee: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ workDate: "asc" }, { employee: { firstName: "asc" } }],
  });

  const toDelete = scans.filter((s) => {
    const d = s.workDate.toISOString().slice(0, 10);
    const allowed = new Set(CANONICAL_BY_DATE[d] ?? []);
    const full = normalizeName(
      `${s.employee.firstName} ${s.employee.lastName}`,
    );
    return !allowed.has(full);
  });

  console.log(
    `${apply ? "Applying" : "Previewing"} cleanup for ${site.code} ${site.name}`,
  );
  console.log(`Scans in range: ${scans.length}`);
  console.log(`Scans to delete: ${toDelete.length}`);

  for (const s of toDelete) {
    const d = s.workDate.toISOString().slice(0, 10);
    console.log(`- ${d} | ${s.employee.firstName} ${s.employee.lastName}`);
  }

  if (!apply) return;

  for (const s of toDelete) {
    await prisma.attendanceScan.delete({ where: { id: s.id } });
  }

  console.log(`Done. Deleted ${toDelete.length} scans.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
