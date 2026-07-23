import { prisma } from "@/lib/prisma";

async function main() {
  const emails = [
    "mbusiseni@gmail.com",
    "balungile@gmail.com",
    "nkala@gmail.com",
    "ephias@gmail.com",
  ];

  const rows = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: {
      email: true,
      employee: {
        select: {
          firstName: true,
          lastName: true,
          defaultDayRate: true,
        },
      },
    },
    orderBy: { email: "asc" },
  });

  for (const row of rows) {
    const employeeName = row.employee
      ? `${row.employee.firstName} ${row.employee.lastName}`.trim()
      : "(no linked employee)";

    console.log(
      `${row.email} | ${employeeName} | defaultDayRate=${row.employee?.defaultDayRate ?? "null"}`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
