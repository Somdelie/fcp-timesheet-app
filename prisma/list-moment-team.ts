import { prisma } from "@/lib/prisma";

async function main() {
  const employees = await prisma.attendanceScan.findMany({
    where: { siteDay: { foreman: { user: { name: { contains: "MOMENT" } } } } },
    select: {
      employee: { select: { id: true, firstName: true, lastName: true } },
    },
    distinct: ["employeeId"],
  });

  const unique = new Map();
  for (const scan of employees) {
    const key = `${scan.employee.firstName} ${scan.employee.lastName}`;
    if (!unique.has(key)) {
      unique.set(key, scan.employee);
    }
  }

  console.log("Current Moment Dube employees:");
  for (const emp of unique.values()) {
    console.log(`  "${emp.firstName}" "${emp.lastName}" (${emp.id})`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
