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

const areas: Array<{
  name: string;
  label: string;
  items: SeedItem[];
}> = [
  {
    name: "External",
    label: "External paint and steel finishes",
    items: [
      {
        zone: "EXTERNAL",
        position: "Main building walls",
        product: "PTX1400",
        colorCode: "PEM1000 White Top Coat",
      },
      {
        zone: "EXTERNAL",
        position: "Guardhouse main colour",
        product: "PTX1400",
        colorCode: "PEM1000 White Top Coat",
      },
      {
        zone: "EXTERNAL",
        position: "Guardhouse accent colour",
        product: "PTX1400",
        colorCode: "TLS GR-B09 Berlin Block",
      },
      {
        zone: "EXTERNAL",
        position: "Bollards",
        product: "Road Marking Paint",
        colorCode: "Medium Yellow",
      },
      {
        zone: "EXTERNAL",
        position: "Steel cat ladder",
        product: "G2 Gloss Enamel",
        colorCode: "Black",
      },
      {
        zone: "EXTERNAL",
        position: "Refuse yard gate",
        product: "TVW",
        colorCode: "RAL9005 Jet Black",
      },
      {
        zone: "EXTERNAL",
        position: "Transformer doors",
        product: "TVW",
        colorCode: "GR-B09 Berlin Block",
      },
      {
        zone: "EXTERNAL",
        position: "Transformer door frames",
        product: "TVW",
        colorCode: "RAL9005 Jet Black",
      },
    ],
  },
  {
    name: "Internal",
    label: "Internal paint finishes",
    items: [
      {
        zone: "INTERNAL",
        position: "Warehouse bathroom walls",
        product: "TLS",
        colorCode: "Aluminum Snow 45",
      },
      {
        zone: "INTERNAL",
        position: "Warehouse bathroom doors",
        product: "TVW",
        colorCode: "GR-B09 Berlin Block",
      },
      {
        zone: "INTERNAL",
        position:
          "Warehouse steel staircase & timber ceilings under mezzanine floor",
        product: "G2 Gloss Enamel",
        colorCode: "Black",
      },
      {
        zone: "INTERNAL",
        position: "Warehouse door frames",
        product: "Water Based Velvaglo",
        colorCode: "RAL9005 Jet Black",
      },
      {
        zone: "INTERNAL",
        position: "Fire doors",
        product: "Water Based Velvaglo",
        colorCode: "GR-B09 Berlin Block",
      },
      {
        zone: "INTERNAL",
        position: "Fire door frames",
        product: "Water Based Velvaglo",
        colorCode: "RAL9005 Jet Black",
      },
      {
        zone: "INTERNAL",
        position: "Warehouse bollards",
        product: "Road Marking Paint",
        colorCode: "Medium Yellow",
      },
      {
        zone: "INTERNAL",
        position: "Backing boards",
        product: "TVW",
        colorCode: "GR-B09 Berlin Block",
      },
      {
        zone: "INTERNAL",
        position: "Office steel staircase",
        product: "Solvent Based Velvaglo",
        colorCode: "RAL9005 Jet Black",
      },
      {
        zone: "INTERNAL",
        position: "Service duct walls",
        product: "TSA",
        colorCode: "Aluminum Snow 45",
      },
    ],
  },
];

async function main() {
  const site = await prisma.site.findUnique({
    where: { code: "6663" },
    select: { id: true, name: true, code: true },
  });

  if (!site) {
    throw new Error("Site with code 6663 was not found.");
  }

  const existing = await prisma.siteFinishingSchedule.findFirst({
    where: {
      siteId: site.id,
      contractNo: "6663",
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
    },
  });

  const schedule = await prisma.$transaction(async (tx) => {
    const saved = existing
      ? await tx.siteFinishingSchedule.update({
          where: { id: existing.id },
          data: {
            siteAddress: "",
            contractNo: "6663",
            contractManager: "Gert Bodenstein",
            siteForeman: "Jabu Mahlangu",
            fcpContractManager: "Nicholas Kwinika",
            fcpQs: "Shelly",
            fcpSiteForeman: "David Nkwinika",
            client: "Archstone Construction",
            startDate: new Date("2026-03-31T00:00:00.000Z"),
            completionDate: new Date("2026-05-15T00:00:00.000Z"),
          },
          select: {
            id: true,
          },
        })
      : await tx.siteFinishingSchedule.create({
          data: {
            siteId: site.id,
            siteAddress: "",
            contractNo: "6663",
            contractManager: "Gert Bodenstein",
            siteForeman: "Jabu Mahlangu",
            fcpContractManager: "Nicholas Kwinika",
            fcpQs: "Shelly",
            fcpSiteForeman: "David Nkwinika",
            client: "Archstone Construction",
            startDate: new Date("2026-03-31T00:00:00.000Z"),
            completionDate: new Date("2026-05-15T00:00:00.000Z"),
          },
          select: {
            id: true,
          },
        });

    await tx.siteFinishingScheduleArea.deleteMany({
      where: {
        scheduleId: saved.id,
      },
    });

    for (const [areaIndex, area] of areas.entries()) {
      await tx.siteFinishingScheduleArea.create({
        data: {
          scheduleId: saved.id,
          name: area.name,
          label: area.label,
          sortOrder: areaIndex,
          items: {
            create: area.items.map((item, itemIndex) => ({
              zone: item.zone,
              position: item.position,
              product: item.product,
              colorCode: item.colorCode,
              supplier: null,
              note: item.note ?? null,
              sortOrder: itemIndex,
            })),
          },
        },
      });
    }

    return saved;
  });

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
          items: {
            select: {
              id: true,
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
        scheduleId: summary.id,
        contractNo: summary.contractNo,
        site: summary.site,
        areas: summary.areas.map((area) => ({
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
