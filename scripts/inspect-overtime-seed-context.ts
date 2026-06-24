import { prisma } from "../lib/prisma";

async function main() {
  const [site, prices, admins, foremen, existing] = await Promise.all([
    prisma.site.findUnique({
      where: { code: "6745" },
      select: {
        id: true,
        code: true,
        name: true,
        foremanAssignments: {
          where: {
            OR: [{ endsOn: null }, { endsOn: { gte: new Date("2026-06-10") } }],
          },
          select: {
            foremanId: true,
            startsOn: true,
            endsOn: true,
            foreman: {
              select: {
                id: true,
                user: { select: { name: true, email: true } },
              },
            },
          },
          orderBy: { startsOn: "desc" },
        },
      },
    }),
    prisma.overtimePrice.findMany({
      select: { id: true, label: true, rate: true, isActive: true },
      orderBy: { label: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true, name: true, email: true },
      take: 10,
    }),
    prisma.foreman.findMany({
      where: {
        user: {
          name: {
            in: [
              "LIMUKANI NDLOVU",
              "ALFRED SIBANDA",
              "DAVID SWATHEDI",
              "MELULEKI NDLOVU",
              "MOMENT DUBE",
            ],
            mode: "insensitive",
          },
        },
      },
      select: { id: true, user: { select: { name: true, email: true } } },
    }),
    prisma.overtimeEntry.findMany({
      where: {
        site: { code: "6745" },
        workDate: {
          gte: new Date("2026-06-10T00:00:00.000Z"),
          lt: new Date("2026-06-13T00:00:00.000Z"),
        },
      },
      select: {
        id: true,
        workDate: true,
        note: true,
        numberOfEmployees: true,
        hoursWorked: true,
        overtimePrice: { select: { label: true, rate: true } },
        foreman: { select: { user: { select: { name: true } } } },
      },
      orderBy: [{ workDate: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  console.log("site");
  console.dir(site, { depth: null });
  console.log("prices");
  console.dir(
    prices.map((price) => ({
      ...price,
      rate: Number(price.rate),
    })),
    { depth: null },
  );
  console.log("admins");
  console.dir(admins, { depth: null });
  console.log("matching foremen");
  console.dir(foremen, { depth: null });
  console.log("existing overtime");
  console.dir(
    existing.map((entry) => ({
      ...entry,
      hoursWorked: Number(entry.hoursWorked),
      rate: Number(entry.overtimePrice.rate),
    })),
    { depth: null },
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
