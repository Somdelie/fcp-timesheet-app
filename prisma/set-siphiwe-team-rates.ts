// prisma/set-siphiwe-team-rates.ts

import { prisma } from "@/lib/prisma";

const teamRates = [
  {
    firstName: "Godknows",
    lastName: "Msebele",
    defaultDayRate: 270,
  },
  {
    firstName: "Smile",
    lastName: "Moyo",
    defaultDayRate: 270,
  },
  {
    firstName: "Thabo",
    lastName: "Seko",
    defaultDayRate: 270,
  },
];

async function main() {
  for (const member of teamRates) {
    const employee = await prisma.employee.findFirst({
      where: {
        firstName: { equals: member.firstName, mode: "insensitive" },
        lastName: { equals: member.lastName, mode: "insensitive" },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        defaultDayRate: true,
      },
    });

    if (!employee) {
      throw new Error(
        `Employee not found: ${member.firstName} ${member.lastName}`,
      );
    }

    const updated = await prisma.employee.update({
      where: { id: employee.id },
      data: {
        defaultDayRate: member.defaultDayRate,
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        defaultDayRate: true,
      },
    });

    console.log("Updated team member:", updated);
  }
}

main()
  .catch((error) => {
    console.error("Team rate update failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
