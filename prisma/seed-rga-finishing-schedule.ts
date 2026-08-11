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
  note?: string;
};

const rgaArea = {
  name: "RGA",
  label: "RGA finishing schedule",

  items: [
    {
      zone: "INTERNAL" as FinishingZone,
      position: "Internal Walls",
      product: "Dulux Trade 100",
      colorCode: "30YY 68/024",
      supplier: "JET Paints Bloomberg",
    },
    {
      zone: "INTERNAL" as FinishingZone,
      position: "Internal Walls",
      product: "Dulux Trade 100",
      colorCode: "30YY 46/086",
      supplier: "JET Paints Bloomberg",
    },
    {
      zone: "INTERNAL" as FinishingZone,
      position: "Internal Walls",
      product: "Dulux Trade 100",
      colorCode: "30RB 49/042 Kittle Lilac",
      supplier: "JET Paints Bloomberg",
    },
    {
      zone: "INTERNAL" as FinishingZone,
      position: "Internal Walls",
      product: "Dulux Trade 100",
      colorCode: "27GY 10/029 Slate Dream",
      supplier: "JET Paints Bloomberg",
    },
    {
      zone: "INTERNAL" as FinishingZone,
      position: "Internal Walls",
      product: "Dulux Trade 100",
      colorCode: "30BG 40/050 Spa Blue",
      supplier: "JET Paints Bloomberg",
    },
    {
      zone: "INTERNAL" as FinishingZone,
      position: "Internal Walls",
      product: "Dulux Trade 100",
      colorCode: "White",
      supplier: "JET Paints Bloomberg",
    },
    {
      zone: "INTERNAL" as FinishingZone,
      position: "Concrete Soffit",
      product: "Dulux Acrylic PVA",
      colorCode: "SkyLight Darkness 09BB 07/00",
      supplier: "JET Paints Bloomberg",
    },
    {
      zone: "INTERNAL" as FinishingZone,
      position: "Ceilings",
      product: "Dulux Trade 65",
      colorCode: "White",
      supplier: "JET Paints Bloomberg",
    },
    {
      zone: "INTERNAL" as FinishingZone,
      position: "Doors and Frames",
      product: "Dulux White Pearlglo",
      colorCode: "White",
      supplier: "JET Paints Bloomberg",
    },
  ],
};

async function main() {
  // Site code is the contract number.
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

  // Find the existing finishing schedule.
  // We NEVER create a new schedule and NEVER update its header.
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
     * We only touch the RGA area.
     *
     * NO finishing schedule header fields are updated.
     * NO other areas are deleted or changed.
     */

    const existingArea = await tx.siteFinishingScheduleArea.findFirst({
      where: {
        scheduleId: schedule.id,
        name: rgaArea.name,
      },
      select: {
        id: true,
      },
    });

    let areaId: string;

    if (existingArea) {
      /*
       * RGA already exists.
       *
       * Refresh ONLY RGA items so this seed
       * can safely be run again.
       */
      areaId = existingArea.id;

      await tx.siteFinishingScheduleArea.update({
        where: {
          id: existingArea.id,
        },
        data: {
          label: rgaArea.label,
        },
      });

      await tx.siteFinishingScheduleItem.deleteMany({
        where: {
          areaId: existingArea.id,
        },
      });
    } else {
      /*
       * RGA does not exist yet.
       *
       * Create only the new area.
       */
      const createdArea = await tx.siteFinishingScheduleArea.create({
        data: {
          scheduleId: schedule.id,
          name: rgaArea.name,
          label: rgaArea.label,
        },
        select: {
          id: true,
        },
      });

      areaId = createdArea.id;
    }

    /*
     * Add the RGA finishing items.
     */
    await tx.siteFinishingScheduleItem.createMany({
      data: rgaArea.items.map((item, index) => ({
        areaId,
        zone: item.zone,
        position: item.position,
        product: item.product,
        colorCode: item.colorCode,
        supplier: item.supplier,
        sortOrder: index,
      })),
    });
  });

  /*
   * Verify only the RGA area.
   */
  const rga = await prisma.siteFinishingScheduleArea.findFirst({
    where: {
      scheduleId: schedule.id,
      name: "RGA",
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
        message: "RGA finishing schedule added/updated successfully.",
        scheduleId: schedule.id,
        contractNo: schedule.contractNo,
        site,
        rga,
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
