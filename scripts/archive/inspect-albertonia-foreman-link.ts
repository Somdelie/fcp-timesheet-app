import { prisma } from "../../lib/prisma";

async function main() {
  const foremen = await prisma.foreman.findMany({
    where: {
      user: { name: { contains: "Albertonia", mode: "insensitive" } },
    },
    select: {
      id: true,
      userId: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          employee: { select: { id: true, firstName: true, lastName: true, qrCodeValue: true } },
        },
      },
    },
  });
  console.log("foreman(s) named Albertonia*");
  console.dir(foremen, { depth: null });

  const employees = await prisma.employee.findMany({
    where: {
      OR: [
        { firstName: { contains: "Albertonia", mode: "insensitive" } },
        { lastName: { contains: "Masango", mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      qrCodeValue: true,
      isActive: true,
      userId: true,
    },
  });
  console.log("employee record(s) matching Albertonia/Masango");
  console.dir(employees, { depth: null });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
