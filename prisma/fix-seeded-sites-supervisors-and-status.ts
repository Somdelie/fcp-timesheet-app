// prisma/fix-seeded-sites-supervisors-and-status.ts
import { prisma } from "@/lib/prisma";

const supervisorNames = [
  "Mawesi",
  "Nic",
  "Thousand",
  "Geofrey",
  "Lucas",
  "Temba",
  "Griffith",
  "Sean",
  "Owen",
  "Lawrence",
  "Tshepo",
];

async function main() {
  console.log("Fixing users to SUPERVISOR...");

  for (const name of supervisorNames) {
    const user = await prisma.user.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      include: { foreman: true, supervisor: true },
    });

    if (!user) {
      console.log(`Missing user: ${name}`);
      continue;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { role: "SUPERVISOR" },
    });

    if (user.foreman) {
      await prisma.foreman.delete({
        where: { id: user.foreman.id },
      });
    }

    if (!user.supervisor) {
      await prisma.supervisor.create({
        data: { userId: user.id },
      });
    }

    console.log(`Fixed supervisor: ${name}`);
  }

  console.log("Updating seeded sites to NOT_STARTED...");

  const result = await prisma.site.updateMany({
    where: {
      code: {
        gte: "6770",
        lte: "6835",
      },
    },
    data: {
      jobStatus: "NOT_STARTED",
      isActive: true,
    },
  });

  console.log(`Updated ${result.count} sites to NOT_STARTED.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
