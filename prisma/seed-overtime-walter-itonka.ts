import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const overtimeEntries = [{ date: "2026-07-27", employees: 4, hours: 2 }];

async function main() {
  const foreman = await prisma.foreman.findFirst({
    where: {
      user: {
        name: {
          contains: "Walter",
          mode: "insensitive",
        },
      },
    },
    include: {
      user: true,
    },
  });

  if (!foreman) {
    throw new Error("Foreman Walter Sebothoma not found.");
  }

  const site = await prisma.site.findFirst({
    where: {
      code: "6658",
    },
  });

  if (!site) {
    throw new Error("Site 6658 not found.");
  }

  const admin = await prisma.user.findFirst({
    where: {
      role: "ADMIN",
    },
  });

  if (!admin) {
    throw new Error("No admin user found.");
  }

  console.log(`Foreman : ${foreman.user.name}`);
  console.log(`Site     : ${site.code} - ${site.name}`);

  const overtimePrice = await prisma.overtimePrice.findFirst({
    where: {
      label: "Overtime",
    },
  });

  if (!overtimePrice) {
    throw new Error("Overtime pricing record not found.");
  }

  let created = 0;
  let skipped = 0;

  for (const row of overtimeEntries) {
    const workDate = new Date(`${row.date}T00:00:00.000Z`);

    const exists = await prisma.overtimeEntry.findFirst({
      where: {
        siteId: site.id,
        foremanId: foreman.id,
        workDate,
        hoursWorked: row.hours,
        numberOfEmployees: row.employees,
      },
    });

    if (exists) {
      skipped++;
      continue;
    }

    const rate = Number(overtimePrice.rate);
    const total = rate * row.hours * row.employees;

    await prisma.overtimeEntry.create({
      data: {
        siteId: site.id,
        foremanId: foreman.id,
        workDate,

        overtimePriceId: overtimePrice.id,
        rateAtCreation: overtimePrice.rate,

        numberOfEmployees: row.employees,
        hoursWorked: row.hours,
        totalCost: total,

        createdByUserId: admin.id,
      },
    });

    created++;
  }

  console.log("");
  console.log("==================================");
  console.log(`Created : ${created}`);
  console.log(`Skipped : ${skipped}`);
  console.log(`Total   : ${overtimeEntries.length}`);
  console.log("==================================");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
