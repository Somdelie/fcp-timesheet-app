import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { claimsData } from "@/lib/data";

const connectionString = `${process.env.DATABASE_URL}`;

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function updateClaimDates() {
  console.log("🔄 Starting site claim date update for May 2026...");

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const [, claimInfo] of Object.entries(claimsData)) {
    try {
      // Skip COC entries
      if (claimInfo.claimDay === "COC") {
        skipped++;
        continue;
      }

      const claimDate = new Date(2026, 4, claimInfo.claimDay);

      // FIND SITE USING SITE/JOB NAME
      const site = await prisma.site.findFirst({
        where: {
          name: {
            contains: claimInfo.siteNameKeyword,
            mode: "insensitive",
          },
        },
      });

      if (!site) {
        console.log(
          `❌ Site not found for keyword: ${claimInfo.siteNameKeyword}`,
        );

        notFound++;
        continue;
      }

      // UPDATE SITE CLAIM DATE
      await prisma.site.update({
        where: {
          id: site.id,
        },
        data: {
          siteClaimDate: claimDate,
        },
      });

      // OPTIONAL:
      // UPDATE ALL CLAIMS UNDER THIS SITE
      await prisma.siteClaim.updateMany({
        where: {
          siteId: site.id,
        },
        data: {
          siteClaimDate: claimDate,
          claimDate: claimDate,
        },
      });

      console.log(
        `✅ Updated ${site.name} → ${claimDate.toLocaleDateString()}`,
      );

      updated++;
    } catch (error) {
      console.error(`⚠️ Error:`, error);
    }
  }

  console.log("\n📊 Summary:");
  console.log(`✅ Updated: ${updated}`);
  console.log(`⏭️ Skipped: ${skipped}`);
  console.log(`❌ Not found: ${notFound}`);
}

updateClaimDates()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
