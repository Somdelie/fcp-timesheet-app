import { prisma } from "../lib/prisma";

const cardUpdates = [
  { firstName: "Sthephens", lastName: "Sithole", card: "45BC57FE60D39843" },
  { firstName: "Lucas", lastName: "Molokomme", card: "E09E1AF2E40448D8" },
  { firstName: "Koketso", lastName: "Motau", card: "B5D18DB3EE220754" },
  { firstName: "Tshepiso", lastName: "Chabalala", card: "973BA10701772C96" },
  { firstName: "Tshepiso", lastName: "Mmatli", card: "A020015F9C941278" },
  { firstName: "Kgothatso", lastName: "Pelo", card: "96876795889B79B7" },
  { firstName: "Jerry", lastName: "Mnguni", card: "D4000B9DE58F94E1" },
  { firstName: "Bonolo", lastName: "Marema", card: "BMR001" },
];

function normalizeName(input: string) {
  return String(input ?? "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  console.log("\nCorrecting QR cards for David Swathedi team members");
  console.log("=".repeat(60));

  for (const { firstName, lastName, card } of cardUpdates) {
    try {
      // Find existing employee
      let employee = await prisma.employee.findFirst({
        where: {
          AND: [
            { firstName: { equals: firstName, mode: "insensitive" } },
            { lastName: { equals: lastName, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          qrCodeValue: true,
          firstName: true,
          lastName: true,
        },
      });

      if (!employee) {
        console.log(`Creating employee: ${firstName} ${lastName}`);
        employee = await prisma.employee.create({
          data: {
            firstName,
            lastName,
            qrCodeValue: card,
          },
          select: {
            id: true,
            qrCodeValue: true,
            firstName: true,
            lastName: true,
          },
        });
        console.log(`  ✓ Created with card: ${card}`);
      } else if (employee.qrCodeValue !== card) {
        console.log(
          `Correcting card for: ${employee.firstName} ${employee.lastName}`,
        );
        employee = await prisma.employee.update({
          where: { id: employee.id },
          data: { qrCodeValue: card },
          select: {
            id: true,
            qrCodeValue: true,
            firstName: true,
            lastName: true,
          },
        });
        console.log(`  ✓ Updated to card: ${card}`);
      } else {
        console.log(`${firstName} ${lastName}: Card correct (${card})`);
      }
    } catch (err) {
      console.log(`✗ ${firstName} ${lastName}: ${(err as Error).message}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("Card correction complete");
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
