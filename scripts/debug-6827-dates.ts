import { prisma } from "../lib/prisma";

async function main() {
  const site = await prisma.site.findFirst({
    where: { code: "6827" },
    select: { id: true },
  });
  if (!site) throw new Error("Site 6827 not found");

  const rows = await prisma.attendanceScan.findMany({
    where: { siteId: site.id },
    select: {
      id: true,
      workDate: true,
      employee: { select: { firstName: true, lastName: true } },
    },
    orderBy: { workDate: "asc" },
  });

  for (const r of rows) {
    // Print raw JS Date value as well as ISO
    console.log(
      `${r.workDate.toISOString()} | ${r.workDate.getTime()} | ${r.employee.firstName} ${r.employee.lastName}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
