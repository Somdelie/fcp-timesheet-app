import { prisma } from "@/lib/prisma";

async function main() {
  const rows = await prisma.attendanceScan.findMany({
    where: {
      workDate: {
        gte: new Date("2026-07-06T00:00:00.000Z"),
        lte: new Date("2026-07-09T00:00:00.000Z"),
      },
      site: { code: "6606" },
      employee: {
        OR: [
          {
            firstName: { equals: "Siphiwe", mode: "insensitive" },
            lastName: { equals: "Ngomani", mode: "insensitive" },
          },
          {
            firstName: { equals: "Godknows", mode: "insensitive" },
            lastName: { equals: "Msebele", mode: "insensitive" },
          },
          {
            firstName: { equals: "Smile", mode: "insensitive" },
            lastName: { equals: "Moyo", mode: "insensitive" },
          },
          {
            firstName: { equals: "Thabo", mode: "insensitive" },
            lastName: { equals: "Seko", mode: "insensitive" },
          },
        ],
      },
    },
    select: {
      workDate: true,
      dayRateAtScan: true,
      employee: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ workDate: "asc" }, { employee: { firstName: "asc" } }],
  });

  console.log(rows);

  const totals = new Map<string, { days: number; rateTotal: number }>();

  for (const row of rows) {
    const key = `${row.employee.firstName} ${row.employee.lastName}`.trim();
    const curr = totals.get(key) ?? { days: 0, rateTotal: 0 };
    curr.days += 1;
    curr.rateTotal += Number(row.dayRateAtScan);
    totals.set(key, curr);
  }

  console.log("Totals:");
  for (const [name, t] of totals.entries()) {
    console.log(`${name}: ${t.days} days, R${t.rateTotal}`);
  }

  const gross = Array.from(totals.values()).reduce(
    (s, t) => s + t.rateTotal,
    0,
  );
  const totalDays = Array.from(totals.values()).reduce((s, t) => s + t.days, 0);
  console.log(`Overall: ${totalDays} total days, R${gross}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
