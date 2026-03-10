import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ProductUom } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const PLASCON_SUPPLIER_ID = "cmmdxdol60009w8plpxqwnxct";
const PLASCON_STARTS_ON = new Date("2026-03-01T00:00:00.000Z");

type PlasconPriceRow = {
  sku: string;
  uom: keyof typeof ProductUom;
  unitSize: string;
  price: string;
};

export const plasconPriceSeedBatch01: PlasconPriceRow[] = [
  { sku: "ASS000001-0005", uom: "L", unitSize: "5.000", price: "864.99" },
  { sku: "AW000255-5010", uom: "L", unitSize: "10.000", price: "1360.35" },
  { sku: "AZH000001-7219", uom: "L", unitSize: "10.000", price: "746.63" },
  { sku: "CAS000001-0005", uom: "L", unitSize: "5.000", price: "582.06" },
  { sku: "CAS000001-0020", uom: "L", unitSize: "20.000", price: "1849.40" },
  { sku: "EMS000018-0005", uom: "L", unitSize: "5.000", price: "436.21" },
  { sku: "EMS000018-0020", uom: "L", unitSize: "20.000", price: "1861.86" },
  { sku: "EPD000100-5005", uom: "L", unitSize: "5.000", price: "933.28" },
  { sku: "EPL000030-0020", uom: "L", unitSize: "20.000", price: "1026.17" },
  { sku: "EPT000002-0005", uom: "L", unitSize: "5.000", price: "437.05" },
  { sku: "G000002-0005", uom: "L", unitSize: "5.000", price: "436.24" },
  { sku: "G000007-0005", uom: "L", unitSize: "5.000", price: "436.24" },
  { sku: "G000013-0005", uom: "L", unitSize: "5.000", price: "457.52" },
  { sku: "G000015-0005", uom: "L", unitSize: "5.000", price: "436.24" },
  { sku: "GIP000001-0005", uom: "L", unitSize: "5.000", price: "455.26" },
  { sku: "GIP000001-0020", uom: "L", unitSize: "20.000", price: "1729.99" },
  { sku: "NY000001-0005", uom: "L", unitSize: "5.000", price: "384.36" },
  { sku: "PEH003500-0001", uom: "L", unitSize: "1.000", price: "291.37" },
  { sku: "PEM000600-0020", uom: "L", unitSize: "20.000", price: "447.56" },
  { sku: "PEM000800-0020", uom: "L", unitSize: "20.000", price: "838.80" },
];

