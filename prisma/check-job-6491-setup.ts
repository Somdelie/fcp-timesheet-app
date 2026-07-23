import { prisma } from "@/lib/prisma";

async function main() {
  // 1. Find site by code
  const site = await prisma.site.findFirst({
    where: { code: "6491" },
    select: { id: true, code: true, name: true },
  });

  console.log("Site:");
  console.log(JSON.stringify(site, null, 2));

  // 2. Find supervisors by name
  const lawrence = await prisma.supervisor.findFirst({
    select: {
      id: true,
      user: {
        select: { id: true, name: true, email: true },
      },
    },
    where: {
      user: {
        name: {
          contains: "Lawrence Ndebele",
          mode: "insensitive",
        },
      },
    },
  });

  const kyle = await prisma.supervisor.findFirst({
    select: {
      id: true,
      user: {
        select: { id: true, name: true, email: true },
      },
    },
    where: {
      user: {
        name: {
          contains: "Kyle Timmerman",
          mode: "insensitive",
        },
      },
    },
  });

  console.log("\nLawrence Ndebele:");
  console.log(JSON.stringify(lawrence, null, 2));

  console.log("\nKyle Timmerman:");
  console.log(JSON.stringify(kyle, null, 2));

  // 3. Show current foremen with their teams
  const foremen = await prisma.foreman.findMany({
    select: {
      id: true,
      defaultTeam: true,
      user: {
        select: { name: true },
      },
      supervisorLinks: {
        select: {
          supervisor: {
            select: {
              user: {
                select: { name: true },
              },
            },
          },
          startsOn: true,
          endsOn: true,
        },
      },
    },
    orderBy: { user: { name: "asc" } },
  });

  console.log("\nAll Foremen (sample):");
  console.log(JSON.stringify(foremen.slice(0, 5), null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
