import { prisma } from "@/lib/prisma";

async function main() {
  const foremen = await prisma.$queryRaw<
    Array<{ id: string; name: string | null; email: string | null }>
  >`
    SELECT
      f.id,
      u.name,
      u.email
    FROM "Foreman" f
    JOIN "User" u ON u.id = f."userId"
    WHERE LOWER(u.name) LIKE '%siphiwe%'
    ORDER BY u.name ASC;
  `;

  const employees = await prisma.$queryRaw<
    Array<{
      id: string;
      firstName: string;
      lastName: string;
      qrCodeValue: string;
    }>
  >`
    SELECT
      id,
      "firstName",
      "lastName",
      "qrCodeValue"
    FROM "Employee"
    WHERE LOWER("firstName") LIKE '%siphiwe%'
    ORDER BY "firstName" ASC, "lastName" ASC;
  `;

  console.log("Foreman rows:");
  console.table(foremen);

  console.log("Employee rows:");
  console.table(employees);

  const ids = foremen.map((f) => f.id);
  if (ids.length) {
    const details = await prisma.foreman.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        user: { select: { name: true, email: true } },
        _count: {
          select: {
            siteDays: true,
            timesheets: true,
            siteAssignments: true,
            employeeLinks: true,
            assistants: true,
            deductions: true,
            productOrders: true,
            siteProductOrders: true,
            siteDayRateOverrides: true,
            overtimeEntries: true,
            ppeOrders: true,
            supervisorLinks: true,
          },
        },
      },
      orderBy: { id: "asc" },
    });

    console.log("Foreman relation counts:");
    console.dir(details, { depth: null });
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
