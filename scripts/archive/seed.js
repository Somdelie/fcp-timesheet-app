import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.ts";
import bcrypt from "bcryptjs";

const connectionString = `${process.env.DATABASE_URL}`;

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const hashedPassword = await bcrypt.hash("Zola@1990", 12);

  const user = await prisma.user.create({
    data: {
      name: "Cautious Ndlovu",
      email: "admin@cautiousndlovu.co.za",
      role: "ADMIN",
      password: hashedPassword,
    },
  });
  console.log("Created user:", user);

  // Fetch all users
  const allUsers = await prisma.user.findMany();
  console.log("All users:", JSON.stringify(allUsers, null, 2));

  // ── Site Paint Plans for site 6553 ──
  const site6553 = await prisma.site.findUnique({ where: { code: "6553" } });
  if (!site6553) {
    console.log("Site 6553 not found – skipping paint plan seed");
  } else {
    // Ensure a generic paint product + coverage profile exist
    const paintProduct = await prisma.procurementProduct.upsert({
      where: { sku: "PAINT-GENERIC-20L" },
      update: {},
      create: {
        name: "Generic Paint 20 L",
        sku: "PAINT-GENERIC-20L",
        uom: "DRUM",
        unitSize: 20,
        isActive: true,
      },
    });

    const coverage = await prisma.procurementProductCoverage.create({
      data: {
        productId: paintProduct.id,
        uom: "DRUM",
        unitSize: 20,
        coverageM2: 140,
        note: "Standard 140 m² per 20 L container",
        isActive: true,
      },
    });

    const sitePaintPlans = [
      {
        boqReference: "Existing Work",
        description: "External walls (above 1.5m high from NGL)",
        areaM2: 1377,
        requiredContainers: 9.84,
        roundedContainers: 10,
      },
      {
        boqReference: "Existing Work",
        description: "External walls (up to 1.5m high from NGL)",
        areaM2: 132,
        requiredContainers: 0.94,
        roundedContainers: 1,
      },
      {
        boqReference: "Existing Work",
        description: "External walls in narrow widths",
        areaM2: 225,
        requiredContainers: 1.61,
        roundedContainers: 2,
      },
      {
        boqReference: "Existing Work",
        description: "Internal walls",
        areaM2: 8247,
        requiredContainers: 58.91,
        roundedContainers: 59,
      },
      {
        boqReference: "Existing Work",
        description: "Internal walls in narrow widths",
        areaM2: 280,
        requiredContainers: 2,
        roundedContainers: 2,
      },
      {
        boqReference: "Existing Work",
        description: "Internal walls (wet areas)",
        areaM2: 175,
        requiredContainers: 1.25,
        roundedContainers: 2,
      },
      {
        boqReference: "New Work",
        description: "External walls in narrow widths",
        areaM2: 4,
        requiredContainers: 0.03,
        roundedContainers: 1,
      },
      {
        boqReference: "New Work",
        description: "Internal walls",
        areaM2: 4163,
        requiredContainers: 29.74,
        roundedContainers: 30,
      },
      {
        boqReference: "New Work",
        description: "Internal walls in narrow widths",
        areaM2: 243,
        requiredContainers: 1.74,
        roundedContainers: 2,
      },
      {
        boqReference: "New Work",
        description: "Internal walls (wet areas)",
        areaM2: 80,
        requiredContainers: 0.57,
        roundedContainers: 1,
      },
      {
        boqReference: "New Work",
        description: "Ceilings (fibre cement board)",
        areaM2: 494,
        requiredContainers: 3.53,
        roundedContainers: 4,
      },
      {
        boqReference: "New Work",
        description: "Eaves, verges, etc.",
        areaM2: 368,
        requiredContainers: 2.63,
        roundedContainers: 3,
      },
      {
        boqReference: "New Work",
        description: "Ceilings including bulkheads",
        areaM2: 1124,
        requiredContainers: 8.03,
        roundedContainers: 9,
      },
      {
        boqReference: "New Work",
        description: "Partitioning",
        areaM2: 2538,
        requiredContainers: 18.13,
        roundedContainers: 19,
      },
      {
        boqReference: "New Work",
        description: "Ceilings including bulkheads (wet areas)",
        areaM2: 250,
        requiredContainers: 1.79,
        roundedContainers: 2,
      },
      {
        boqReference: "New Work",
        description: "Partitioning (wet areas)",
        areaM2: 90,
        requiredContainers: 0.64,
        roundedContainers: 1,
      },
    ];

    for (const plan of sitePaintPlans) {
      await prisma.sitePaintPlan.create({
        data: {
          siteId: site6553.id,
          boqReference: plan.boqReference,
          description: plan.description,
          areaM2: plan.areaM2,
          productId: paintProduct.id,
          coverageId: coverage.id,
          requiredLitres: +(plan.requiredContainers * 20).toFixed(2),
          requiredContainers: plan.requiredContainers,
          roundedContainers: plan.roundedContainers,
          createdByUserId: user.id,
        },
      });
    }

    console.log(`Seeded ${sitePaintPlans.length} paint plans for site 6553`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
