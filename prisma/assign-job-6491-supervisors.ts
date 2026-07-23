import { prisma } from "@/lib/prisma";

const SITE_CODE = "6491";
const LAWRENCE_NAME = "Lawrence Ndebele";
const KYLE_NAME = "Kyle Timmerman";

const APPLY = process.argv.includes("--apply");

async function main() {
  // Find site
  const site = await prisma.site.findFirst({
    where: { code: SITE_CODE },
    select: { id: true, code: true, name: true },
  });

  if (!site) {
    throw new Error(`Site ${SITE_CODE} not found`);
  }

  console.log(`\nSite: ${site.name} (${site.code})`);

  // Find supervisors
  const lawrence = await prisma.supervisor.findFirst({
    where: {
      user: {
        name: { contains: LAWRENCE_NAME, mode: "insensitive" },
      },
    },
    select: { id: true, user: { select: { name: true } } },
  });

  const kyle = await prisma.supervisor.findFirst({
    where: {
      user: {
        name: { contains: KYLE_NAME, mode: "insensitive" },
      },
    },
    select: { id: true, user: { select: { name: true } } },
  });

  if (!lawrence) {
    throw new Error(`Supervisor ${LAWRENCE_NAME} not found`);
  }
  if (!kyle) {
    throw new Error(`Supervisor ${KYLE_NAME} not found`);
  }

  console.log(
    `Supervisors: ${lawrence.user.name} (PAINTERS), ${kyle.user.name} (BUILDING)`,
  );

  // Get all foremen grouped by team
  const foremen = await prisma.foreman.findMany({
    select: {
      id: true,
      defaultTeam: true,
      user: { select: { name: true } },
    },
    orderBy: { user: { name: "asc" } },
  });

  const buildingForemen = foremen.filter((f) => f.defaultTeam === "BUILDING");
  const painterForemen = foremen.filter((f) => f.defaultTeam === "PAINTERS");

  console.log(`\nForemen by team:`);
  console.log(`  BUILDING: ${buildingForemen.length}`);
  console.log(`  PAINTERS: ${painterForemen.length}`);

  if (!APPLY) {
    console.log("\n[DRY RUN] Would assign:");
    console.log(
      `  - ${buildingForemen.length} BUILDING foremen → Kyle Timmerman`,
    );
    console.log(
      `  - ${painterForemen.length} PAINTERS foremen → Lawrence Ndebele`,
    );
    console.log("\nRun with --apply to execute.");
    return;
  }

  let buildingAssigned = 0;
  let painterAssigned = 0;

  // Assign BUILDING → Kyle
  for (const foreman of buildingForemen) {
    try {
      await prisma.supervisorForeman.upsert({
        where: {
          supervisorId_foremanId_startsOn: {
            supervisorId: kyle.id,
            foremanId: foreman.id,
            startsOn: new Date(),
          },
        },
        create: {
          supervisor: { connect: { id: kyle.id } },
          foreman: { connect: { id: foreman.id } },
          startsOn: new Date(),
          endsOn: null,
        },
        update: {
          endsOn: null,
        },
      });

      buildingAssigned += 1;
      console.log(
        `  ✓ ${foreman.user.name} (BUILDING) → Kyle Timmerman for site ${site.code}`,
      );
    } catch (e: any) {
      console.log(
        `  ⚠ ${foreman.user.name} (BUILDING) → Kyle: ${e.message ?? "error"}`,
      );
    }
  }

  // Assign PAINTERS → Lawrence
  for (const foreman of painterForemen) {
    try {
      await prisma.supervisorForeman.upsert({
        where: {
          supervisorId_foremanId_startsOn: {
            supervisorId: lawrence.id,
            foremanId: foreman.id,
            startsOn: new Date(),
          },
        },
        create: {
          supervisor: { connect: { id: lawrence.id } },
          foreman: { connect: { id: foreman.id } },
          startsOn: new Date(),
          endsOn: null,
        },
        update: {
          endsOn: null,
        },
      });

      painterAssigned += 1;
      console.log(
        `  ✓ ${foreman.user.name} (PAINTERS) → Lawrence Ndebele for site ${site.code}`,
      );
    } catch (e: any) {
      console.log(
        `  ⚠ ${foreman.user.name} (PAINTERS) → Lawrence: ${e.message ?? "error"}`,
      );
    }
  }

  console.log(`\nDone.`);
  console.log(`BUILDING foremen assigned to Kyle: ${buildingAssigned}`);
  console.log(`PAINTERS foremen assigned to Lawrence: ${painterAssigned}`);
}

main()
  .catch((error) => {
    console.error("assign-foremen-by-team failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
