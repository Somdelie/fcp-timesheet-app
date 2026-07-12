import { prisma } from "../lib/prisma";

async function main() {
  const rows = await prisma.employee.findMany({
    where: {
      OR: [
        { firstName: { contains: "bonolo", mode: "insensitive" } },
        { lastName: { contains: "bonolo", mode: "insensitive" } },
        { lastName: { contains: "mar", mode: "insensitive" } },
      ],
    },
    select: { id: true, firstName: true, lastName: true, qrCodeValue: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  console.log(JSON.stringify(rows, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
