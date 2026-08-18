import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const overtimeEntries = [
  // ==========================================================
  // Shadreck Mthunzi
  // 6793 - FOOD LOVERS
  // ==========================================================

  {
    foreman: "Shadreck Mthunzi",
    site: "6793",
    date: "2026-08-05",
    employees: 8, // Shadreck + 7
    hours: 3,
  },
  {
    foreman: "Shadreck Mthunzi",
    site: "6793",
    date: "2026-08-06",
    employees: 5, // Foreman absent + 5
    hours: 5,
  },
  {
    foreman: "Shadreck Mthunzi",
    site: "6793",
    date: "2026-08-07",
    employees: 7, // Shadrek + 6
    hours: 4,
  },
  {
    foreman: "Shadreck Mthunzi",
    site: "6793",
    date: "2026-08-13",
    employees: 8, // Shadrek + 7
    hours: 2,
  },

  // ==========================================================
  // OBERD MALULEKA
  // 6793 - FOOD LOVERS
  // ==========================================================

  {
    foreman: "Oberd Maluleka",
    site: "6793",
    date: "2026-08-13",
    employees: 2, // Foreman absent + 2
    hours: 2,
  },

  // ==========================================================
  // ALBERTONIA MASANGO
  // 6798 - DICKINSON
  // ==========================================================

  {
    foreman: "Albertonia Masango",
    site: "6798",
    date: "2026-08-01",
    employees: 5, // Albertonia + 4
    hours: 5,
  },
  {
    foreman: "Albertonia Masango",
    site: "6798",
    date: "2026-08-02",
    employees: 5, // Albertonia + 4
    hours: 7,
  },
  {
    foreman: "Albertonia Masango",
    site: "6798",
    date: "2026-08-04",
    employees: 5, // Albertonia + 4
    hours: 4,
  },
  {
    foreman: "Albertonia Masango",
    site: "6798",
    date: "2026-08-05",
    employees: 5, // Albertonia + 4
    hours: 4,
  },
];

async function findForeman(name: string) {
  return prisma.foreman.findFirst({
    where: {
      user: {
        name: {
          contains: name,
          mode: "insensitive",
        },
      },
    },
    include: {
      user: true,
    },
  });
}

async function main() {
  console.log("");
  console.log("==================================");
  console.log("        OVERTIME SEED");
  console.log("==================================");
  console.log(`Entries to process: ${overtimeEntries.length}`);
  console.log("");

  // ----------------------------------------------------------
  // ADMIN
  // ----------------------------------------------------------

  const admin = await prisma.user.findFirst({
    where: {
      role: "ADMIN",
    },
  });

  if (!admin) {
    throw new Error("No admin user found.");
  }

  // ----------------------------------------------------------
  // OVERTIME PRICE
  // ----------------------------------------------------------

  const overtimePrice = await prisma.overtimePrice.findFirst({
    where: {
      label: "Overtime",
    },
  });

  if (!overtimePrice) {
    throw new Error("Overtime pricing record not found.");
  }

  const rate = Number(overtimePrice.rate);

  console.log(`Overtime rate: R${rate.toFixed(2)}`);
  console.log("");

  let created = 0;
  let skipped = 0;
  let failed = 0;

  // ----------------------------------------------------------
  // PROCESS ENTRIES
  // ----------------------------------------------------------

  for (const [index, row] of overtimeEntries.entries()) {
    console.log(
      `[${index + 1}/${overtimeEntries.length}] ` +
        `${row.date} | ${row.foreman} | Site ${row.site} | ` +
        `${row.employees} workers × ${row.hours}h`,
    );

    // --------------------------------------------------------
    // FIND FOREMAN
    // --------------------------------------------------------

    const foreman = await findForeman(row.foreman);

    if (!foreman) {
      console.error(`  ❌ Foreman not found: ${row.foreman}`);
      failed++;
      continue;
    }

    // --------------------------------------------------------
    // FIND SITE
    // --------------------------------------------------------

    const site = await prisma.site.findFirst({
      where: {
        code: row.site,
      },
    });

    if (!site) {
      console.error(`  ❌ Site not found: ${row.site}`);
      failed++;
      continue;
    }

    console.log(`  Foreman: ${foreman.user.name}`);
    console.log(`  Site: ${site.code} - ${site.name}`);

    // --------------------------------------------------------
    // DATE
    // --------------------------------------------------------

    const workDate = new Date(`${row.date}T00:00:00.000Z`);

    // --------------------------------------------------------
    // DUPLICATE CHECK
    // --------------------------------------------------------

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
      console.log("  ⏭️ Already exists — skipped");
      skipped++;
      console.log("");
      continue;
    }

    // --------------------------------------------------------
    // CALCULATE TOTAL
    // --------------------------------------------------------

    const total = rate * row.hours * row.employees;

    // --------------------------------------------------------
    // CREATE ENTRY
    // --------------------------------------------------------

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

    console.log(
      `  ✅ Created | ${row.employees} workers × ${row.hours}h | ` +
        `R${total.toFixed(2)}`,
    );

    created++;
    console.log("");
  }

  // ----------------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------------

  console.log("==================================");
  console.log("          SEED COMPLETE");
  console.log("==================================");
  console.log(`Created : ${created}`);
  console.log(`Skipped : ${skipped}`);
  console.log(`Failed  : ${failed}`);
  console.log(`Total   : ${overtimeEntries.length}`);
  console.log("==================================");
  console.log("");

  if (failed > 0) {
    console.log("⚠️ Some entries failed.");
    console.log("Check the messages above.");
  }
}

main()
  .catch((err) => {
    console.error("");
    console.error("❌ Overtime seed failed:");
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
