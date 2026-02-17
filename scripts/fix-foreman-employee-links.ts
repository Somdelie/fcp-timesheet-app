import { prisma } from "../lib/prisma";

/**
 * This script finds foremen who have Employee records (same name) but
 * the Employee.userId is not set. It links them properly.
 */
async function fixForemanEmployeeLinks() {
  // Get all foremen with their user info
  const foremen = await prisma.foreman.findMany({
    select: {
      id: true,
      userId: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  console.log(`Found ${foremen.length} foremen`);

  for (const foreman of foremen) {
    const userName = foreman.user.name;
    if (!userName) {
      console.log(`Skipping foreman ${foreman.id} - no user name`);
      continue;
    }

    // Check if there's already an Employee linked to this user
    const existingLink = await prisma.employee.findFirst({
      where: { userId: foreman.userId },
      select: { id: true, firstName: true, lastName: true },
    });

    if (existingLink) {
      console.log(
        `✓ Foreman ${userName} already linked to Employee ${existingLink.firstName} ${existingLink.lastName}`,
      );
      continue;
    }

    // Try to find an Employee with matching name (case-insensitive)
    const nameParts = userName.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ");

    const matchingEmployee = await prisma.employee.findFirst({
      where: {
        userId: null, // Not already linked
        firstName: { equals: firstName, mode: "insensitive" },
        lastName: { equals: lastName, mode: "insensitive" },
      },
      select: { id: true, firstName: true, lastName: true },
    });

    if (matchingEmployee) {
      console.log(
        `→ Linking foreman ${userName} to Employee ${matchingEmployee.firstName} ${matchingEmployee.lastName}`,
      );

      await prisma.employee.update({
        where: { id: matchingEmployee.id },
        data: { userId: foreman.userId },
      });

      console.log(`  ✓ Done`);
    } else {
      console.log(`✗ No matching Employee found for foreman ${userName}`);
    }
  }

  console.log("\nDone!");
}

fixForemanEmployeeLinks()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
