import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

const EMAIL = "thembasibanda@gmail.com";
const NAME = "Themba Sibanda";
const DAY_RATE = 310;
const TEAM = "BUILDING";

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: EMAIL },
    select: {
      id: true,
      name: true,
      role: true,
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          qrCodeValue: true,
          defaultDayRate: true,
        },
      },
      foreman: {
        select: {
          id: true,
          defaultDayRate: true,
          defaultTeam: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error(`User not found: ${EMAIL}`);
  }

  if (user.role !== "FOREMAN") {
    throw new Error(`User ${EMAIL} is role ${user.role}, expected FOREMAN`);
  }

  if (!user.foreman) {
    throw new Error(`Foreman row missing for ${EMAIL}`);
  }

  if (user.employee) {
    await prisma.employee.update({
      where: { id: user.employee.id },
      data: {
        defaultDayRate: DAY_RATE,
        isActive: true,
      },
    });

    await prisma.foreman.update({
      where: { id: user.foreman.id },
      data: {
        defaultDayRate: DAY_RATE,
        defaultTeam: TEAM,
      },
    });

    console.log(
      `Employee profile already existed and was normalized: ${user.employee.firstName} ${user.employee.lastName}`,
    );
    return;
  }

  const { firstName, lastName } = splitName(user.name ?? NAME);
  const qrCodeValue = `EMP-${randomBytes(8).toString("hex").toUpperCase()}`;

  const employee = await prisma.employee.create({
    data: {
      firstName,
      lastName,
      defaultDayRate: DAY_RATE,
      qrCodeValue,
      user: { connect: { id: user.id } },
      createdByUser: { connect: { id: user.id } },
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

  await prisma.foreman.update({
    where: { id: user.foreman.id },
    data: {
      defaultDayRate: DAY_RATE,
      defaultTeam: TEAM,
    },
  });

  console.log(JSON.stringify(employee, null, 2));
}

main()
  .catch((error) => {
    console.error("create-themba-sibanda-employee-profile failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
