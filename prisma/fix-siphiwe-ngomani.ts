// prisma/fix-siphiwe-ngomani.ts

import { prisma } from "@/lib/prisma";

const SIPHIWE_QR = "EMP-2289999C2A5D51DA";
const SIPHIWE_RATE = 350;

const aliases = [
  ["Siphiwe", "Ngomani"],
  ["Sphiwe", "Ngomani"],
  ["Siphiwe", "Ngomane"],
  ["SIPHIWE", "NGO"],
  ["SPHIWE", "NGO"],
];

async function main() {
  const employeeByQr = await prisma.employee.findFirst({
    where: {
      qrCodeValue: {
        equals: SIPHIWE_QR,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  });

  const employeeByAlias = await prisma.employee.findFirst({
    where: {
      OR: aliases.map(([firstName, lastName]) => ({
        AND: [
          {
            firstName: {
              equals: firstName,
              mode: "insensitive" as const,
            },
          },
          {
            lastName: {
              equals: lastName,
              mode: "insensitive" as const,
            },
          },
        ],
      })),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  });

  const employee = employeeByQr ?? employeeByAlias;

  if (!employee) {
    throw new Error("Siphiwe employee record was not found.");
  }

  const updated = await prisma.employee.update({
    where: {
      id: employee.id,
    },
    data: {
      firstName: "Siphiwe",
      lastName: "Ngomani",
      qrCodeValue: SIPHIWE_QR,
      defaultDayRate: SIPHIWE_RATE,
      isActive: true,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      qrCodeValue: true,
      defaultDayRate: true,
    },
  });

  console.log("Updated employee:", updated);
}

main()
  .catch((error) => {
    console.error("Siphiwe correction failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
