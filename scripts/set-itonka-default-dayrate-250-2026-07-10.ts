import { prisma } from "../lib/prisma";

const TARGET_CARDS = [
  "EMP-555D2970A70DD020",
  "83E52E6B308D0CD4",
  "796889A33F6632C6",
  "83C14E110A0CC373",
  "96FBEE5F9891B7D8",
  "8317B9CC955B812A",
  "07BA3A95A62D3142",
  "37269B7F51971F44",
  "6B30ECD0F07E428A",
  "EC596F8E49128F94",
];

async function main() {
  const employees = await prisma.employee.findMany({
    where: { qrCodeValue: { in: TARGET_CARDS } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      qrCodeValue: true,
      defaultDayRate: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  console.log(`Found ${employees.length} employees by target cards.`);

  let updated = 0;
  for (const e of employees) {
    await prisma.employee.update({
      where: { id: e.id },
      data: { defaultDayRate: 250 },
    });
    updated += 1;
    console.log(
      `SET R250.00 -> ${e.firstName} ${e.lastName} (${e.qrCodeValue}) [prev: ${e.defaultDayRate ?? "null"}]`,
    );
  }

  const missingCards = TARGET_CARDS.filter(
    (card) => !employees.some((e) => e.qrCodeValue === card),
  );

  if (missingCards.length > 0) {
    console.log("Missing cards (no employee found):");
    for (const card of missingCards) console.log(`- ${card}`);
  }

  console.log(
    `\nDone. Updated ${updated} employees to default day rate R250.00.`,
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
