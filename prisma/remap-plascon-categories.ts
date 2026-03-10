import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const PLASCON_SUPPLIER_ID = "cmmdxdol60009w8plpxqwnxct";

export const plasconCategoryUpdates = [
  {
    categoryId: "cmmkuzabt0000sgplwm07uc5e", // Primers
    skus: [
      "AW000255-5010",
      "EMS000018-0005",
      "EMS000018-0020",
      "GIP000001-0005",
      "GIP000001-0020",
      "PP000700-0020",
      "UC000002-0005",
      "UC000170-0005",
      "UC000170-0020",
      "WUP000001-0005",
    ],
  },
  {
    categoryId: "cmmkuzap80001sgplskriu5x5", // Undercoats
    skus: ["PU000800-0005", "PU000800-0020"],
  },
  {
    categoryId: "cmmkuzb2l0002sgplzxl23cxy", // Enamels
    skus: [
      "G000002-0005",
      "G000007-0005",
      "G000013-0005",
      "G000015-0005",
      "NY000001-0005",
      "SP000001-0005",
      "SP000002-0005",
      "SP000003-0005",
      "SP000007-0005",
      "SP000013-0005",
      "SP000016-0005",
      "TGE001000-0005",
      "TGE001000-0020",
      "TGE002000-0005",
      "TGE003010-0005",
      "VLO000001-0005",
      "VLO000002-0005",
      "VLW000001-0005",
      "VLW000002-0005",
      "TVG001000-0005",
      "TVG002000-0005",
      "TVG003010-0005",
      "TVW001000-0005",
      "TVW002000-0005",
      "TVW003000-0005",
    ],
  },
  {
    categoryId: "cmmkuzbg00003sgplae36gtnx", // Roof Paints
    skus: [
      "TRP000062-0020",
      "TRP000200-0020",
      "TRP000201-0020",
      "TRP000202-0020",
      "TRP000204-0020",
      "TRP000205-0020",
      "TRP000206-0020",
      "TRP000207-0020",
      "TRP000209-0020",
      "TRP000210-0020",
      "TRP000211-0020",
      "TRP000214-0020",
      "TRP000216-0020",
    ],
  },
  {
    categoryId: "cmmkuzbtg0004sgplqzkz8djy", // Waterproofing
    skus: [
      "PES000001-0020",
      "TED001000-0020",
      "TED002000-0020",
      "PWC000520-0020",
      "PSB000600-0020",
    ],
  },
  {
    categoryId: "cmmkuzc6u0005sgpld7k1vppz", // Sealers
    skus: [
      "PGS000001-0020",
      "TBD000001-0005",
      "WBS000001-0005",
      "WSP000001-0005",
    ],
  },
  {
    categoryId: "cmmkuzck70006sgplkuh553g8", // Thinners & Solvents
    skus: [
      "AZH000001-7219",
      "EPT000002-0005",
      "PUR000001-7219",
      "TH000128-7219",
    ],
  },
  {
    categoryId: "cmmkuzcxl0007sgplt02vb0hk", // Industrial & Protective Coatings
    skus: [
      "ASS000001-0005",
      "EPD000100-5005",
      "PEH003500-0001",
      "PEX003500-0004",
      "PRH000009-0715",
      "PRT009001-0042",
      "PRT009003-0030",
    ],
  },
];

async function remapPlasconCategories() {
  let totalUpdated = 0;

  for (const group of plasconCategoryUpdates) {
    if (!group.skus.length) continue;

    const result = await prisma.procurementProduct.updateMany({
      where: {
        supplierId: PLASCON_SUPPLIER_ID,
        sku: { in: group.skus },
      },
      data: {
        categoryId: group.categoryId,
      },
    });
    totalUpdated += result.count;
    console.log(
      `${group.categoryId}: updated ${result.count}/${group.skus.length}`,
    );
  }

  console.log(`\nTotal Plascon products remapped: ${totalUpdated}`);
}

remapPlasconCategories()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
