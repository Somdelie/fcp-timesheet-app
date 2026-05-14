import { prisma } from "@/lib/prisma";

const SITE_CODE = process.argv[2];
if (!SITE_CODE) {
  console.error("Usage: tsx scripts/_delete-site-historical.ts <siteCode>");
  process.exit(1);
}

async function main() {
  const site = await prisma.site.findFirst({
    where: { code: SITE_CODE },
    select: { id: true, name: true },
  });
  if (!site) {
    console.error(`Site "${SITE_CODE}" not found`);
    process.exit(1);
  }
  console.log(`Site: ${site.name} (${site.id})`);

  const count = await prisma.historicalSiteCost.count({ where: { siteId: site.id } });
  console.log(`Records to delete: ${count}`);

  const del = await prisma.historicalSiteCost.deleteMany({ where: { siteId: site.id } });
  console.log(`Deleted: ${del.count}`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
