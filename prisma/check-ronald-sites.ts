import { prisma } from "@/lib/prisma";

const sites = await prisma.site.findMany({
  where: {
    OR: [
      { code: { contains: "674" } },
      { code: { contains: "660" } },
      { name: { contains: "ARABIAN" } },
      { name: { contains: "MENLYN" } },
    ],
  },
  select: { id: true, code: true, name: true },
});

console.log(JSON.stringify(sites, null, 2));

await prisma.$disconnect();
