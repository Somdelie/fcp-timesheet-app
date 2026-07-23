import { prisma } from "@/lib/prisma";

const LAWRENCE_NAME = "Lawrence Ndebele";
const KYLE_NAME = "Kyle Timmerman";

const APPLY = process.argv.includes("--apply");

async function main() {
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
    `\nReverting supervisor-foreman assignments for ${lawrence.user.name} and ${kyle.user.name}...`,
  );

  // Count and remove all SupervisorForeman links for these two supervisors
  const lawrenceCount = await prisma.supervisorForeman.count({
    where: { supervisorId: lawrence.id },
  });

  const kyleCount = await prisma.supervisorForeman.count({
    where: { supervisorId: kyle.id },
  });

  console.log(
    `Found: ${lawrenceCount} links for ${lawrence.user.name}, ${kyleCount} links for ${kyle.user.name}`,
  );

  if (!APPLY) {
    console.log(
      `\n[DRY RUN] Would delete all links. Run with --apply to execute.`,
    );
    return;
  }

  const deletedLawrence = await prisma.supervisorForeman.deleteMany({
    where: { supervisorId: lawrence.id },
  });

  const deletedKyle = await prisma.supervisorForeman.deleteMany({
    where: { supervisorId: kyle.id },
  });

  console.log(
    `\nDeleted: ${deletedLawrence.count} + ${deletedKyle.count} links`,
  );
  console.log(`Done. All supervisor-foreman assignments reverted.`);
}

main()
  .catch((error) => {
    console.error("revert-supervisor-foreman-assignments failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
