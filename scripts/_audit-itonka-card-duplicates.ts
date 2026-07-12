import { prisma } from "../lib/prisma";

async function main() {
  const cards = [
    "EMP-555D2970A70DD020",
    "83E52E6B308D0CD4",
    "796889A33F6632C6",
    "83C14E110A0CC373",
    "96FBEE5F9891B7D8",
    "8317B9CC955B812A",
    "07BA3A95A62D3142",
    "37269B7F51971F44",
    "6B30ECD0F07E428A",
    "EC596F8E49128F94",
  ];

  const byCard = await prisma.employee.findMany({
    where: { qrCodeValue: { in: cards } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      qrCodeValue: true,
      createdAt: true,
      isActive: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const surnames = [
    "Rivombo",
    "Mashimbye",
    "Motha",
    "Moletsane",
    "Kapa",
    "Majola",
    "Mofukeng",
    "Zondo",
    "Makhafula",
    "Mabasa",
  ];

  const bySurname = await prisma.employee.findMany({
    where: {
      OR: surnames.map((s) => ({
        lastName: { equals: s, mode: "insensitive" as const },
      })),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      qrCodeValue: true,
      createdAt: true,
      isActive: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  console.log("=== BY CARD ===");
  console.log(JSON.stringify(byCard, null, 2));
  console.log("=== BY SURNAME ===");
  console.log(JSON.stringify(bySurname, null, 2));

  const grouped = new Map<string, typeof bySurname>();
  for (const e of bySurname) {
    const key = `${e.firstName} ${e.lastName}`.trim().toLowerCase();
    grouped.set(key, [...(grouped.get(key) ?? []), e]);
  }

  const dupes = [...grouped.entries()].filter(([, list]) => list.length > 1);
  console.log("=== DUPLICATE SAME FULL NAME ===");
  console.log(JSON.stringify(dupes, null, 2));

  const fuzzy = await prisma.employee.findMany({
    where: {
      OR: [
        { firstName: { contains: "thokozani", mode: "insensitive" } },
        { firstName: { contains: "tankiso", mode: "insensitive" } },
        { firstName: { contains: "thabang", mode: "insensitive" } },
        { lastName: { contains: "mabasa", mode: "insensitive" } },
        { lastName: { contains: "majola", mode: "insensitive" } },
        { lastName: { contains: "mofukeng", mode: "insensitive" } },
        { lastName: { contains: "zondo", mode: "insensitive" } },
        { lastName: { contains: "makha", mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      qrCodeValue: true,
      createdAt: true,
      isActive: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  console.log("=== FUZZY NAME CANDIDATES ===");
  console.log(JSON.stringify(fuzzy, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
