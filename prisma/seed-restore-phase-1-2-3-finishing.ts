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

/*
 * ORIGINAL MAIN BUILDING AREA
 *
 * Area name in the original schedule:
 * "Phase 1, 2 & 3"
 *
 * All items are INTERNAL.
 */
const phase123Items: SeedItem[] = [
  {
    zone: "INTERNAL",
    position: "Columns East Side",
    product: "Plascon TSA",
    colorCode: "Wake-Up Orange 05-A1-1",
    supplier: "AA Paints Durbanville",
  },
  {
    zone: "INTERNAL",
    position: "Columns North Side",
    product: "Plascon TSA",
    colorCode: "Indo Grotto B2-B1-1",
    supplier: "AA Paints Durbanville",
  },
  {
    zone: "INTERNAL",
    position: "Walls Main Colour",
    product: "Plascon TLS",
    colorCode: "Designer Grey 50YY63/041",
    supplier: "AA Paints Durbanville",
  },
  {
    zone: "INTERNAL",
    position: "Walls Accent Colour",
    product: "Plascon TLS",
    colorCode: "Grey Pannant 30BB31/022",
    supplier: "AA Paints Durbanville",
  },
  {
    zone: "INTERNAL",
    position: "Walls Feature Colour",
    product: "PEM 900",
    colorCode: "White",
    supplier: "AA Paints Durbanville",
  },
  {
    zone: "INTERNAL",
    position: "Walls",
    product: "Plascon TSA",
    colorCode: "Wake-Up Orange 05-A1-1",
    supplier: "AA Paints Durbanville",
  },
  {
    zone: "INTERNAL",
    position: "East graphics basement Walls",
    product: "Plascon TSA",
    colorCode: "Sienna Sky",
    supplier: "AA Paints Durbanville",
  },
  {
    zone: "INTERNAL",
    position: "Basement Lobby signage walls",
    product: "Plascon TSA",
    colorCode: "Indo Grotto B2-B1-1",
    supplier: "AA Paints Durbanville",
  },
  {
    zone: "INTERNAL",
    position: "Existing Concrete Walls",
    product: "Plascon TSA",
    colorCode: "City Fog GR-N01",
    supplier: "AA Paints Durbanville",
  },
  {
    zone: "INTERNAL",
    position: "Concrete Soffit",
    product: "PEM 900",
    colorCode: "White",
    supplier: "AA Paints Durbanville",
  },
  {
    zone: "INTERNAL",
    position: "Lobby Concrete Soffit",
    product: "Plascon TSA",
    colorCode: "Zanzibar Tarvern",
    supplier: "AA Paints Durbanville",
  },
  {
    zone: "INTERNAL",
    position: "Lobby Concrete Soffit",
    product: "PEM 900",
    colorCode: "White",
    supplier: "AA Paints Durbanville",
  },
  {
    zone: "INTERNAL",
    position: "Doors & Frames East",
    product: "W/B Velvaglo",
    colorCode: "Wake-Up Orange 05-A1-1",
    supplier: "AA Paints Durbanville",
  },
  {
    zone: "INTERNAL",
    position: "Doors & Frames East",
    product: "Plascoguard 900",
    colorCode: "Wake-Up Orange 05-A1-1",
    supplier: "AA Paints Durbanville",
  },
  {
    zone: "INTERNAL",
    position: "Doors & Frames North",
    product: "W/B Velvaglo",
    colorCode: "Indo Grotto B2-B1-1",
    supplier: "AA Paints Durbanville",
  },
  {
    zone: "INTERNAL",
    position: "Doors & Frames North",
    product: "Plascoguard 900",
    colorCode: "Indo Grotto B2-B1-1",
    supplier: "AA Paints Durbanville",
  },
];

/*
 * BASEMENT STAIRS IS A SEPARATE AREA.
 */
const basementStairsItems: SeedItem[] = [
  {
    zone: "INTERNAL",
    position: "Walls Main Colour",
    product: "PEM 1000",
    colorCode: "City Fog GR-N01 (100mm belt)",
    supplier: "AA Paints Durbanville",
  },
  {
    zone: "INTERNAL",
    position: "Steel Handrails",
    product: "W/B Velvaglo",
    colorCode: "City Fog GR-N01",
    supplier: "AA Paints Durbanville",
  },
];

async function restoreArea(
  tx: PrismaClient,
  scheduleId: string,
  name: string,
  label: string,
  items: SeedItem[],
  sortOrder: number,
) {
  const existingArea = await tx.siteFinishingScheduleArea.findFirst({
    where: {
      scheduleId,
      name,
    },
    select: {
      id: true,
    },
  });

  let areaId: string;

  if (existingArea) {
    /*
     * Only refresh this specific area.
     * Nothing else in the schedule is touched.
     */
    areaId = existingArea.id;

    await tx.siteFinishingScheduleArea.update({
      where: {
        id: existingArea.id,
      },
      data: {
        label,
        sortOrder,
      },
    });

    await tx.siteFinishingScheduleItem.deleteMany({
      where: {
        areaId: existingArea.id,
      },
    });
  } else {
    const createdArea = await tx.siteFinishingScheduleArea.create({
      data: {
        scheduleId,
        name,
        label,
        sortOrder,
      },
      select: {
        id: true,
      },
    });

    areaId = createdArea.id;
  }

  await tx.siteFinishingScheduleItem.createMany({
    data: items.map((item, index) => ({
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

  return areaId;
}

async function main() {
  /*
   * Find site 6557.
   */
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
   * We intentionally do not create a new one.
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
        "This restore seed will NOT create a new schedule.",
    );
  }

  await prisma.$transaction(async (tx) => {
    /*
     * IMPORTANT:
     *
     * We DO NOT update siteFinishingSchedule.
     *
     * Therefore the header remains completely untouched.
     *
     * We ONLY restore:
     *
     *   1. Phase 1, 2 & 3
     *   2. Basement Stairs
     *
     * Accenture, Integrity, LUNO Offices, RGA and
     * Staircases and Lobby Areas are NOT touched.
     */

    await restoreArea(
      tx as unknown as PrismaClient,
      schedule.id,
      "Phase 1, 2 & 3",
      "Main Riverlands Building – Phase 1, 2 & 3",
      phase123Items,
      0,
    );

    await restoreArea(
      tx as unknown as PrismaClient,
      schedule.id,
      "Basement Stairs",
      "Basement Stairs finishing schedule",
      basementStairsItems,
      1,
    );
  });

  /*
   * Verify the two restored areas.
   */
  const result = await prisma.siteFinishingSchedule.findUniqueOrThrow({
    where: {
      id: schedule.id,
    },
    select: {
      id: true,
      contractNo: true,
      areas: {
        where: {
          name: {
            in: ["Phase 1, 2 & 3", "Basement Stairs"],
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
          sortOrder: "asc",
        },
      },
    },
  });

  console.log(
    JSON.stringify(
      {
        message: "Main Riverlands finishing areas restored successfully.",
        scheduleId: result.id,
        contractNo: result.contractNo,
        restoredAreas: result.areas.map((area) => ({
          name: area.name,
          itemCount: area.items.length,
          items: area.items,
        })),
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
