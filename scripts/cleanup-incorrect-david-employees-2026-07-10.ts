import { prisma } from "../lib/prisma";

// Delete incorrectly created employees
const toDelete = [
  { firstName: "Stephen", lastName: "Sithole" },
  { firstName: "Lucus", lastName: "Molokomme" },
  { firstName: "Koletso", lastName: "Motau" },
  { firstName: "Basil", lastName: "Pelo" },
  { firstName: "Bonolo", lastName: "Marema" },
];

async function main() {
  console.log("\nCleaning up incorrectly created employees");
  console.log("=".repeat(60));

  for (const { firstName, lastName } of toDelete) {
    try {
      const employee = await prisma.employee.findFirst({
        where: {
          AND: [
            { firstName: { equals: firstName, mode: "insensitive" } },
            { lastName: { equals: lastName, mode: "insensitive" } },
          ],
        },
        select: { id: true, firstName: true, lastName: true },
      });

      if (employee) {
        // Delete any scans for this employee first
        const scans = await prisma.attendanceScan.deleteMany({
          where: { employeeId: employee.id },
        });

        // Then delete the employee
        await prisma.employee.delete({
          where: { id: employee.id },
        });

        console.log(
          `✓ Deleted ${firstName} ${lastName} (and ${scans.count} scans)`,
        );
      } else {
        console.log(`- ${firstName} ${lastName}: Not found`);
      }
    } catch (err) {
      console.log(`✗ ${firstName} ${lastName}: ${(err as Error).message}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("Cleanup complete");
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
