import { prisma } from "../lib/prisma";

async function main() {
  const scans = await prisma.attendanceScan.findMany({
    where: {
      workDate: {
        gte: new Date("2026-07-04"),
        lte: new Date("2026-07-08"),
      },
    },
    select: {
      id: true,
      workDate: true,
      employee: { select: { firstName: true, lastName: true } },
      site: { select: { code: true } },
    },
    orderBy: [{ site: { code: "asc" } }, { workDate: "asc" }],
  });

  console.log("David Swathedi team scans:");
  for (const scan of scans) {
    console.log(
      `${scan.workDate.toISOString().slice(0, 10)} | ${scan.site.code} | ${scan.employee.firstName} ${scan.employee.lastName}`,
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
