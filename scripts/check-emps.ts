import { prisma } from "../lib/prisma";

async function main() {
  const emps = await prisma.employee.findMany({
    where: {
      OR: [
        { firstName: { contains: "lucus", mode: "insensitive" } },
        { lastName: { contains: "lucus", mode: "insensitive" } },
        { firstName: { contains: "lucas", mode: "insensitive" } },
        { lastName: { contains: "lucas", mode: "insensitive" } },
        { firstName: { contains: "tshepiso", mode: "insensitive" } },
      ],
    },
    select: { id: true, firstName: true, lastName: true, qrCodeValue: true },
  });
  console.log(JSON.stringify(emps, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
