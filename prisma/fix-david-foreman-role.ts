import { prisma } from "@/lib/prisma";

const DAVID_EMAIL = "davids@gmail.com";
const DAVID_NAME = "David Swathedi";

async function main() {
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        {
          email: {
            equals: DAVID_EMAIL,
            mode: "insensitive",
          },
        },
        {
          name: {
            equals: DAVID_NAME,
            mode: "insensitive",
          },
        },
      ],
    },
    include: {
      foreman: true,
    },
  });

  if (!user) {
    throw new Error("David Swathedi user account was not found.");
  }

  const updatedUser = await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      name: DAVID_NAME,
      role: "FOREMAN",
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  let foreman = user.foreman;

  if (!foreman) {
    foreman = await prisma.foreman.create({
      data: {
        userId: user.id,
      },
    });

    console.log(`Created Foreman record: ${foreman.id}`);
  }

  console.log("David account fixed:");
  console.log(updatedUser);
  console.log(`Foreman ID: ${foreman.id}`);
}

main()
  .catch((error) => {
    console.error("David role fix failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
