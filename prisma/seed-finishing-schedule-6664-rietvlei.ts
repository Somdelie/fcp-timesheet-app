import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  type FinishingZone,
} from "../generated/prisma/client.js";

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

type SeedItem = {
  zone: FinishingZone;
  position: string;
  product: string;
  colorCode: string;
  note?: string;
};

const integrityArea = {
  name: "Integrity",
  label: "Integrity finishing schedule",
  items: [
    {
      zone: "INTERNAL" as FinishingZone,
      position: "Internal walls",
      product: "Dulux Trade 100",
      colorCode: "Pelican 30YY 72/018",
    },
    {
      zone: "INTERNAL" as FinishingZone,
      position: "Internal walls",
      product: "Dulux Trade 100",
      colorCode: "Brakelight Red 16YR 13/558",
    },
    {
      zone: "INTERNAL" as FinishingZone,
      position: "Ceilings and Bulkhead",
      product: "Dulux Trade 65",
      colorCode: "White",
    },
    {
      zone: "INTERNAL" as FinishingZone,
      position: "Skirtings and Doors & Frames",
      product: "Dulux Water-Based Pearlglo",
      colorCode: "Black RAL 9005",
    },
  ],
};

async function main() {
  // Site code = contract number
  const site = await prisma.site.findUnique({
    where: {
      code: "6557",
    },
    select: {
      id: true,
      name: true,
      code: true,
    },
  });

  if (!site) {
    throw new Error("Site with code 6557 was not found.");
  }

  // Find the EXISTING finishing schedule.
  // We do not create a replacement schedule.
  const schedule = await prisma.siteFinishingSchedule.findFirst({
    where: {
      siteId: site.id,
      contractNo: "6557",
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      contractNo: true,
    },
  });

  if (!schedule) {
    throw new Error(
      "Existing finishing schedule for site 6557 was not found. " +
        "This seed will not create a new schedule.",
    );
  }

  await prisma.$transaction(async (tx) => {
    // Find ONLY the Integrity area.
    const existingArea = await tx.siteFinishingScheduleArea.findFirst({
      where: {
        scheduleId: schedule.id,
        name: integrityArea.name,
      },
      select: {
        id: true,
      },
    });

    let areaId: string;

    if (existingArea) {
      // Integrity already exists.
      // Refresh ONLY Integrity's items.
      areaId = existingArea.id;

      await tx.siteFinishingScheduleArea.update({
        where: {
          id: existingArea.id,
        },
        data: {
          label: integrityArea.label,
        },
      });

      await tx.siteFinishingScheduleItem.deleteMany({
        where: {
          areaId: existingArea.id,
        },
      });
    } else {
      // Create Integrity without touching any existing areas.
      const createdArea = await tx.siteFinishingScheduleArea.create({
        data: {
          scheduleId: schedule.id,
          name: integrityArea.name,
          label: integrityArea.label,
        },
        select: {
          id: true,
        },
      });

      areaId = createdArea.id;
    }

    // Add Integrity finishing items.
    await tx.siteFinishingScheduleItem.createMany({
      data: integrityArea.items.map((item, index) => ({
        areaId,
        zone: item.zone,
        position: item.position,
        product: item.product,
        colorCode: item.colorCode,
        supplier: "BUCO Montagu Gardens",
        sortOrder: index,
      })),
    });
  });

  // Verify result
  const summary = await prisma.siteFinishingSchedule.findUniqueOrThrow({
    where: {
      id: schedule.id,
    },
    select: {
      id: true,
      contractNo: true,
      site: {
        select: {
          name: true,
          code: true,
        },
      },
      areas: {
        select: {
          name: true,
          label: true,
          items: {
            select: {
              id: true,
              zone: true,
              position: true,
              product: true,
              colorCode: true,
              supplier: true,
            },
            orderBy: {
              sortOrder: "asc",
            },
          },
        },
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
  });

  console.log(
    JSON.stringify(
      {
        message: "Integrity finishing schedule added/updated successfully.",
        scheduleId: summary.id,
        contractNo: summary.contractNo,
        site: summary.site,
        integrity: summary.areas.find((area) => area.name === "Integrity"),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
