import { prisma } from "../lib/prisma";

const workers = [
  {
    firstName: "Matshidiso",
    lastName: "Kapok",
    qrCodeValue: "3E6249A2E2BABD34",
  },
  {
    firstName: "Gift",
    lastName: "Moyo",
    qrCodeValue: "667698EE662397B9",
  },
  {
    firstName: "Masonwabe",
    lastName: "Mabetu",
    qrCodeValue: "7583DB3450CBA484",
  },
] as const;

function normalize(value: string) {
  return String(value ?? "").trim();
}

async function main() {
  for (const w of workers) {
    const firstName = normalize(w.firstName);
    const lastName = normalize(w.lastName);
    const qrCodeValue = normalize(w.qrCodeValue).toUpperCase();

    const byCard = await prisma.employee.findFirst({
      where: { qrCodeValue },
      select: { id: true, firstName: true, lastName: true, qrCodeValue: true },
    });

    if (byCard) {
      await prisma.employee.update({
        where: { id: byCard.id },
        data: {
          firstName,
          lastName,
          qrCodeValue,
          isActive: true,
        },
      });
      console.log(
        `[UPDATED_BY_CARD] ${firstName} ${lastName} (${qrCodeValue})`,
      );
      continue;
    }

    const byName = await prisma.employee.findFirst({
      where: {
        firstName: { equals: firstName, mode: "insensitive" },
        lastName: { equals: lastName, mode: "insensitive" },
      },
      select: { id: true, firstName: true, lastName: true, qrCodeValue: true },
    });

    if (byName) {
      await prisma.employee.update({
        where: { id: byName.id },
        data: {
          qrCodeValue,
          isActive: true,
        },
      });
      console.log(
        `[UPDATED_BY_NAME] ${firstName} ${lastName} (${qrCodeValue})`,
      );
      continue;
    }

    await prisma.employee.create({
      data: {
        firstName,
        lastName,
        qrCodeValue,
        isActive: true,
      },
    });
    console.log(`[CREATED] ${firstName} ${lastName} (${qrCodeValue})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
