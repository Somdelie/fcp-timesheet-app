import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  type FinishingZone,
} from "../generated/prisma/client.js";

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const lunoArea = {
  name: "LUNO Offices",
  label: "LUNO Offices finishing schedule",

  items: [
    {
      zone: "INTERNAL" as FinishingZone,
      position: "Internal Walls",
      product: "Dulux Trade 100",
      colorCode: "Quiet Hideaway 81YY 81/016",
      supplier: "JET Paints Blooberg",
    },
    {
      zone: "INTERNAL" as FinishingZone,
      position: "Internal Walls",
      product: "Dulux Trade 100",
      colorCode: "Pure Blue 62BB-08/367",
      supplier: "JET Paints Blooberg",
    },
    {
      zone: "INTERNAL" as FinishingZone,
      position: "Concrete Soffit and Bulkhead",
      product: "Dulux Trade 65",
      colorCode: "Quiet Hideaway 81YY 81/016",
      supplier: "JET Paints Blooberg",
    },
    {
      zone: "INTERNAL" as FinishingZone,
      position: "Doors and Frames",
      product: "Dulux Pearlglo",
      colorCode: "Quiet Hideaway 81YY 81/016",
      supplier: "JET Paints Blooberg",
    },
    {
      zone: "INTERNAL" as FinishingZone,
      position: "Skirtings",
      product: "Dulux Pearlglo",
      colorCode: "Quiet Hideaway 81YY 81/016",
      supplier: "JET Paints Blooberg",
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
   * We do NOT create a new schedule.
   * We do NOT update the schedule header.
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
     * Only the LUNO Offices area is touched.
     *
     * No schedule header fields are updated.
     * No other finishing areas are deleted or modified.
     */

    const existingArea = await tx.siteFinishingScheduleArea.findFirst({
      where: {
        scheduleId: schedule.id,
        name: lunoArea.name,
      },
      select: {
        id: true,
      },
    });

    let areaId: string;

    if (existingArea) {
      /*
       * LUNO Offices already exists.
       *
       * Refresh ONLY its items so this seed is safe
       * to run again without creating duplicates.
       */
      areaId = existingArea.id;

      await tx.siteFinishingScheduleArea.update({
        where: {
          id: existingArea.id,
        },
        data: {
          label: lunoArea.label,
        },
      });

      await tx.siteFinishingScheduleItem.deleteMany({
        where: {
          areaId: existingArea.id,
        },
      });
    } else {
      /*
       * LUNO Offices does not exist yet.
       * Create only this new area.
       */
      const createdArea = await tx.siteFinishingScheduleArea.create({
        data: {
          scheduleId: schedule.id,
          name: lunoArea.name,
          label: lunoArea.label,
        },
        select: {
          id: true,
        },
      });

      areaId = createdArea.id;
    }

    /*
     * Add the LUNO Offices finishing items.
     */
    await tx.siteFinishingScheduleItem.createMany({
      data: lunoArea.items.map((item, index) => ({
        areaId,
        zone: item.zone,
        position: item.position,
        product: item.product,
        colorCode: item.colorCode,
        supplier: item.supplier,
        note: null,
        sortOrder: index,
      })),
    });
  });

  /*
   * Verify ONLY the LUNO area.
   */
  const luno = await prisma.siteFinishingScheduleArea.findFirst({
    where: {
      scheduleId: schedule.id,
      name: "LUNO Offices",
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
  });

  console.log(
    JSON.stringify(
      {
        message: "LUNO Offices finishing schedule added/updated successfully.",
        scheduleId: schedule.id,
        contractNo: schedule.contractNo,
        site,
        luno,
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
