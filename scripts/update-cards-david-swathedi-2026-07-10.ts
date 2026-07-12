import { prisma } from "../lib/prisma";

const cardUpdates = [
  { name: "Stephen Sithole", card: "STH001" },
  { name: "Lucus Molokomme", card: "LMM001" },
  { name: "Koletso Motau", card: "KMT001" },
  { name: "Tshepiso Chabalala", card: "TCH001" },
  { name: "Tshepiso Mmatli", card: "TMT001" },
  { name: "Basil Pelo", card: "BPL001" },
  { name: "Bonolo Marema", card: "BMR001" },
];

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };

  const lastName = parts.pop() ?? "";
  return { firstName: parts.join(" "), lastName };
}

function normalizeName(input: string) {
  return String(input ?? "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  console.log("\nUpdating QR cards for David Swathedi team members");
  console.log("=".repeat(60));

  for (const { name, card } of cardUpdates) {
    try {
      const split = splitName(name);
      const firstName = normalizeName(split.firstName);
      const lastName = normalizeName(split.lastName);

      // Find or create employee
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
        console.log(`Creating employee: ${name}`);
        employee = await prisma.employee.create({
          data: {
            firstName: split.firstName,
            lastName: split.lastName,
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
          `Updating card for: ${employee.firstName} ${employee.lastName}`,
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
        console.log(`${name}: Card already assigned (${card})`);
      }
    } catch (err) {
      console.log(`✗ ${name}: ${(err as Error).message}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("Card update complete");
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
