import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  type ColorBaseType,
  type FinishingZone,
} from "../generated/prisma/client.js";
import { normalizeDatabaseUrl } from "../lib/database-url";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: normalizeDatabaseUrl(connectionString),
  }),
});

type SeedItem = {
  zone: FinishingZone;
  area: string;
  position: string;
  product: string;
  colorCode: string;
  supplier: string;
};

const schedule = {
  siteCode: "6753",
  siteName: "CT Hydraulics",
  contractNo: "6753",
  client: "Bantry Construction",
  contractManager: "Collen",
  siteForeman: "Edwin",
  fcpContractManager: null as string | null,
  fcpQs: "Janice",
  fcpSiteForeman: "Gift Nkomose",
  startDate: "2026-04-21",
  completionDate: "2026-06-29",
  drawingDetails: null as string | null,
  contactInfo: "Supplied by DIY Savoy",
  supplier: "DIY Savoy",
  sourceFile: "manual finishing schedule seed - CT Hydraulics",
  items: [
    {
      zone: "INTERNAL",
      area: "Interior",
      position: "Ceilings",
      product: "PEM 600",
      colorCode: "White",
      supplier: "DIY Savoy",
    },
    {
      zone: "INTERNAL",
      area: "Interior",
      position: "Main Colour",
      product: "TLS",
      colorCode: "Universal Grey Hydraulics 00NN62/000",
      supplier: "DIY Savoy",
    },
    {
      zone: "INTERNAL",
      area: "Interior",
      position: "Accent Colour",
      product: "TLS",
      colorCode: "Granite Grey 00NN37/000",
      supplier: "DIY Savoy",
    },
    {
      zone: "INTERNAL",
      area: "Interior",
      position: "Doors / Frames / Skirtings",
      product: "TVW",
      colorCode: "Granite Grey 00NN37/000",
      supplier: "DIY Savoy",
    },
    {
      zone: "INTERNAL",
      area: "Interior",
      position: "Windows / Burglers",
      product: "VLW 02",
      colorCode: "Black",
      supplier: "DIY Savoy",
    },
    {
      zone: "EXTERNAL",
      area: "Exterior",
      position: "Main Colour",
      product: "TLS",
      colorCode: "Steel Grey 00NN31/000",
      supplier: "DIY Savoy",
    },
    {
      zone: "EXTERNAL",
      area: "Exterior",
      position: "Accent Colour",
      product: "TLS",
      colorCode: "Night Jewels 2 Hydraulics 00NN13/000",
      supplier: "DIY Savoy",
    },
  ] satisfies SeedItem[],
};

function asDate(value: string | null) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function inferBaseType(text: string): ColorBaseType {
  if (/\bwhite\b/i.test(text)) return "WHITE";
  if (/\bblack\b/i.test(text)) return "DEEP";
  if (/\bpastel\b/i.test(text)) return "PASTEL";
  if (/\bdeep\b/i.test(text)) return "DEEP";
  if (/\bclear|transparent|transp\b/i.test(text)) return "CLEAR";
  return "NEUTRAL";
}

async function main() {
  const site = await prisma.site.upsert({
    where: { code: schedule.siteCode },
    update: {
      name: schedule.siteName,
      client: schedule.client,
      isActive: true,
    },
    create: {
      code: schedule.siteCode,
      name: schedule.siteName,
      client: schedule.client,
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
      siteAddress: schedule.siteName,
      contractNo: schedule.contractNo,
      contractManager: schedule.contractManager,
      siteForeman: schedule.siteForeman,
      fcpContractManager: schedule.fcpContractManager,
      fcpQs: schedule.fcpQs,
      fcpSiteForeman: schedule.fcpSiteForeman,
      client: schedule.client,
      startDate: asDate(schedule.startDate),
      completionDate: asDate(schedule.completionDate),
      drawingDetails: schedule.drawingDetails,
      contactInfo: schedule.contactInfo,
      isActive: true,
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

    const itemsByArea = new Map<string, SeedItem[]>();
    for (const item of schedule.items) {
      const current = itemsByArea.get(item.area) ?? [];
      current.push(item);
      itemsByArea.set(item.area, current);
    }

    let areaIndex = 0;
    for (const [areaName, items] of itemsByArea) {
      await tx.siteFinishingScheduleArea.create({
        data: {
          scheduleId: row.id,
          name: areaName,
          label:
            areaName === "Interior"
              ? "Interior ceilings, walls, frames and trim finishes"
              : "Exterior wall finishes",
          sortOrder: areaIndex,
          items: {
            create: items.map((item, itemIndex) => ({
              zone: item.zone,
              position: item.position,
              product: item.product,
              colorCode: item.colorCode,
              supplier: item.supplier,
              sortOrder: itemIndex,
              note: schedule.sourceFile,
            })),
          },
        },
      });
      areaIndex += 1;
    }

    return row;
  });

  let siteColoursCreated = 0;
  let siteColoursSkipped = 0;

  for (const item of schedule.items) {
    const existingColour = await prisma.sitePaintColor.findFirst({
      where: {
        siteId: site.id,
        colorName: { equals: item.colorCode, mode: "insensitive" },
        productSnapshot: { equals: item.product, mode: "insensitive" },
      },
      select: { id: true },
    });

    if (existingColour) {
      siteColoursSkipped += 1;
      continue;
    }

    const baseType = inferBaseType(item.colorCode);
    await prisma.sitePaintColor.create({
      data: {
        siteId: site.id,
        productSnapshot: item.product,
        supplierSnapshot: item.supplier,
        colorName: item.colorCode,
        baseType,
        isTinted: !["WHITE", "NEUTRAL"].includes(baseType),
        rawDescription: `${item.area} ${item.position}: ${item.product} - ${item.colorCode}`,
        sourceFile: schedule.sourceFile,
      },
    });
    siteColoursCreated += 1;
  }

  const summary = await prisma.siteFinishingSchedule.findUniqueOrThrow({
    where: { id: saved.id },
    select: {
      id: true,
      contractNo: true,
      client: true,
      contractManager: true,
      siteForeman: true,
      fcpContractManager: true,
      fcpQs: true,
      fcpSiteForeman: true,
      startDate: true,
      completionDate: true,
      site: { select: { code: true, name: true } },
      areas: {
        orderBy: { sortOrder: "asc" },
        select: {
          name: true,
          items: {
            orderBy: { sortOrder: "asc" },
            select: {
              zone: true,
              position: true,
              product: true,
              colorCode: true,
              supplier: true,
            },
          },
        },
      },
    },
  });

  console.log(
    JSON.stringify(
      {
        schedule: summary,
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
