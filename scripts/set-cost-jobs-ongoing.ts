#!/usr/bin/env node
import { prisma } from "../lib/prisma";

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const sites = await prisma.site.findMany({
    where: {
      isActive: true,
      OR: [
        {
          attendanceScans: {
            some: {
              dayRateAtScan: { gt: 0 },
            },
          },
        },
        {
          siteProductOrders: {
            some: {
              items: {
                some: {
                  quantity: { gt: 0 },
                  unitPriceAtOrder: { gt: 0 },
                },
              },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      name: true,
      code: true,
      jobStatus: true,
    },
  });

  if (!sites.length) {
    console.log("No costed jobs found to update.");
    return;
  }

  const candidates = sites.filter((site) => site.jobStatus !== "ONGOING");
  if (!candidates.length) {
    console.log("All costed jobs are already Ongoing.");
    return;
  }

  console.log(
    `${dryRun ? "DRY RUN: " : "Updating:"} ${candidates.length} site(s) to Ongoing status`,
  );
  for (const site of candidates) {
    console.log(
      `- ${site.name ?? "<Unnamed>"} (id=${site.id}, code=${site.code}, current=${site.jobStatus})`,
    );
  }

  if (dryRun) {
    console.log("DRY RUN complete. No sites were updated.");
    return;
  }

  const ids = candidates.map((site) => site.id);
  const result = await prisma.site.updateMany({
    where: { id: { in: ids } },
    data: { jobStatus: "ONGOING" },
  });

  console.log(`Updated ${result.count} site(s) to Ongoing.`);
}

main()
  .catch((err) => {
    console.error("Update failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
