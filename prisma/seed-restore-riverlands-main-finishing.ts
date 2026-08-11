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
 * ============================================================
 * CORRECT MAIN BUILDING AREA
 * ============================================================
 *
 * This is the area represented by the Main Riverlands
 * Building Finishing Schedule.
 *
 * IMPORTANT:
 *
 * "INTERNAL" is NOT the area.
 * "INTERNAL" is stored in the zone field.
 */

const MAIN_BUILDING_AREA =
  "MAIN BUILDING - MAIN RIVERLANDS BUILDING FINISHING SCHEDULE";

/*
 * These were created by the previous incorrect seeds.
 *
 * We will consolidate them into the correct area.
 */
const LEGACY_MAIN_BUILDING_AREAS = ["Main Building", "Phase 1, 2 & 3"];

const mainBuildingItems: SeedItem[] = [
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

async function main() {
  /*
   * ============================================================
   * FIND SITE
   * ============================================================
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
   * ============================================================
   * FIND EXISTING FINISHING SCHEDULE
   * ============================================================
   *
   * IMPORTANT:
   *
   * We ONLY read the schedule.
   *
   * We do NOT update:
   * - siteAddress
   * - contractNo
   * - client
   * - managers
   * - QS
   * - foreman
   * - dates
   * - any other header field
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
     * ==========================================================
     * 1. FIND THE CORRECT AREA IF IT ALREADY EXISTS
     * ==========================================================
     */

    let correctArea = await tx.siteFinishingScheduleArea.findFirst({
      where: {
        scheduleId: schedule.id,
        name: MAIN_BUILDING_AREA,
      },
      select: {
        id: true,
      },
    });

    /*
     * ==========================================================
     * 2. FIND OLD INCORRECT AREAS
     * ==========================================================
     */

    const legacyAreas = await tx.siteFinishingScheduleArea.findMany({
      where: {
        scheduleId: schedule.id,
        name: {
          in: LEGACY_MAIN_BUILDING_AREAS,
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    /*
     * ==========================================================
     * 3. IF CORRECT AREA DOESN'T EXIST,
     *    REUSE ONE OF THE OLD AREAS
     * ==========================================================
     */

    if (!correctArea) {
      const areaToReuse =
        legacyAreas.find((area) => area.name === "Main Building") ??
        legacyAreas.find((area) => area.name === "Phase 1, 2 & 3");

      if (areaToReuse) {
        /*
         * Rename the old area instead of creating another one.
         */
        correctArea = await tx.siteFinishingScheduleArea.update({
          where: {
            id: areaToReuse.id,
          },
          data: {
            name: MAIN_BUILDING_AREA,
            label: MAIN_BUILDING_AREA,
          },
          select: {
            id: true,
          },
        });
      } else {
        /*
         * No area exists at all.
         * Create the correct area.
         */
        correctArea = await tx.siteFinishingScheduleArea.create({
          data: {
            scheduleId: schedule.id,
            name: MAIN_BUILDING_AREA,
            label: MAIN_BUILDING_AREA,
          },
          select: {
            id: true,
          },
        });
      }
    } else {
      /*
       * Correct area already exists.
       * Keep it.
       */
      await tx.siteFinishingScheduleArea.update({
        where: {
          id: correctArea.id,
        },
        data: {
          label: MAIN_BUILDING_AREA,
        },
      });
    }

    /*
     * ==========================================================
     * 4. DELETE ONLY THE DUPLICATE LEGACY AREAS
     * ==========================================================
     *
     * If both "Main Building" and "Phase 1, 2 & 3" existed,
     * one has already been reused/renamed above.
     *
     * The other one must be removed.
     *
     * We remove its ITEMS first so there is no FK problem.
     */

    for (const legacyArea of legacyAreas) {
      if (legacyArea.id === correctArea.id) {
        continue;
      }

      await tx.siteFinishingScheduleItem.deleteMany({
        where: {
          areaId: legacyArea.id,
        },
      });

      await tx.siteFinishingScheduleArea.delete({
        where: {
          id: legacyArea.id,
        },
      });
    }

    /*
     * ==========================================================
     * 5. REPLACE ONLY MAIN BUILDING ITEMS
     * ==========================================================
     */

    await tx.siteFinishingScheduleItem.deleteMany({
      where: {
        areaId: correctArea.id,
      },
    });

    await tx.siteFinishingScheduleItem.createMany({
      data: mainBuildingItems.map((item, index) => ({
        areaId: correctArea.id,
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
   * ============================================================
   * VERIFY
   * ============================================================
   */

  const result = await prisma.siteFinishingSchedule.findUniqueOrThrow({
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

  const mainBuilding = result.areas.find(
    (area) => area.name === MAIN_BUILDING_AREA,
  );

  const remainingLegacyAreas = result.areas.filter((area) =>
    LEGACY_MAIN_BUILDING_AREAS.includes(area.name),
  );

  console.log(
    JSON.stringify(
      {
        message:
          "Main Riverlands Building finishing schedule corrected successfully.",

        scheduleId: result.id,

        contractNo: result.contractNo,

        site: result.site,

        mainBuilding: {
          name: mainBuilding?.name,
          itemCount: mainBuilding?.items.length ?? 0,
          items: mainBuilding?.items ?? [],
        },

        legacyAreasRemaining: remainingLegacyAreas.map((area) => area.name),

        allAreas: result.areas.map((area) => ({
          name: area.name,
          itemCount: area.items.length,
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
