import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  type FinishingZone,
} from "../generated/prisma/client.js";

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const siteCode = "6129";

const finishingArea = {
  name: "General Finishes",
  label: "Internal / External Finishes",

  items: [
    {
      zone: "INTERNAL" as FinishingZone,
      position: "Ceiling",
      product: "Plascon PEM 600",
      colorCode: null,
      supplier: "Plascon",
      note: null,
    },
    {
      zone: "INTERNAL" as FinishingZone,
      position: "Walls",
      product: "Plascon PEM 1000",
      colorCode: null,
      supplier: "Plascon",
      note: null,
    },
    {
      zone: "INTERNAL" as FinishingZone,
      position: "Doors - Internal",
      product: "Plascon Velvaglo",
      colorCode: "VLW 001 - White",
      supplier: "Plascon",
      note: null,
    },
    {
      zone: "EXTERNAL" as FinishingZone,
      position: "Doors - External",
      product: "Plascon Velvaglo",
      colorCode: "41 Thames Dusk",
      supplier: "Plascon",
      note: null,
    },
    {
      zone: "EXTERNAL" as FinishingZone,
      position: "Gate",
      product: "Plascon Quick Drying Enamel",
      colorCode: "Black",
      supplier: "Plascon",
      note: null,
    },
    {
      zone: "EXTERNAL" as FinishingZone,
      position: "Boundary Walls - Primer",
      product: "Plascon Primer",
      colorCode: "PTA 001 - White",
      supplier: "Plascon",
      note: null,
    },
    {
      zone: "EXTERNAL" as FinishingZone,
      position: "Boundary Walls",
      product: "Plascon Paint",
      colorCode: "41 Thames Dusk",
      supplier: "Plascon",
      note: null,
    },
    {
      zone: "EXTERNAL" as FinishingZone,
      position: "Garage Floors / Stoep",
      product: "Plascon Stoep Enamel",
      colorCode: "Navy / Light Grey",
      supplier: "Plascon",
      note: null,
    },
    {
      zone: "EXTERNAL" as FinishingZone,
      position: "Fisherboard",
      product: "Plascon Fisherboard",
      colorCode: "AL-B02",
      supplier: "Plascon",
      note: null,
    },
    {
      zone: "INTERNAL" as FinishingZone,
      position: "Unit 11",
      product: "Plascon Pointe Plaster",
      colorCode: "EPL501",
      supplier: "Plascon",
      note: null,
    },
  ],
};

async function main() {
  // 1. Find site

  const site = await prisma.site.findUnique({
    where: {
      code: siteCode,
    },
    select: {
      id: true,
      name: true,
      code: true,
    },
  });

  if (!site) {
    throw new Error(`Site with code ${siteCode} was not found.`);
  }

  console.log(`Found site ${site.code}: ${site.name}`);

  // 2. Find existing finishing schedule

  let schedule = await prisma.siteFinishingSchedule.findFirst({
    where: {
      siteId: site.id,
      contractNo: siteCode,
      isActive: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      contractNo: true,
      client: true,
      status: true,
      version: true,
      isActive: true,
    },
  });

  // 3. Create header if missing

  if (!schedule) {
    console.log(
      `No finishing schedule exists for ${siteCode}. Creating one...`,
    );

    schedule = await prisma.siteFinishingSchedule.create({
      data: {
        siteId: site.id,

        siteAddress: null,
        contractNo: siteCode,
        contractManager: null,
        siteForeman: null,
        fcpContractManager: null,
        fcpQs: null,
        fcpSiteForeman: null,

        client: "BARROW",

        startDate: null,
        completionDate: null,
        drawingDetails: null,
        contactInfo: null,

        status: "INITIAL",
        version: 1,
        isActive: true,
      },

      select: {
        id: true,
        contractNo: true,
        client: true,
        status: true,
        version: true,
        isActive: true,
      },
    });

    console.log(`Created finishing schedule ${schedule.id}`);
  } else {
    console.log(`Existing finishing schedule found: ${schedule.id}`);
  }

  // 4. Seed ONLY General Finishes

  await prisma.$transaction(async (tx) => {
    const existingArea = await tx.siteFinishingScheduleArea.findFirst({
      where: {
        scheduleId: schedule.id,
        name: finishingArea.name,
      },
      select: {
        id: true,
      },
    });

    let areaId: string;

    if (existingArea) {
      console.log(
        `Existing "${finishingArea.name}" area found. Refreshing items...`,
      );

      areaId = existingArea.id;

      await tx.siteFinishingScheduleArea.update({
        where: {
          id: existingArea.id,
        },
        data: {
          label: finishingArea.label,
        },
      });

      await tx.siteFinishingScheduleItem.deleteMany({
        where: {
          areaId: existingArea.id,
        },
      });
    } else {
      console.log(`Creating "${finishingArea.name}" area...`);

      const createdArea = await tx.siteFinishingScheduleArea.create({
        data: {
          scheduleId: schedule.id,
          name: finishingArea.name,
          label: finishingArea.label,
          sortOrder: 0,
        },
        select: {
          id: true,
        },
      });

      areaId = createdArea.id;
    }

    // 5. Insert the 10 finishing items

    await tx.siteFinishingScheduleItem.createMany({
      data: finishingArea.items.map((item, index) => ({
        areaId,

        zone: item.zone,
        position: item.position,

        product: item.product,
        colorCode: item.colorCode,
        supplier: item.supplier,

        note: item.note,

        sortOrder: index,

        siteMaterialId: null,
        finishingVariantId: null,
        variantLabelSnapshot: null,
        procurementProductId: null,
        supplierId: null,
      })),
    });
  });

  // 6. Verify

  const result = await prisma.siteFinishingSchedule.findUnique({
    where: {
      id: schedule.id,
    },

    select: {
      id: true,
      siteId: true,
      contractNo: true,
      client: true,
      status: true,
      version: true,
      isActive: true,

      areas: {
        where: {
          name: finishingArea.name,
        },

        select: {
          id: true,
          name: true,
          label: true,
          sortOrder: true,

          items: {
            select: {
              id: true,
              zone: true,
              position: true,
              product: true,
              colorCode: true,
              supplier: true,
              note: true,
              sortOrder: true,
            },

            orderBy: {
              sortOrder: "asc",
            },
          },
        },
      },
    },
  });

  console.log(
    JSON.stringify(
      {
        message: "6129 finishing schedule seeded successfully.",
        site,
        schedule: result,
        itemCount:
          result?.areas.reduce((total, area) => total + area.items.length, 0) ??
          0,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("6129 finishing schedule seed failed:", error);

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
