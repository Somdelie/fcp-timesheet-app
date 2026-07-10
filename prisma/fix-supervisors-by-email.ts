import { prisma } from "@/lib/prisma";

const supervisorEmails = [
  "mawesi@firstclassprojects.co.za",
  "nic@firstclassprojects.co.za",
  "thousand@firstclassprojects.co.za",
  "geofrey@firstclassprojects.co.za",
  "lucas@firstclassprojects.co.za",
  "temba@firstclassprojects.co.za",
  "griffith@firstclassprojects.co.za",
  "sean@firstclassprojects.co.za",
  "owen@firstclassprojects.co.za",
  "lawrence@firstclassprojects.co.za",
  "tshepo@firstclassprojects.co.za",
];

async function main() {
  for (const email of supervisorEmails) {
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      include: { foreman: true, supervisor: true },
    });

    if (!user) {
      console.log(`Missing user: ${email}`);
      continue;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { role: "SUPERVISOR" },
    });

    if (user.foreman) {
      await prisma.foreman.delete({ where: { id: user.foreman.id } });
    }

    if (!user.supervisor) {
      await prisma.supervisor.create({
        data: { userId: user.id },
      });
    }

    console.log(`Fixed supervisor: ${user.name ?? email}`);
  }

  const result = await prisma.site.updateMany({
    where: { code: { gte: "6770", lte: "6835" } },
    data: {
      jobStatus: "NOT_STARTED",
      isActive: true,
    },
  });

  console.log(`Updated ${result.count} sites to NOT_STARTED.`);
}

main()
  .catch(console.error)
  .finally(async () => prisma.$disconnect());
