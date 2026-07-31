import { prisma } from "../lib/prisma";

const FOREMAN_NAMES = ["Tiisetso Gift Malatji", "Vusi Nyathi"];

async function main() {
  const [sitesByCode, sitesByName, prices, foremen, existing] =
    await Promise.all([
      prisma.site.findMany({
        where: { code: "6511" },
        select: { id: true, code: true, name: true },
      }),
      prisma.site.findMany({
        where: { name: { contains: "etwatwa", mode: "insensitive" } },
        select: { id: true, code: true, name: true },
      }),
      prisma.overtimePrice.findMany({
        select: { id: true, label: true, rate: true, isActive: true },
        orderBy: { label: "asc" },
      }),
      prisma.foreman.findMany({
        where: {
          OR: [
            { user: { name: { contains: "Malatji", mode: "insensitive" } } },
            { user: { name: { contains: "Nyathi", mode: "insensitive" } } },
          ],
        },
        select: {
          id: true,
          user: { select: { name: true, email: true } },
          siteAssignments: {
            where: { OR: [{ endsOn: null }, { endsOn: { gte: new Date("2026-07-01") } }] },
            select: {
              siteId: true,
              startsOn: true,
              endsOn: true,
              site: { select: { code: true, name: true } },
            },
          },
        },
      }),
      prisma.overtimeEntry.findMany({
        where: {
          workDate: {
            gte: new Date("2026-07-01T00:00:00.000Z"),
            lt: new Date("2026-08-01T00:00:00.000Z"),
          },
          foreman: {
            user: {
              name: { in: FOREMAN_NAMES, mode: "insensitive" },
            },
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
          site: { select: { code: true, name: true } },
        },
        orderBy: [{ workDate: "asc" }, { createdAt: "asc" }],
      }),
    ]);

  console.log("sites by code 6511");
  console.dir(sitesByCode, { depth: null });
  console.log("sites matching 'etwatwa'");
  console.dir(sitesByName, { depth: null });
  console.log("overtime prices");
  console.dir(
    prices.map((p) => ({ ...p, rate: Number(p.rate) })),
    { depth: null },
  );
  console.log("matching foremen");
  console.dir(foremen, { depth: null });
  console.log("existing overtime entries (July 2026, these foremen)");
  console.dir(
    existing.map((e) => ({
      ...e,
      hoursWorked: Number(e.hoursWorked),
      rate: Number(e.overtimePrice.rate),
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
