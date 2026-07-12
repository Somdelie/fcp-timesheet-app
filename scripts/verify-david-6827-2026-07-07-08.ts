import { prisma } from "../lib/prisma";

async function main() {
  const site = await prisma.site.findFirst({
    where: { code: "6827" },
    select: { id: true, code: true, name: true },
  });
  if (!site) throw new Error("Site 6827 not found");

  const rows = await prisma.attendanceScan.findMany({
    where: {
      siteId: site.id,
      workDate: {
        gte: new Date("2026-07-07T00:00:00.000Z"),
        lte: new Date("2026-07-08T00:00:00.000Z"),
      },
    },
    select: {
      workDate: true,
      employee: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ workDate: "asc" }, { employee: { firstName: "asc" } }],
  });

  console.log(`Site ${site.code} ${site.name}`);
  for (const r of rows) {
    const d = r.workDate.toISOString().slice(0, 10);
    console.log(`${d} | ${r.employee.firstName} ${r.employee.lastName}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
