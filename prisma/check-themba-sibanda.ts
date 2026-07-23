import { prisma } from "@/lib/prisma";

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "thembasibanda@gmail.com" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          qrCodeValue: true,
          defaultDayRate: true,
          isActive: true,
        },
      },
      foreman: {
        select: {
          id: true,
          defaultDayRate: true,
          defaultTeam: true,
        },
      },
    },
  });

  console.log(JSON.stringify(user, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
