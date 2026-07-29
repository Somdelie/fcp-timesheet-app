import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const EMAIL = "thandazani@gmail.com";
  const QR = "EMP-6497997736013A49";

  const user = await prisma.user.findUnique({
    where: {
      email: EMAIL,
    },
    include: {
      employee: true,
      foreman: true,
    },
  });

  if (!user) {
    throw new Error(`User '${EMAIL}' not found.`);
  }

  console.log("\nUser");
  console.log({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    hasEmployee: !!user.employee,
    hasForeman: !!user.foreman,
  });

  const employee = await prisma.employee.findUnique({
    where: {
      qrCodeValue: QR,
    },
  });

  if (!employee) {
    throw new Error(`Employee '${QR}' not found.`);
  }

  console.log("\nEmployee");
  console.log({
    id: employee.id,
    firstName: employee.firstName,
    lastName: employee.lastName,
    qrCode: employee.qrCodeValue,
    currentUserId: employee.userId,
  });

  // Already linked correctly
  if (employee.userId === user.id) {
    console.log("\n✓ Employee is already linked correctly.");
    return;
  }

  // User already linked to another employee
  if (user.employee && user.employee.id !== employee.id) {
    throw new Error(
      `User already linked to another employee (${user.employee.qrCodeValue}).`,
    );
  }

  // Employee linked elsewhere
  if (employee.userId && employee.userId !== user.id) {
    throw new Error(
      `Employee is already linked to another user (${employee.userId}).`,
    );
  }

  await prisma.employee.update({
    where: {
      id: employee.id,
    },
    data: {
      userId: user.id,
    },
  });

  console.log("\n✅ Successfully linked employee to user.");

  const verify = await prisma.employee.findUniqueOrThrow({
    where: {
      id: employee.id,
    },
    include: {
      user: true,
    },
  });

  console.log("\nVerification");
  console.log({
    employee: `${verify.firstName} ${verify.lastName}`,
    qrCode: verify.qrCodeValue,
    linkedUser: verify.user?.email,
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
