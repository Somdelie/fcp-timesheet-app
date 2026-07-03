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
  supplier: string;
  note?: string;
};

type SeedArea = {
  name: string;
  label: string;
  items: SeedItem[];
};

const schedule = {
  siteCode: "6680",
  siteName: "VLEI LODGE PHINDA",
  contractNo: "6680",
  siteAddress: null,
  fcpContractManager: "Nicholas Kwinika",
  fcpQs: "JH Vermeulen (Henk)",
  fcpSiteForeman: "Sello Mmara",
  client: "Mikebuyskes",
  contractManager: "Jaco den Beer",
  siteForeman: null,
  startDate: "2026-02-10",
  completionDate: "2026-06-26",
  areas: [
    {
      name: "External/Internal Timber",
      label:
        "External/internal wooden frames, doors, trim, beams, cladding and rails",
      items: [
        "Wooden window frames",
        "Wooden doorframes",
        "Wooden doors",
        "Wooden skirtings",
        "Wooden trusses and beams",
        "Wooden cladding boards",
        "Timber balustrades and handrails",
        "Timber beams under decking",
      ].map((position) => ({
        zone: "EXTERNAL" as const,
        position: `External/internal ${position}`,
        product: "Timberlife Ultracare Gold",
        colorCode: "Black Burnt Amber",
        supplier: "Timberlife",
        note: "X2 double",
      })),
    },
    {
      name: "External Decking",
      label: "External timber decking finish",
      items: [
        {
          zone: "EXTERNAL" as const,
          position: "Timber decking",
          product: "Timberlife Ultradeck",
          colorCode: "Burnt Amber",
          supplier: "Timberlife",
          note: "X2",
        },
      ],
    },
    {
      name: "Internal Ceilings",
      label: "Internal guest bathroom ceiling finish",
      items: [
        {
          zone: "INTERNAL" as const,
          position: "Guest bathroom ceilings",
          product: "Micatex",
          colorCode: "Y2-E1-3 Moss Gold",
          supplier: "DIY Savoy",
        },
      ],
    },
    {
      name: "External/Internal Steel Work",
      label: "External/internal steel work finish",
      items: [
        {
          zone: "EXTERNAL" as const,
          position: "External/internal steel work",
          product: "Waterbased Velvaglo",
          colorCode: "Black",
          supplier: "DIY Savoy",
        },
      ],
    },
  ] satisfies SeedArea[],
};

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

function uniqueColourRows() {
  const seen = new Set<string>();
  const rows: Array<{
    colorName: string;
    baseType: ColorBaseType;
    productSnapshot: string;
    supplierSnapshot: string;
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
        supplierSnapshot: item.supplier,
      });
    }
  }

  return rows;
}

async function sitePaintColorTableExists() {
  const result = await prisma.$queryRawUnsafe<
    Array<{ table_name: string | null }>
  >(`select to_regclass('public."SitePaintColor"')::text as table_name`);
  return Boolean(result[0]?.table_name);
}

async function main() {
  const site = await prisma.site.upsert({
    where: { code: schedule.siteCode },
    update: {
      name: schedule.siteName,
      client: schedule.client,
      address: schedule.siteAddress,
      isActive: true,
    },
    create: {
      code: schedule.siteCode,
      name: schedule.siteName,
      client: schedule.client,
      address: schedule.siteAddress,
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
              supplier: item.supplier,
              note: "note" in item ? (item.note ?? null) : null,
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
  if (await sitePaintColorTableExists()) {
    for (const row of uniqueColourRows()) {
      const existingColour = await prisma.sitePaintColor.findFirst({
        where: {
          siteId: site.id,
          colorName: { equals: row.colorName, mode: "insensitive" },
          productSnapshot: { equals: row.productSnapshot, mode: "insensitive" },
        },
        select: { id: true },
      });

      if (existingColour) {
        await prisma.sitePaintColor.update({
          where: { id: existingColour.id },
          data: {
            supplierSnapshot: row.supplierSnapshot,
            rawDescription: `${row.productSnapshot}: ${row.colorName}`,
            sourceFile: "manual Vlei Lodge finishing schedule seed",
          },
        });
        siteColoursSkipped += 1;
        continue;
      }

      await prisma.sitePaintColor.create({
        data: {
          siteId: site.id,
          productSnapshot: row.productSnapshot,
          supplierSnapshot: row.supplierSnapshot,
          colorName: row.colorName,
          baseType: row.baseType,
          isTinted: !["WHITE", "NEUTRAL"].includes(row.baseType),
          rawDescription: `${row.productSnapshot}: ${row.colorName}`,
          sourceFile: "manual Vlei Lodge finishing schedule seed",
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
      site: { select: { code: true, name: true, client: true } },
      areas: {
        orderBy: { sortOrder: "asc" },
        select: { name: true, items: { select: { id: true } } },
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
        siteColoursCreated,
        siteColoursSkipped,
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
