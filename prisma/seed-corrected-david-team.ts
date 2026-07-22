// prisma/seed-corrected-david-team.ts
import { prisma } from "@/lib/prisma";

const DEFAULT_DAY_RATE = 280;

const employees = [
  {
    firstName: "LUNGANI ",
    lastName: "NGWENYA",
    qrCodeValue: "09D235622D3369",
    aliases: [
      "LUNGANI   ",
      "Lungani Ngwenya",
      "Lungani Ngwenya",
      "LUNGANI NGWENYA",
    ],
  },
  {
    firstName: "MSIZI",
    lastName: "NGWENYA",
    qrCodeValue: "9535E28EC3F7E8EE",
    aliases: ["MSIZI   ", "Msizi Ngwenya", "Msizi Ngwenya", "MSIZI NGWENYA"],
  },
] as const;

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);

  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

async function findMatchingEmployees(employee: (typeof employees)[number]) {
  const possibleNames = [
    `${employee.firstName} ${employee.lastName}`,
    ...employee.aliases,
  ];

  const nameConditions = possibleNames.map((name) => {
    const parsed = splitName(name);

    return {
      AND: [
        {
          firstName: {
            equals: parsed.firstName,
            mode: "insensitive" as const,
          },
        },
        {
          lastName: {
            equals: parsed.lastName,
            mode: "insensitive" as const,
          },
        },
      ],
    };
  });

  return prisma.employee.findMany({
    where: {
      OR: [
        {
          qrCodeValue: {
            equals: employee.qrCodeValue,
            mode: "insensitive",
          },
        },
        ...nameConditions,
      ],
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}

async function main() {
  let created = 0;
  let updated = 0;
  let merged = 0;

  for (const input of employees) {
    const matches = await findMatchingEmployees(input);

    const cardConflict = await prisma.employee.findFirst({
      where: {
        qrCodeValue: {
          equals: input.qrCodeValue,
          mode: "insensitive",
        },
        ...(matches.length > 0
          ? {
              NOT: {
                id: {
                  in: matches.map((employee) => employee.id),
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });

    if (cardConflict) {
      throw new Error(
        `Card ${input.qrCodeValue} already belongs to ` +
          `${cardConflict.firstName} ${cardConflict.lastName}.`,
      );
    }

    if (matches.length === 0) {
      const employee = await prisma.employee.create({
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          qrCodeValue: input.qrCodeValue,
          // defaultDayRate: DEFAULT_DAY_RATE,
          isActive: true,
        },
      });

      console.log(
        `Created: ${employee.firstName} ${employee.lastName} -> ${input.qrCodeValue}`,
      );

      created += 1;
      continue;
    }

    const keepEmployee =
      matches.find(
        (employee) =>
          employee.qrCodeValue?.toUpperCase() ===
          input.qrCodeValue.toUpperCase(),
      ) ?? matches[0];

    const duplicates = matches.filter(
      (employee) => employee.id !== keepEmployee.id,
    );

    await prisma.$transaction(
      async (tx) => {
        for (const duplicate of duplicates) {
          const scans = await tx.attendanceScan.findMany({
            where: {
              employeeId: duplicate.id,
            },
            select: {
              id: true,
              siteDayId: true,
            },
          });

          for (const scan of scans) {
            const existingScan = await tx.attendanceScan.findFirst({
              where: {
                employeeId: keepEmployee.id,
                siteDayId: scan.siteDayId,
              },
              select: {
                id: true,
              },
            });

            if (existingScan) {
              await tx.attendanceScan.delete({
                where: {
                  id: scan.id,
                },
              });
            } else {
              await tx.attendanceScan.update({
                where: {
                  id: scan.id,
                },
                data: {
                  employeeId: keepEmployee.id,
                  qrPayload: input.qrCodeValue,
                },
              });
            }
          }

          await tx.employee.delete({
            where: {
              id: duplicate.id,
            },
          });

          merged += 1;
        }

        await tx.employee.update({
          where: {
            id: keepEmployee.id,
          },
          data: {
            firstName: input.firstName,
            lastName: input.lastName,
            qrCodeValue: input.qrCodeValue,
            isActive: true,
          },
        });
      },
      {
        maxWait: 30_000,
        timeout: 60_000,
      },
    );

    console.log(
      `Updated: ${input.firstName} ${input.lastName} -> ${input.qrCodeValue}`,
    );

    updated += 1;
  }

  console.log("\nCorrected employee seed complete.");
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Duplicate records merged: ${merged}`);
}

main()
  .catch((error) => {
    console.error("Corrected employee seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
