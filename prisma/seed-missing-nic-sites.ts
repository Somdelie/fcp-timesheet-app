// prisma/seed-missing-nic-sites.ts
import { prisma } from "@/lib/prisma";

const sites = [
  {
    code: "5083",
    name: "19 RIDGE ROAD",
    jobStatus: "NOT_STARTED",
    specStatus: "NOT_REQUIRED",
    isActive: true,
    client: null,
  },
] as const;

async function main() {
  for (const site of sites) {
    await prisma.site.upsert({
      where: { code: site.code },
      update: {
        name: site.name,
        client: site.client,
        specStatus: site.specStatus as any,
        jobStatus: "NOT_STARTED",
        isActive: true,
      },
      create: {
        code: site.code,
        name: site.name,
        client: site.client,
        specStatus: site.specStatus as any,
        jobStatus: "NOT_STARTED",
        isActive: true,
      },
    });

    console.log(`Seeded/updated ${site.code} ${site.name}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
