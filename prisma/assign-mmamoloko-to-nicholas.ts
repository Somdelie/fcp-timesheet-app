import { prisma } from "@/lib/prisma";

const FOREMAN_EMAIL = "mathe@gmail.com";
const FOREMAN_NAME = "Gift Mathe";
const SUPERVISOR_EMAIL = "lawrence@firstclassprojects.co.za";
const SUPERVISOR_NAME = "Lawrence Ndebele";

async function main() {
  const foremanUser = await prisma.user.findUnique({
    where: { email: FOREMAN_EMAIL },
  });

  if (!foremanUser) {
    throw new Error(
      `${FOREMAN_NAME} was not found with email ${FOREMAN_EMAIL}.`,
    );
  }

  const supervisorUser = await prisma.user.findUnique({
    where: { email: SUPERVISOR_EMAIL },
    include: { supervisor: true },
  });

  if (!supervisorUser) {
    throw new Error(
      `${SUPERVISOR_NAME} was not found with email ${SUPERVISOR_EMAIL}.`,
    );
  }

  if (!supervisorUser.supervisor) {
    throw new Error(
      `${SUPERVISOR_NAME} has a user account but no Supervisor record.`,
    );
  }

  const supervisor = supervisorUser.supervisor;

  const result = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: foremanUser.id },
      data: {
        name: FOREMAN_NAME,
        role: "FOREMAN",
      },
    });

    const foreman = await tx.foreman.upsert({
      where: { userId: updatedUser.id },
      update: {},
      create: { userId: updatedUser.id },
    });

    const existingAssignment = await tx.supervisorForeman.findFirst({
      where: {
        supervisorId: supervisor.id,
        foremanId: foreman.id,
        endsOn: null,
      },
    });

    if (existingAssignment) {
      return {
        assignment: existingAssignment,
        alreadyAssigned: true,
      };
    }

    const assignedAt = new Date();

    // Preserve previous assignment history and make Lawrence the active supervisor.
    await tx.supervisorForeman.updateMany({
      where: {
        foremanId: foreman.id,
        endsOn: null,
      },
      data: { endsOn: assignedAt },
    });

    const assignment = await tx.supervisorForeman.create({
      data: {
        supervisorId: supervisor.id,
        foremanId: foreman.id,
        startsOn: assignedAt,
      },
    });

    return { assignment, alreadyAssigned: false };
  });

  console.log(`${FOREMAN_NAME} is configured as a FOREMAN.`);
  console.log(`Supervisor: ${supervisorUser.name ?? SUPERVISOR_NAME}`);
  console.log(
    result.alreadyAssigned
      ? "The supervisor assignment already existed. No duplicate was created."
      : "The supervisor assignment was created successfully.",
  );
}

main()
  .catch((error) => {
    console.error("Gift Mathe supervisor assignment failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
