import { prisma } from "@/lib/prisma";

const FOREMAN_ALIASES = [
  "Siphiwe Ngomani",
  "Sphiwe Ngomani",
  "Siphiwe Ngomane",
  "SIPHIWE NGO",
];

async function main() {
  const foremen = await prisma.foreman.findMany({
    where: {
      user: {
        name: {
          in: FOREMAN_ALIASES,
        },
      },
    },
    select: {
      id: true,
      user: { select: { name: true } },
    },
  });

  const foremanIds = foremen.map((f) => f.id);

  const days = await prisma.siteDay.findMany({
    where: {
      site: { code: "6606" },
      workDate: {
        gte: new Date("2026-07-06T00:00:00.000Z"),
        lte: new Date("2026-07-09T00:00:00.000Z"),
      },
      ...(foremanIds.length > 0 ? { foremanId: { in: foremanIds } } : {}),
    },
    select: {
      id: true,
      workDate: true,
      foreman: { select: { user: { select: { name: true } } } },
      site: { select: { code: true, name: true } },
      scans: {
        select: {
          employee: {
            select: { firstName: true, lastName: true, qrCodeValue: true },
          },
        },
      },
    },
    orderBy: [{ workDate: "asc" }],
  });

  console.dir({ foremen, days }, { depth: null });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
