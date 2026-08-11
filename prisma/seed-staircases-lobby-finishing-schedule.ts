import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  type FinishingZone,
} from "../generated/prisma/client.js";

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const area = {
  name: "Staircases and Lobby Areas",
  label: "Staircases and lobby areas finishing schedule",

  items: [
    {
      zone: "INTERNAL" as FinishingZone,
      position: "Stairs – Walls",
      product: "Plascon White PM900",
      colorCode: "White",
      supplier: null,
    },
    {
      zone: "INTERNAL" as FinishingZone,
      position: "Stairs – Walls",
      product: "Plascon",
      colorCode: "City Fog GR-N01",
      supplier: null,
    },
    {
      zone: "INTERNAL" as FinishingZone,
      position: "Stairs – Handrails",
      product: "Plascon Plascothane 900",
      colorCode: "City Fog GR-N01",
      supplier: null,
    },
    {
      zone: "INTERNAL" as FinishingZone,
      position: "Lobby Areas – Walls",
      product: "Plascon",
      colorCode: "Mandarin Tusk GR-Y04",
      supplier: null,
    },
    {
      zone: "INTERNAL" as FinishingZone,
      position: "Lobby Areas – Ceilings",
      product: "Plascon White PM900",
      colorCode: "White",
      supplier: null,
    },
    {
      zone: "INTERNAL" as FinishingZone,
      position: "Lobby Areas – Ceilings",
      product: "Plascon",
      colorCode: "New York GR-N02",
      supplier: null,
      note: "TSA",
    },
  ],
};

async function main() {
  // Site code = contract number.
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

  /*
   * Find the EXISTING finishing schedule.
   *
   * We do NOT create another schedule.
   * We do NOT update the finishing schedule header.
   */
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
        "This seed will NOT create a new schedule.",
    );
  }

  await prisma.$transaction(async (tx) => {
    /*
     * IMPORTANT:
     *
     * ONLY this area is touched.
     *
     * No finishing schedule header fields are updated.
     * No Main Building data is touched.
     * No Basement Stairs data is touched.
     * No Accenture data is touched.
     * No Integrity data is touched.
     * No RGA data is touched.
     * No LUNO data is touched.
     */

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
      /*
       * Area already exists.
       * Refresh ONLY its items.
       */
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
      /*
       * Create only the new area.
       */
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

    /*
     * Add the six finishing items.
     */
    await tx.siteFinishingScheduleItem.createMany({
      data: area.items.map((item, index) => ({
        areaId,
        zone: item.zone,
        position: item.position,
        product: item.product,
        colorCode: item.colorCode,
        supplier: item.supplier,
        note: item.note ?? null,
        sortOrder: index,
      })),
    });
  });

  /*
   * Verify ONLY this area.
   */
  const result = await prisma.siteFinishingScheduleArea.findFirst({
    where: {
      scheduleId: schedule.id,
      name: area.name,
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
          note: true,
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
        message:
          "Staircases and Lobby Areas finishing schedule added/updated successfully.",
        scheduleId: schedule.id,
        contractNo: schedule.contractNo,
        site,
        area: result,
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
