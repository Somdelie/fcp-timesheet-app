// prisma/update-siphiwe.ts
//
// Update or create Siphiwe Ngomani's employee record with correct QR code and day rate.
//
// Preview:  pnpm tsx prisma/update-siphiwe.ts
// Apply:    pnpm tsx prisma/update-siphiwe.ts --apply

import { prisma } from "@/lib/prisma";

async function main() {
  const APPLY = process.argv.includes("--apply");

  console.log("\nUpdating Siphiwe Ngomani's employee record...");
  console.log("=".repeat(72));

  // Find or create Siphiwe
  let siphiwe = await prisma.employee.findFirst({
    where: {
      firstName: { equals: "Siphiwe", mode: "insensitive" },
      lastName: { equals: "Ngomani", mode: "insensitive" },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      qrCodeValue: true,
      defaultDayRate: true,
    },
  });

  if (!siphiwe) {
    console.log("Creating new employee: Siphiwe Ngomani");
    if (APPLY) {
      siphiwe = await prisma.employee.create({
        data: {
          firstName: "Siphiwe",
          lastName: "Ngomani",
          qrCodeValue: "EMP-2289999C2A5D51DA",
          defaultDayRate: 350,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          qrCodeValue: true,
          defaultDayRate: true,
        },
      });

      console.log("\n✓ Created successfully:");
      console.log(`  ${siphiwe.firstName} ${siphiwe.lastName}`);
      console.log(`  QR: ${siphiwe.qrCodeValue}`);
      console.log(`  Day rate: R${siphiwe.defaultDayRate}`);
    } else {
      console.log("  QR: EMP-2289999C2A5D51DA");
      console.log("  Day rate: R350");
      console.log("\nPreview mode. Add --apply to execute.");
    }
  } else {
    console.log(`Found: ${siphiwe.firstName} ${siphiwe.lastName}`);
    console.log(`  Current QR: ${siphiwe.qrCodeValue}`);
    console.log(`  Current day rate: ${siphiwe.defaultDayRate}`);

    console.log("\nUpdating to:");
    console.log(`  New QR: EMP-2289999C2A5D51DA`);
    console.log(`  New day rate: 350`);

    if (APPLY) {
      const updated = await prisma.employee.update({
        where: { id: siphiwe.id },
        data: {
          qrCodeValue: "EMP-2289999C2A5D51DA",
          defaultDayRate: 350,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          qrCodeValue: true,
          defaultDayRate: true,
        },
      });

      console.log("\n✓ Updated successfully:");
      console.log(`  ${updated.firstName} ${updated.lastName}`);
      console.log(`  QR: ${updated.qrCodeValue}`);
      console.log(`  Day rate: R${updated.defaultDayRate}`);
    } else {
      console.log("\nPreview mode. Add --apply to execute.");
    }
  }

  console.log("=".repeat(72));
}

main()
  .catch((error) => {
    console.error("Update failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
