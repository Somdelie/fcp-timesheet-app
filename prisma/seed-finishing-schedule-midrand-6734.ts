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
  supplier: string;
};

type SeedArea = {
  name: string;
  label: string;
  items: SeedItem[];
};

const finishingAreas: SeedArea[] = [
  {
    name: "Back of house",
    label: "Back of house finishing schedule",
    items: [
      {
        zone: "INTERNAL" as FinishingZone,
        position: "Walls",
        product: "Plascon TLS",
        colorCode: "GR-Y06 Orchid Bay",
        supplier: "DIY Savoy Plascon",
      },
      {
        zone: "INTERNAL" as FinishingZone,
        position: "Doors and doorframes",
        product: "Plascon TVW",
        colorCode: "GR-Y06 Orchid Bay",
        supplier: "DIY Savoy Plascon",
      },
    ],
  },

  {
    name: "Roastery",
    label: "Roastery finishing schedule",
    items: [
      {
        zone: "INTERNAL" as FinishingZone,
        position: "Walls",
        product: "Plascon TLS",
        colorCode: "07-B2-3 Whipped Cream",
        supplier: "DIY Savoy Plascon",
      },
      {
        zone: "INTERNAL" as FinishingZone,
        position: "Ceilings",
        product: "Plascon TSA",
        colorCode: "07-B2-3 Whipped Cream",
        supplier: "DIY Savoy Plascon",
      },
    ],
  },

  {
    name: "Catering store",
    label: "Catering store finishing schedule",
    items: [
      {
        zone: "INTERNAL" as FinishingZone,
        position: "Walls",
        product: "Plascon TLS",
        colorCode: "GR-Y06 Orchid Bay",
        supplier: "DIY Savoy Plascon",
      },
      {
        zone: "INTERNAL" as FinishingZone,
        position: "Doors and doorframes",
        product: "Plascon TVW",
        colorCode: "GR-Y06 Orchid Bay",
        supplier: "DIY Savoy Plascon",
      },
      {
        zone: "INTERNAL" as FinishingZone,
        position: "Fire doors and doorframes",
        product: "Plascon TVW",
        colorCode: "GR-B12 Zanzibar Tarven",
        supplier: "DIY Savoy Plascon",
      },
    ],
  },

  {
    name: "External staircase",
    label: "External staircase finishing schedule",
    items: [
      {
        zone: "EXTERNAL" as FinishingZone,
        position: "Walls",
        product: "Plascon TLS",
        colorCode: "07-B2-3 Whipped Cream",
        supplier: "DIY Savoy Plascon",
      },
      {
        zone: "EXTERNAL" as FinishingZone,
        position: "Ceilings",
        product: "Plascon TSA",
        colorCode: "07-B2-3 Whipped Cream",
        supplier: "DIY Savoy Plascon",
      },
    ],
  },

  {
    name: "Gym",
    label: "Gym finishing schedule",
    items: [
      {
        zone: "INTERNAL" as FinishingZone,
        position: "Walls main colour",
        product: "Plascon TLS",
        colorCode: "GR-B12 Zanzibar Tarven",
        supplier: "DIY Savoy Plascon",
      },
      {
        zone: "INTERNAL" as FinishingZone,
        position: "Walls accent colour to bathroom passage",
        product: "Plascon TLS",
        colorCode: "RAL 2010 Signal Orange",
        supplier: "DIY Savoy Plascon",
      },
      {
        zone: "INTERNAL" as FinishingZone,
        position: "Wall for bend",
        product: "Plascon TLS",
        colorCode: "RAL 2009 Traffic Orange",
        supplier: "DIY Savoy Plascon",
      },
      {
        zone: "INTERNAL" as FinishingZone,
        position: "Soffits",
        product: "URP004 Plascon TradePro Roof Paint",
        colorCode: "TSA",
        supplier: "DIY Savoy",
      },
      {
        zone: "INTERNAL" as FinishingZone,
        position: "Female / Male locker room walls",
        product: "Plascon TLS",
        colorCode: "GR-B12 Zanzibar Tarven",
        supplier: "DIY Savoy Plascon",
      },
    ],
  },
];

async function main() {
  // Site code is the contract number.
  const site = await prisma.site.findUnique({
    where: {
      code: "6734",
    },
    select: {
      id: true,
      name: true,
      code: true,
    },
  });

  if (!site) {
    throw new Error("Site with code 6734 was not found.");
  }

  // Find the existing finishing schedule.
  // We NEVER create a new schedule and NEVER update its header.
  const schedule = await prisma.siteFinishingSchedule.findFirst({
    where: {
      siteId: site.id,
      contractNo: "6734",
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
      "Existing finishing schedule for site 6734 was not found. " +
        "This seed will NOT create a new schedule.",
    );
  }

  await prisma.$transaction(async (tx) => {
    /*
     * IMPORTANT:
     *
     * We only touch these five areas:
     * - Back of house
     * - Roastery
     * - Catering store
     * - External staircase
     * - Gym
     *
     * NO finishing schedule header fields are updated.
     * NO other areas are deleted or changed.
     */

    for (const area of finishingAreas) {
      const existingArea = await tx.siteFinishingScheduleArea.findFirst({
        where: {
          scheduleId: schedule.id,
          name: area.name,
        },
        select: {
          id: true,
        },
      });

      let areaId: string;

      if (existingArea) {
        // Area already exists.
        // Refresh ONLY this area's items so the seed is safe to rerun.

        areaId = existingArea.id;

        await tx.siteFinishingScheduleArea.update({
          where: {
            id: existingArea.id,
          },
          data: {
            label: area.label,
          },
        });

        await tx.siteFinishingScheduleItem.deleteMany({
          where: {
            areaId: existingArea.id,
          },
        });
      } else {
        // Area does not exist yet.
        // Create only this area.

        const createdArea = await tx.siteFinishingScheduleArea.create({
          data: {
            scheduleId: schedule.id,
            name: area.name,
            label: area.label,
          },
          select: {
            id: true,
          },
        });

        areaId = createdArea.id;
      }

      await tx.siteFinishingScheduleItem.createMany({
        data: area.items.map((item, index) => ({
          areaId,
          zone: item.zone,
          position: item.position,
          product: item.product,
          colorCode: item.colorCode,
          supplier: item.supplier,
          sortOrder: index,
        })),
      });
    }
  });

  // Verify the five seeded areas.
  const seededAreas = await prisma.siteFinishingScheduleArea.findMany({
    where: {
      scheduleId: schedule.id,
      name: {
        in: finishingAreas.map((area) => area.name),
      },
    },
    select: {
      id: true,
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
      name: "asc",
    },
  });

  console.log(
    JSON.stringify(
      {
        message:
          "Midrand Warehouse 6A finishing schedule areas seeded successfully.",
        scheduleId: schedule.id,
        contractNo: schedule.contractNo,
        site,
        areas: seededAreas,
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
