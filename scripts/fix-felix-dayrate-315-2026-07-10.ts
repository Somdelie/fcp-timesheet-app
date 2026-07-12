import { prisma } from "../lib/prisma";

const FELIX_CARD = "EMP-555D2970A70DD020";

async function main() {
  const felix = await prisma.employee.findFirst({
    where: { qrCodeValue: FELIX_CARD },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      qrCodeValue: true,
      defaultDayRate: true,
    },
  });

  if (!felix) {
    throw new Error(`Felix card not found: ${FELIX_CARD}`);
  }

  await prisma.employee.update({
    where: { id: felix.id },
    data: { defaultDayRate: 315 },
  });

  const updated = await prisma.employee.findUnique({
    where: { id: felix.id },
    select: {
      firstName: true,
      lastName: true,
      defaultDayRate: true,
      qrCodeValue: true,
    },
  });

  console.log(
    `Updated ${updated?.firstName} ${updated?.lastName} (${updated?.qrCodeValue}) default day rate to ${updated?.defaultDayRate}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