export const plasconPriceSeedBatch02: PlasconPriceRow[] = [
  { sku: "PEM000900-0005", uom: "L", unitSize: "5.000", price: "304.04" },
  { sku: "PEM000900-0020", uom: "L", unitSize: "20.000", price: "672.66" },
  { sku: "PEM000950-0020", uom: "L", unitSize: "20.000", price: "1453.72" },
  { sku: "PEM001000-0005", uom: "L", unitSize: "5.000", price: "437.35" },
  { sku: "PEM001000-0020", uom: "L", unitSize: "20.000", price: "921.88" },
  { sku: "PES000001-0020", uom: "L", unitSize: "20.000", price: "1553.13" },
  { sku: "PEX003500-0004", uom: "L", unitSize: "4.000", price: "1092.62" },
  { sku: "PGS000001-0020", uom: "L", unitSize: "20.000", price: "816.15" },
  { sku: "PP000700-0020", uom: "L", unitSize: "20.000", price: "1021.94" },
  { sku: "PRH000009-0715", uom: "ML", unitSize: "715.000", price: "210.40" },
  { sku: "PRT009001-0042", uom: "L", unitSize: "4.200", price: "637.42" },
  { sku: "PRT009003-0030", uom: "L", unitSize: "4.070", price: "558.39" },
  { sku: "PSB000600-0020", uom: "L", unitSize: "20.000", price: "1488.35" },
  { sku: "PU000800-0005", uom: "L", unitSize: "5.000", price: "253.90" },
  { sku: "PU000800-0020", uom: "L", unitSize: "20.000", price: "940.58" },
  { sku: "PUR000001-7219", uom: "L", unitSize: "10.000", price: "864.99" },
  { sku: "PWC000520-0020", uom: "L", unitSize: "20.000", price: "827.51" },
  { sku: "SP000001-0005", uom: "L", unitSize: "5.000", price: "432.50" },
  { sku: "SP000002-0005", uom: "L", unitSize: "5.000", price: "432.50" },
  { sku: "SP000003-0005", uom: "L", unitSize: "5.000", price: "432.50" },
  { sku: "SP000007-0005", uom: "L", unitSize: "5.000", price: "432.50" },
  { sku: "SP000013-0005", uom: "L", unitSize: "5.000", price: "432.50" },
  { sku: "SP000016-0005", uom: "L", unitSize: "5.000", price: "432.50" },
  { sku: "TAP001010-0020", uom: "L", unitSize: "20.000", price: "974.82" },
  { sku: "TAP002000-0020", uom: "L", unitSize: "20.000", price: "1042.62" },
  { sku: "TAP003010-0020", uom: "L", unitSize: "20.000", price: "1094.83" },
  { sku: "TBD000001-0005", uom: "L", unitSize: "5.000", price: "657.62" },
  { sku: "TCA001000-0005", uom: "L", unitSize: "5.000", price: "581.99" },
  { sku: "TCA001000-0020", uom: "L", unitSize: "20.000", price: "1298.71" },
  { sku: "TCA002000-0020", uom: "L", unitSize: "20.000", price: "1841.08" },
  { sku: "TCP001000-0020", uom: "L", unitSize: "20.000", price: "736.48" },
  { sku: "TDV001000-0005", uom: "L", unitSize: "5.000", price: "562.32" },
  { sku: "TDV001000-0020", uom: "L", unitSize: "20.000", price: "1432.19" },
  { sku: "TDV002000-0020", uom: "L", unitSize: "20.000", price: "1555.46" },
  { sku: "TED001000-0020", uom: "L", unitSize: "20.000", price: "1553.17" },
  { sku: "TED002000-0020", uom: "L", unitSize: "20.000", price: "1682.59" },
  { sku: "TGE001000-0005", uom: "L", unitSize: "5.000", price: "409.69" },
  { sku: "TGE001000-0020", uom: "L", unitSize: "20.000", price: "1591.72" },
  { sku: "TGE002000-0005", uom: "L", unitSize: "5.000", price: "443.53" },
  { sku: "TGE003010-0005", uom: "L", unitSize: "5.000", price: "537.26" },
  { sku: "TH000128-7219", uom: "L", unitSize: "10.000", price: "764.84" },
  { sku: "TLS001000-0005", uom: "L", unitSize: "5.000", price: "437.30" },
  { sku: "TLS001000-0020", uom: "L", unitSize: "20.000", price: "803.08" },
  { sku: "TLS002000-0005", uom: "L", unitSize: "5.000", price: "465.91" },
  { sku: "TLS002000-0020", uom: "L", unitSize: "20.000", price: "1006.64" },
  { sku: "TLS003010-0005", uom: "L", unitSize: "5.000", price: "494.16" },
  { sku: "TLS003010-0020", uom: "L", unitSize: "20.000", price: "1124.89" },
  { sku: "TMX001050-0020", uom: "L", unitSize: "20.000", price: "1063.90" },
  { sku: "TMX002050-0020", uom: "L", unitSize: "20.000", price: "1117.13" },
  { sku: "TMX003050-0020", uom: "L", unitSize: "20.000", price: "1223.55" },
  { sku: "TPM001000-0020", uom: "L", unitSize: "20.000", price: "1509.60" },
  { sku: "TPM002000-0020", uom: "L", unitSize: "20.000", price: "1565.50" },
  { sku: "TRP000062-0020", uom: "L", unitSize: "20.000", price: "1143.43" },
  { sku: "TRP000200-0020", uom: "L", unitSize: "20.000", price: "1143.43" },
  { sku: "TRP000201-0020", uom: "L", unitSize: "20.000", price: "1143.43" },
  { sku: "TRP000202-0020", uom: "L", unitSize: "20.000", price: "1143.43" },
  { sku: "TRP000204-0020", uom: "L", unitSize: "20.000", price: "1143.43" },
  { sku: "TRP000205-0020", uom: "L", unitSize: "20.000", price: "1143.43" },
  { sku: "TRP000206-0020", uom: "L", unitSize: "20.000", price: "1143.43" },
  { sku: "TRP000207-0020", uom: "L", unitSize: "20.000", price: "1143.43" },
  { sku: "TRP000209-0020", uom: "L", unitSize: "20.000", price: "1143.43" },
  { sku: "TRP000210-0020", uom: "L", unitSize: "20.000", price: "1143.43" },
  { sku: "TRP000211-0020", uom: "L", unitSize: "20.000", price: "1143.43" },
  { sku: "TRP000214-0020", uom: "L", unitSize: "20.000", price: "1143.43" },
  { sku: "TRP000216-0020", uom: "L", unitSize: "20.000", price: "1143.43" },
  { sku: "TSA001010-0005", uom: "L", unitSize: "5.000", price: "304.08" },
  { sku: "TSA001010-0020", uom: "L", unitSize: "20.000", price: "719.74" },
  { sku: "TSA002000-0005", uom: "L", unitSize: "5.000", price: "324.81" },
  { sku: "TSA002000-0020", uom: "L", unitSize: "20.000", price: "707.01" },
  { sku: "TSA003010-0005", uom: "L", unitSize: "5.000", price: "345.93" },
  { sku: "TSA003010-0020", uom: "L", unitSize: "20.000", price: "852.98" },
  { sku: "TVG001000-0005", uom: "L", unitSize: "5.000", price: "530.94" },
  { sku: "TVG002000-0005", uom: "L", unitSize: "5.000", price: "561.36" },
  { sku: "TVG003010-0005", uom: "L", unitSize: "5.000", price: "600.63" },
  { sku: "TVW001000-0005", uom: "L", unitSize: "5.000", price: "482.44" },
  { sku: "TVW002000-0005", uom: "L", unitSize: "5.000", price: "498.50" },
  { sku: "TVW003000-0005", uom: "L", unitSize: "5.000", price: "522.67" },
  { sku: "TWA001000-0020", uom: "L", unitSize: "20.000", price: "1672.21" },
  { sku: "TWA002000-0020", uom: "L", unitSize: "20.000", price: "1834.93" },
  { sku: "TWA003010-0020", uom: "L", unitSize: "20.000", price: "1965.47" },
  { sku: "UC000002-0005", uom: "L", unitSize: "5.000", price: "380.26" },
  { sku: "UC000170-0005", uom: "L", unitSize: "5.000", price: "468.16" },
  { sku: "UC000170-0020", uom: "L", unitSize: "20.000", price: "1915.03" },
  { sku: "VEL000001-0005", uom: "L", unitSize: "5.000", price: "562.32" },
  { sku: "VEL000001-0020", uom: "L", unitSize: "20.000", price: "1432.34" },
  { sku: "VEL000002-0005", uom: "L", unitSize: "5.000", price: "562.32" },
  { sku: "VLO000001-0005", uom: "L", unitSize: "5.000", price: "530.89" },
  { sku: "VLO000002-0005", uom: "L", unitSize: "5.000", price: "530.89" },
  { sku: "VLW000001-0005", uom: "L", unitSize: "5.000", price: "482.48" },
  { sku: "VLW000002-0005", uom: "L", unitSize: "5.000", price: "489.83" },
  { sku: "WAA000001-0005", uom: "L", unitSize: "5.000", price: "567.22" },
  { sku: "WAA000001-0020", uom: "L", unitSize: "20.000", price: "1672.22" },
  { sku: "WBS000001-0005", uom: "L", unitSize: "5.000", price: "621.35" },
  { sku: "WSP000001-0005", uom: "L", unitSize: "5.000", price: "489.85" },
  { sku: "WUP000001-0005", uom: "L", unitSize: "5.000", price: "394.34" },
];

