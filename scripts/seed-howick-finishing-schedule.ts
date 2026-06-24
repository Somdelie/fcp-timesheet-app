import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type FinishingZone } from "../generated/prisma/client.js";

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
    name: "External Walls",
    label: "External paint and steel finishes",
    items: [
      {
        zone: "EXTERNAL",
        position: "Light colour (Brick)",
        product: "TPX1000",
        colorCode: "E16-5 Tent",
        note: "We spray",
      },
      {
        zone: "EXTERNAL",
        position: "Dark plastered walls",
        product: "Versus suede",
        colorCode: "VS 17006 C250829",
      },
      {
        zone: "EXTERNAL",
        position: "Back entrance brick wall",
        product: "E16-3",
        colorCode: "Mayor Tsa",
      },
      {
        zone: "EXTERNAL",
        position: "Front entrance brick wall",
        product: "E16-3",
        colorCode: "Mayor Tsa",
      },
      {
        zone: "EXTERNAL",
        position: "Fire staircase walls",
        product: "TPX1000",
        colorCode: "E16-5 Tent",
      },
      {
        zone: "EXTERNAL",
        position: "All steel work",
        product: "TRP200",
        colorCode: "Atmosphere Grey",
      },
      {
        zone: "EXTERNAL",
        position: "Steel palisade fence",
        product: "TRP200",
        colorCode: "Atmosphere Grey",
      },
    ],
  },
  {
    name: "Internal Walls",
    label: "Internal paint and finish specifications",
    items: [
      {
        zone: "INTERNAL",
        position: "Office area",
        product: "PEM600",
        colorCode: "White",
      },
      {
        zone: "INTERNAL",
        position: "All offices steel work",
        product: "TVW 13/02/2025",
        colorCode: "Howick Close Bronze",
      },
      {
        zone: "INTERNAL",
        position: "Main staircase",
        product: "TLS",
        colorCode: "E16-3 Mayor 2 shades light",
      },
      {
        zone: "INTERNAL",
        position: "Bathroom walls",
        product: "TLS",
        colorCode: "E16-3 Mayor 2 shades lighter",
      },
      {
        zone: "INTERNAL",
        position: "Bathroom doors",
        product: "Monocoat",
        colorCode: "Light Roast",
      },
      {
        zone: "INTERNAL",
        position: "Duct floor",
        product: "Plascon Stoep enamel",
        colorCode: "Navy Light Grey",
      },
      {
        zone: "INTERNAL",
        position: "Basement soffits",
        product: "PEM600",
        colorCode: "White",
      },
      {
        zone: "INTERNAL",
        position: "Basement soffit walls",
        product: "PEM600",
        colorCode: "White",
      },
      {
        zone: "INTERNAL",
        position: "Basement ceiling boards",
        product: "PEM1000",
        colorCode: "White",
      },
    ],
  },
];

async function main() {
  const site = await prisma.site.findUnique({
    where: { code: "6271" },
    select: { id: true, name: true, code: true },
  });

  if (!site) {
    throw new Error("Site with code 6271 was not found.");
  }

  const existing = await prisma.siteFinishingSchedule.findFirst({
    where: { siteId: site.id, contractNo: "6271" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  const schedule = await prisma.$transaction(async (tx) => {
    const saved = existing
      ? await tx.siteFinishingSchedule.update({
          where: { id: existing.id },
          data: {
            siteAddress: "Waterfall Office Park",
            contractNo: "6271",
            contractManager: null,
            siteForeman: null,
            fcpContractManager: "Nicholas Kwinika",
            fcpQs: null,
            fcpSiteForeman: "Wellington Ncube",
            client: "Capex",
            startDate: new Date("2025-03-01T00:00:00.000Z"),
            completionDate: new Date("2025-09-30T00:00:00.000Z"),
          },
          select: { id: true },
        })
      : await tx.siteFinishingSchedule.create({
          data: {
            siteId: site.id,
            siteAddress: "Waterfall Office Park",
            contractNo: "6271",
            contractManager: null,
            siteForeman: null,
            fcpContractManager: "Nicholas Kwinika",
            fcpQs: null,
            fcpSiteForeman: "Wellington Ncube",
            client: "Capex",
            startDate: new Date("2025-03-01T00:00:00.000Z"),
            completionDate: new Date("2025-09-30T00:00:00.000Z"),
          },
          select: { id: true },
        });

    await tx.siteFinishingScheduleArea.deleteMany({
      where: { scheduleId: saved.id },
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
    where: { id: schedule.id },
    select: {
      id: true,
      contractNo: true,
      site: { select: { name: true, code: true } },
      areas: {
        select: { name: true, items: { select: { id: true } } },
        orderBy: { sortOrder: "asc" },
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
