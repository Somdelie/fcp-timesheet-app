import { prisma } from "@/lib/prisma";

async function main() {
  const rows = await prisma.employee.findMany({
    where: {
      OR: [
        {
          firstName: { in: ["Godnows", "Smile", "Thabo", "Siphiwe", "Sphiwe"] },
        },
        { firstName: { contains: "god", mode: "insensitive" } },
        { firstName: { contains: "sm", mode: "insensitive" } },
        { firstName: { contains: "sip", mode: "insensitive" } },
        { firstName: { contains: "sph", mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      qrCodeValue: true,
      defaultDayRate: true,
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  console.log(rows);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