export const plasconPriceSeedExtra: PlasconPriceRow[] = [
  { sku: "PSI000001-0423", uom: "KG", unitSize: "23.000", price: "509.89" },
];

async function seedPlasconSupplierPrices() {
  // Fix category for SkimCoat Interior if it already exists
  await prisma.procurementProduct.updateMany({
    where: {
      supplierId: "cmmdxdol60009w8plpxqwnxct",
      sku: "PSI000001-0423",
    },
    data: {
      categoryId: "cmmkuzdb00008sgpl7p73l0cg",
    },
  });

  const allPrices = [
    ...plasconPriceSeedBatch01,
    ...plasconPriceSeedBatch02,
    ...plasconPriceSeedExtra,
  ];
  const skus = allPrices.map((x) => x.sku);

  const products = await prisma.procurementProduct.findMany({
    where: {
      supplierId: PLASCON_SUPPLIER_ID,
      sku: { in: skus },
    },
    select: { id: true, sku: true },
  });

  const productBySku = new Map(products.map((p) => [p.sku, p.id]));

  const rows = allPrices
    .map((x) => {
      const productId = productBySku.get(x.sku);
      if (!productId) return null;

      return {
        supplierId: PLASCON_SUPPLIER_ID,
        productId,
        uom: ProductUom[x.uom],
        unitSize: x.unitSize,
        price: x.price,
        startsOn: PLASCON_STARTS_ON,
        isActive: true,
      };
    })
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  await prisma.supplierProductPrice.createMany({
    data: rows,
    skipDuplicates: true,
  });

  const missing = allPrices.filter((x) => !productBySku.has(x.sku));
  if (missing.length) {
    console.log(
      "Missing ProcurementProduct SKUs:",
      missing.map((x) => x.sku),
    );
  }

  console.log(`Inserted ${rows.length} Plascon supplier prices`);
}

seedPlasconSupplierPrices()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
