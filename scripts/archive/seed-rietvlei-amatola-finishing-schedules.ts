import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  type ColorBaseType,
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
};

type SeedArea = {
  name: string;
  label: string;
  items: SeedItem[];
};

type SeedSchedule = {
  siteCode: string;
  siteName: string;
  contractNo: string;
  siteAddress: string | null;
  fcpContractManager: string;
  fcpQs: string;
  fcpSiteForeman: string;
  client: string;
  contractManager: string;
  siteForeman: string;
  startDate: string;
  completionDate: string | null;
  areas: SeedArea[];
};

const schedules: SeedSchedule[] = [
  {
    siteCode: "6663",
    siteName: "Rietvlei Bp-Rugged sa",
    contractNo: "6663",
    siteAddress: null,
    fcpContractManager: "Nicholas Kwinika",
    fcpQs: "Shelly",
    fcpSiteForeman: "David Nkwinika",
    client: "Archstone Construction",
    contractManager: "Gert Bodenstein",
    siteForeman: "Jabu Mahlangu",
    startDate: "2026-03-31",
    completionDate: "2026-05-15",
    areas: [
      {
        name: "External",
        label: "External walls, steelwork and yard finishes",
        items: [
          {
            zone: "EXTERNAL",
            position: "Main building walls",
            product: "PTX1400 / Fresh Cote",
            colorCode: "Top coat PEM1000 White",
          },
          {
            zone: "EXTERNAL",
            position: "Guardhouse main colour",
            product: "PTX1400 / Fresh Cote",
            colorCode: "Top coat PEM1000 White",
          },
          {
            zone: "EXTERNAL",
            position: "Guardhouse accent colour",
            product: "PTX1400 / Fresh Cote",
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
            position: "Transformer doorframe",
            product: "TVW",
            colorCode: "RAL9005 Jet Black",
          },
        ],
      },
      {
        name: "Internal",
        label: "Internal walls, doors, steelwork and boards",
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
            position: "Warehouse steel staircase and timber ceilings under mezzanine floor",
            product: "G2 Gloss Enamel",
            colorCode: "Black",
          },
          {
            zone: "INTERNAL",
            position: "Warehouse doorframes",
            product: "W/B Velvaglo",
            colorCode: "RAL9005 Jet Black",
          },
          {
            zone: "INTERNAL",
            position: "Fire doors",
            product: "W/B Velvaglo",
            colorCode: "GR-B09 Berlin Block",
          },
          {
            zone: "INTERNAL",
            position: "Fire doorframes",
            product: "W/B Velvaglo",
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
    ],
  },
  {
    siteCode: "6664",
    siteName: "Rietvlei Bp-package it",
    contractNo: "6664",
    siteAddress: null,
    fcpContractManager: "Nicholas Kwinika",
    fcpQs: "Shelly",
    fcpSiteForeman: "David Nkwinika",
    client: "Archstone Construction",
    contractManager: "Gert Bodenstein",
    siteForeman: "Nelson Chauke",
    startDate: "2026-04-09",
    completionDate: null,
    areas: [
      {
        name: "External",
        label: "External walls, steelwork and yard finishes",
        items: [
          {
            zone: "EXTERNAL",
            position: "Office block main colour walls",
            product: "PTX1400 / Fresh Cote",
            colorCode: "PEM1000 White top coat",
          },
          {
            zone: "EXTERNAL",
            position: "Accent colour",
            product: "PTX1400 / Fresh Cote",
            colorCode: "TLS GR-B09 Berlin Block",
          },
          {
            zone: "EXTERNAL",
            position: "Guardhouse main colour",
            product: "PTX1400",
            colorCode: "PEM1000 White top coat",
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
            position: "Transformer doorframe",
            product: "TVW",
            colorCode: "RAL9005 Jet Black",
          },
        ],
      },
      {
        name: "Internal",
        label: "Internal offices, doors, ceilings and warehouse finishes",
        items: [
          {
            zone: "INTERNAL",
            position: "Main colour offices",
            product: "TLS",
            colorCode: "Mandarin Tusk 49",
          },
          {
            zone: "INTERNAL",
            position: "Accent colour",
            product: "TLS",
            colorCode: "Aluminum Snow 45",
          },
          {
            zone: "INTERNAL",
            position: "Ceilings",
            product: "PEM600",
            colorCode: "White",
          },
          {
            zone: "INTERNAL",
            position: "Service duct walls",
            product: "TSA",
            colorCode: "Aluminum Snow 45",
          },
          {
            zone: "INTERNAL",
            position: "All doors",
            product: "TVW",
            colorCode: "GR-B09 Berlin Block",
          },
          {
            zone: "INTERNAL",
            position: "All doorframes",
            product: "TVW",
            colorCode: "RAL9005 Jet Black",
          },
          {
            zone: "INTERNAL",
            position: "Bollards and corner protectors",
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
            position: "Warehouse steel staircase",
            product: "TVW",
            colorCode: "Aluminum Snow 45",
          },
        ],
      },
      {
        name: "Wash Bay Rooms",
        label: "Wash bay room wall finishes",
        items: [
          {
            zone: "INTERNAL",
            position: "Walls",
            product: "TLS",
            colorCode: "Aluminum Snow 45",
          },
        ],
      },
    ],
  },
  {
    siteCode: "6751",
    siteName: "Amatola development",
    contractNo: "6751",
    siteAddress: null,
    fcpContractManager: "Nicholas Kwinika",
    fcpQs: "Kabelo April",
    fcpSiteForeman: "Armando Chilengue",
    client: "Millennium Construction",
    contractManager: "Brett White",
    siteForeman: "Hendrick",
    startDate: "2026-05-11",
    completionDate: "2026-06-22",
    areas: [
      {
        name: "Internal",
        label: "Internal ceilings, walls, timber and steel finishes",
        items: [
          {
            zone: "INTERNAL",
            position: "Ceilings",
            product: "Trade 65",
            colorCode: "White",
          },
          {
            zone: "INTERNAL",
            position: "Bathroom walls",
            product: "Trade 100",
            colorCode: "GR-Y05 Antique Petal",
          },
          {
            zone: "INTERNAL",
            position: "Bathroom door",
            product: "Rubio Monocoat",
            colorCode: "Natural",
          },
          {
            zone: "INTERNAL",
            position: "Bathroom ceilings",
            product: "Trade 65",
            colorCode: "White",
          },
          {
            zone: "INTERNAL",
            position: "Offices accent wall",
            product: "Trade 100",
            colorCode: "Tribecca Corner 48",
          },
          {
            zone: "INTERNAL",
            position: "Steel staircase",
            product: "W/B Pearlglow",
            colorCode: "7021 Black Grey",
          },
          {
            zone: "INTERNAL",
            position: "Offices bulkheads",
            product: "Acrylic PVA",
            colorCode: "Tribecca Corner 48",
          },
          {
            zone: "INTERNAL",
            position: "Offices skirtings",
            product: "W/B Pearlglow",
            colorCode: "7021 Black Grey",
          },
        ],
      },
      {
        name: "External",
        label: "External gate, refuse yard and sill finishes",
        items: [
          {
            zone: "EXTERNAL",
            position: "Main steel gate",
            product: "W/B Pearlglow",
            colorCode: "7021 Black Grey",
          },
          {
            zone: "EXTERNAL",
            position: "Refuse yard door and doorframe",
            product: "W/B Pearlglow",
            colorCode: "7021 Black Grey",
          },
          {
            zone: "EXTERNAL",
            position: "Refuse yard top band plaster",
            product: "Outstanding colour",
            colorCode: "Outstanding colour",
          },
          {
            zone: "EXTERNAL",
            position: "External window sills",
            product: "Outstanding colour",
            colorCode: "Outstanding colour",
          },
        ],
      },
    ],
  },
];

function asDate(value: string | null) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function normalise(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function inferBaseType(text: string): ColorBaseType {
  if (/\bwhite\b/i.test(text)) return "WHITE";
  if (/\bpastel\b/i.test(text)) return "PASTEL";
  if (/\bdeep\b/i.test(text)) return "DEEP";
  if (/\bclear|transparent|transp\b/i.test(text)) return "CLEAR";
  return "NEUTRAL";
}

function uniqueColourRows(schedule: SeedSchedule) {
  const seen = new Set<string>();
  const rows: Array<{
    colorName: string;
    baseType: ColorBaseType;
    productSnapshot: string;
  }> = [];

  for (const area of schedule.areas) {
    for (const item of area.items) {
      const colorName = item.colorCode.trim();
      const key = `${normalise(colorName)}::${normalise(item.product)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        colorName,
        baseType: inferBaseType(colorName),
        productSnapshot: item.product,
      });
    }
  }

  return rows;
}

async function sitePaintColorTableExists() {
  const result = await prisma.$queryRawUnsafe<Array<{ table_name: string | null }>>(
    `select to_regclass('public."SitePaintColor"')::text as table_name`,
  );
  return Boolean(result[0]?.table_name);
}

async function seedOne(schedule: SeedSchedule, canSeedSiteColors: boolean) {
  const site = await prisma.site.upsert({
    where: { code: schedule.siteCode },
    update: { name: schedule.siteName, isActive: true },
    create: {
      code: schedule.siteCode,
      name: schedule.siteName,
      isActive: true,
    },
    select: { id: true, code: true, name: true },
  });

  const existing = await prisma.siteFinishingSchedule.findFirst({
    where: { siteId: site.id, contractNo: schedule.contractNo },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  const saved = await prisma.$transaction(async (tx) => {
    const header = {
      siteAddress: schedule.siteAddress,
      contractNo: schedule.contractNo,
      contractManager: schedule.contractManager,
      siteForeman: schedule.siteForeman,
      fcpContractManager: schedule.fcpContractManager,
      fcpQs: schedule.fcpQs,
      fcpSiteForeman: schedule.fcpSiteForeman,
      client: schedule.client,
      startDate: asDate(schedule.startDate),
      completionDate: asDate(schedule.completionDate),
    };

    const row = existing
      ? await tx.siteFinishingSchedule.update({
          where: { id: existing.id },
          data: header,
          select: { id: true },
        })
      : await tx.siteFinishingSchedule.create({
          data: { siteId: site.id, ...header },
          select: { id: true },
        });

    await tx.siteFinishingScheduleArea.deleteMany({
      where: { scheduleId: row.id },
    });

    for (const [areaIndex, area] of schedule.areas.entries()) {
      await tx.siteFinishingScheduleArea.create({
        data: {
          scheduleId: row.id,
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
              sortOrder: itemIndex,
            })),
          },
        },
      });
    }

    return row;
  });

  let siteColoursCreated = 0;
  let siteColoursSkipped = 0;
  if (canSeedSiteColors) {
    for (const row of uniqueColourRows(schedule)) {
      const existingColour = await prisma.sitePaintColor.findFirst({
        where: {
          siteId: site.id,
          colorName: { equals: row.colorName, mode: "insensitive" },
          productSnapshot: { equals: row.productSnapshot, mode: "insensitive" },
        },
        select: { id: true },
      });

      if (existingColour) {
        siteColoursSkipped += 1;
        continue;
      }

      await prisma.sitePaintColor.create({
        data: {
          siteId: site.id,
          productSnapshot: row.productSnapshot,
          colorName: row.colorName,
          baseType: row.baseType,
          isTinted: !["WHITE", "NEUTRAL"].includes(row.baseType),
          rawDescription: `${row.productSnapshot}: ${row.colorName}`,
          sourceFile: "manual finishing schedule seed",
        },
      });
      siteColoursCreated += 1;
    }
  }

  const summary = await prisma.siteFinishingSchedule.findUniqueOrThrow({
    where: { id: saved.id },
    select: {
      id: true,
      contractNo: true,
      site: { select: { code: true, name: true } },
      areas: {
        orderBy: { sortOrder: "asc" },
        select: { name: true, items: { select: { id: true } } },
      },
    },
  });

  return {
    scheduleId: summary.id,
    contractNo: summary.contractNo,
    site: summary.site,
    areas: summary.areas.map((area) => ({
      name: area.name,
      itemCount: area.items.length,
    })),
    siteColoursCreated,
    siteColoursSkipped,
  };
}

async function main() {
  const canSeedSiteColors = await sitePaintColorTableExists();
  const results = [];

  for (const schedule of schedules) {
    results.push(await seedOne(schedule, canSeedSiteColors));
  }

  console.log(
    JSON.stringify(
      {
        sitePaintColorTableAvailable: canSeedSiteColors,
        results,
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
