// prisma/seed-new-employees.ts
//
// Seed new employees from scanned QR codes.
//
// Preview:  pnpm tsx prisma/seed-new-employees.ts
// Apply:    pnpm tsx prisma/seed-new-employees.ts --apply

import { prisma } from "@/lib/prisma";

const newEmployees = [
  {
    firstName: "Nkosikhona",
    lastName: "Dube",
    qrCodeValue: "3E53C58B332E0FCA",
    aliases: [],
  },
  {
    firstName: "Getmore",
    lastName: "Ndlovu",
    qrCodeValue: "68C58A59EFDDD103",
    aliases: [],
  },
  {
    firstName: "Mbonisi",
    lastName: "Nyoni",
    qrCodeValue: "65EE08CEE16A9895",
    aliases: [],
  },
  {
    firstName: "Mahlomola",
    lastName: "Monene",
    qrCodeValue: "11D70470791841A8",
    aliases: [],
  },
  {
    firstName: "Molekwa",
    lastName: "Richard Maposa",
    qrCodeValue: "92F85214336A934B",
    aliases: [],
  },
  {
    firstName: "Mohale",
    lastName: "Sonty",
    qrCodeValue: "561689F3CC9C6DAE",
    aliases: [],
  },
  {
    firstName: "Brahm",
    lastName: "Sekgobela",
    qrCodeValue: "79848FA30EDF5863",
    aliases: [],
  },
  {
    firstName: "Mafhara",
    lastName: "Events",
    qrCodeValue: "116EBA9F034F05FE",
    aliases: [],
  },
  {
    firstName: "Ronald",
    lastName: "Mafhara",
    qrCodeValue: "EMP-42FF57A91614FB9B",
    aliases: [],
  },
  {
    firstName: "James",
    lastName: "Banda",
    qrCodeValue: "FB2FFB8D717BE5EB",
    aliases: [],
  },
  {
    firstName: "Spa",
    lastName: "Mtshali",
    qrCodeValue: "EADBCCAC54C4E992",
    aliases: [],
  },
];

function normalizeName(input: string): string {
  return String(input ?? "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const APPLY = process.argv.includes("--apply");
  let created = 0;
  let updated = 0;
  let skipped = 0;

  console.log("\n" + "=".repeat(72));
  console.log("Seeding new employees from QR code scans");
  console.log("=".repeat(72));

  for (const emp of newEmployees) {
    const fullName = `${emp.firstName} ${emp.lastName}`;
    console.log(`\n${fullName}`);

    // Check if employee already exists
    const existing = await prisma.employee.findFirst({
      where: {
        firstName: { equals: emp.firstName, mode: "insensitive" },
        lastName: { equals: emp.lastName, mode: "insensitive" },
      },
      select: { id: true, qrCodeValue: true },
    });

    if (existing) {
      if (existing.qrCodeValue === emp.qrCodeValue) {
        console.log(`  → SKIP (already exists with same QR code)`);
        skipped++;
        continue;
      }

      // Update QR code if different
      console.log(
        `  → UPDATE QR code: ${existing.qrCodeValue} → ${emp.qrCodeValue}`,
      );
      if (APPLY) {
        await prisma.employee.update({
          where: { id: existing.id },
          data: { qrCodeValue: emp.qrCodeValue },
        });
      }
      updated++;
      continue;
    }

    // Check if QR code already exists (maybe different name)
    const byQR = await prisma.employee.findFirst({
      where: { qrCodeValue: emp.qrCodeValue },
      select: { id: true, firstName: true, lastName: true },
    });

    if (byQR) {
      console.log(
        `  → SKIP (QR code already assigned to ${byQR.firstName} ${byQR.lastName})`,
      );
      skipped++;
      continue;
    }

    // Create new employee
    console.log(`  → CREATE new employee`);
    if (APPLY) {
      await prisma.employee.create({
        data: {
          firstName: emp.firstName,
          lastName: emp.lastName,
          qrCodeValue: emp.qrCodeValue,
          isActive: true,
        },
      });
    }
    created++;
  }

  console.log("\n" + "=".repeat(72));
  if (APPLY) {
    console.log(
      `Applied: ${created} created, ${updated} updated, ${skipped} skipped.`,
    );
  } else {
    console.log(
      `Preview: ${created} to create, ${updated} to update, ${skipped} to skip. Add --apply to execute.`,
    );
  }
}

main()
  .catch((error) => {
    console.error("New employees seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
