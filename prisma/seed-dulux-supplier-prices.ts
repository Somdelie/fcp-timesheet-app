import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ProductUom } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const DULUX_SUPPLIER_ID = "cmmeftzq4000009l2msbxss71";
const DULUX_STARTS_ON = new Date("2026-03-01T00:00:00.000Z");

type DuluxPriceRow = {
  sku: string;
  uom: keyof typeof ProductUom;
  unitSize: string;
  price: string;
};

export const duluxTradePriceSeedBatch01: DuluxPriceRow[] = [
  { sku: "5147674", uom: "L", unitSize: "5.000", price: "661.88" },
  { sku: "5147673", uom: "L", unitSize: "20.000", price: "2287.50" },
  { sku: "5147685", uom: "L", unitSize: "5.000", price: "459.52" },
  { sku: "5147684", uom: "L", unitSize: "20.000", price: "1588.16" },
  { sku: "5147677", uom: "L", unitSize: "5.000", price: "1303.81" },
  { sku: "5147620", uom: "L", unitSize: "5.000", price: "768.30" },
  { sku: "5147653", uom: "L", unitSize: "5.000", price: "525.41" },
  { sku: "5147652", uom: "L", unitSize: "20.000", price: "1748.53" },
  { sku: "5147676", uom: "L", unitSize: "5.000", price: "692.27" },
  { sku: "5147675", uom: "L", unitSize: "20.000", price: "2392.53" },
  { sku: "5147672", uom: "L", unitSize: "5.000", price: "782.20" },
  { sku: "5147671", uom: "L", unitSize: "5.000", price: "699.86" },
  { sku: "5147670", uom: "L", unitSize: "20.000", price: "2723.02" },
  { sku: "5147683", uom: "L", unitSize: "5.000", price: "954.68" },
  { sku: "5147682", uom: "L", unitSize: "20.000", price: "3818.71" },
  { sku: "5147705", uom: "L", unitSize: "5.000", price: "1855.78" },
  { sku: "5147707", uom: "L", unitSize: "5.000", price: "1855.78" },
  { sku: "5147706", uom: "L", unitSize: "5.000", price: "1855.78" },
  { sku: "5147708", uom: "L", unitSize: "5.000", price: "1855.78" },
  { sku: "5147139", uom: "L", unitSize: "5.000", price: "336.33" },
  { sku: "5147138", uom: "L", unitSize: "20.000", price: "1169.86" },
  { sku: "5081997", uom: "L", unitSize: "5.000", price: "1305.11" },
  { sku: "5081993", uom: "L", unitSize: "5.000", price: "1287.52" },
  { sku: "5212722", uom: "L", unitSize: "5.000", price: "1329.65" },
  { sku: "5212723", uom: "L", unitSize: "5.000", price: "1352.68" },
  { sku: "5212724", uom: "L", unitSize: "5.000", price: "1396.88" },
  { sku: "5147710", uom: "L", unitSize: "5.000", price: "2153.35" },
  { sku: "5147709", uom: "L", unitSize: "5.000", price: "2153.35" },

  { sku: "5147661", uom: "L", unitSize: "5.000", price: "1137.66" },
  { sku: "5147660", uom: "L", unitSize: "20.000", price: "3640.53" },
  { sku: "5309422", uom: "L", unitSize: "5.000", price: "1179.63" },
  { sku: "5309423", uom: "L", unitSize: "20.000", price: "3817.54" },
  { sku: "5309424", uom: "L", unitSize: "5.000", price: "1214.07" },
  { sku: "5309435", uom: "L", unitSize: "20.000", price: "3991.69" },
  { sku: "5309437", uom: "L", unitSize: "5.000", price: "1246.24" },
  { sku: "5309438", uom: "L", unitSize: "20.000", price: "4161.32" },

  { sku: "5600928", uom: "L", unitSize: "5.000", price: "826.87" },
  { sku: "5600929", uom: "L", unitSize: "20.000", price: "2645.95" },
  { sku: "5801693", uom: "L", unitSize: "5.000", price: "871.92" },
  { sku: "5801695", uom: "L", unitSize: "20.000", price: "2832.94" },
  { sku: "5801696", uom: "L", unitSize: "5.000", price: "918.80" },
  { sku: "5801697", uom: "L", unitSize: "20.000", price: "3046.83" },
  { sku: "5801698", uom: "L", unitSize: "5.000", price: "964.95" },
  { sku: "5801699", uom: "L", unitSize: "20.000", price: "3261.28" },
  { sku: "5801700", uom: "L", unitSize: "5.000", price: "1108.54" },
  { sku: "5801702", uom: "L", unitSize: "20.000", price: "3862.00" },

  { sku: "5147681", uom: "L", unitSize: "5.000", price: "937.01" },
  { sku: "5147680", uom: "L", unitSize: "20.000", price: "3748.00" },
  { sku: "5152313", uom: "L", unitSize: "20.000", price: "3930.50" },
  { sku: "5518147", uom: "L", unitSize: "20.000", price: "3941.04" },
  { sku: "5152314", uom: "L", unitSize: "20.000", price: "4078.86" },
  { sku: "5518149", uom: "L", unitSize: "20.000", price: "4136.46" },
  { sku: "5152315", uom: "L", unitSize: "20.000", price: "4318.61" },
  { sku: "5518151", uom: "L", unitSize: "20.000", price: "4327.97" },
  { sku: "5152312", uom: "L", unitSize: "20.000", price: "4864.87" },
  { sku: "5518145", uom: "L", unitSize: "20.000", price: "4941.16" },

  { sku: "5803247", uom: "L", unitSize: "1.000", price: "227.21" },
  { sku: "5147607", uom: "L", unitSize: "5.000", price: "826.87" },
  { sku: "5147606", uom: "L", unitSize: "20.000", price: "2645.95" },
  { sku: "5802138", uom: "L", unitSize: "1.000", price: "236.60" },
  { sku: "5152266", uom: "L", unitSize: "5.000", price: "869.50" },
  { sku: "5152265", uom: "L", unitSize: "20.000", price: "2823.18" },
  { sku: "5930720", uom: "L", unitSize: "1.000", price: "237.88" },
  { sku: "5152286", uom: "L", unitSize: "5.000", price: "871.92" },
  { sku: "5152285", uom: "L", unitSize: "20.000", price: "2832.94" },
  { sku: "5803255", uom: "L", unitSize: "1.000", price: "240.16" },
  { sku: "5152268", uom: "L", unitSize: "5.000", price: "905.49" },
  { sku: "5152267", uom: "L", unitSize: "20.000", price: "2993.50" },
  { sku: "5930721", uom: "L", unitSize: "1.000", price: "244.69" },
  { sku: "5152288", uom: "L", unitSize: "5.000", price: "918.80" },
  { sku: "5152287", uom: "L", unitSize: "20.000", price: "3046.83" },
  { sku: "5803256", uom: "L", unitSize: "1.000", price: "247.24" },
  { sku: "5152270", uom: "L", unitSize: "5.000", price: "962.83" },
  { sku: "5152269", uom: "L", unitSize: "20.000", price: "3252.60" },
  { sku: "5930722", uom: "L", unitSize: "1.000", price: "251.03" },
  { sku: "5152290", uom: "L", unitSize: "5.000", price: "964.95" },
  { sku: "5152289", uom: "L", unitSize: "20.000", price: "3261.28" },
  { sku: "5803254", uom: "L", unitSize: "1.000", price: "267.74" },
  { sku: "5152264", uom: "L", unitSize: "5.000", price: "1090.88" },
  { sku: "5152263", uom: "L", unitSize: "20.000", price: "3791.35" },
  { sku: "5930719", uom: "L", unitSize: "1.000", price: "277.16" },
  { sku: "5152284", uom: "L", unitSize: "5.000", price: "1108.54" },
  { sku: "5152283", uom: "L", unitSize: "20.000", price: "3862.00" },

  { sku: "5147603", uom: "L", unitSize: "5.000", price: "501.60" },
  { sku: "5147602", uom: "L", unitSize: "20.000", price: "1669.33" },
  { sku: "5152278", uom: "L", unitSize: "5.000", price: "547.52" },
  { sku: "5152277", uom: "L", unitSize: "20.000", price: "1856.33" },
  { sku: "5152292", uom: "L", unitSize: "5.000", price: "549.93" },
  { sku: "5152291", uom: "L", unitSize: "20.000", price: "1866.08" },
  { sku: "5152280", uom: "L", unitSize: "5.000", price: "596.48" },
  { sku: "5152279", uom: "L", unitSize: "20.000", price: "2065.70" },
  { sku: "5152294", uom: "L", unitSize: "5.000", price: "609.81" },
  { sku: "5152293", uom: "L", unitSize: "20.000", price: "2119.04" },
  { sku: "5152282", uom: "L", unitSize: "5.000", price: "668.48" },
  { sku: "5152281", uom: "L", unitSize: "20.000", price: "2368.74" },
  { sku: "5152296", uom: "L", unitSize: "5.000", price: "670.61" },
  { sku: "5152295", uom: "L", unitSize: "20.000", price: "2377.42" },

  { sku: "5147627", uom: "L", unitSize: "20.000", price: "2940.38" },
  { sku: "5152248", uom: "L", unitSize: "5.000", price: "960.61" },
  { sku: "5152247", uom: "L", unitSize: "20.000", price: "3114.66" },
  { sku: "5518158", uom: "L", unitSize: "5.000", price: "963.03" },
  { sku: "5518163", uom: "L", unitSize: "20.000", price: "3124.41" },
  { sku: "5152250", uom: "L", unitSize: "5.000", price: "992.88" },
  { sku: "5152249", uom: "L", unitSize: "20.000", price: "3273.21" },
  { sku: "5518159", uom: "L", unitSize: "5.000", price: "1006.20" },
  { sku: "5518164", uom: "L", unitSize: "20.000", price: "3326.53" },
  { sku: "5152252", uom: "L", unitSize: "5.000", price: "1046.08" },
  { sku: "5152251", uom: "L", unitSize: "20.000", price: "3519.04" },
  { sku: "5518161", uom: "L", unitSize: "5.000", price: "1048.21" },
  { sku: "5518165", uom: "L", unitSize: "20.000", price: "3527.71" },
  { sku: "5152246", uom: "L", unitSize: "5.000", price: "1170.47" },
  { sku: "5152245", uom: "L", unitSize: "20.000", price: "4046.03" },
  { sku: "5518157", uom: "L", unitSize: "5.000", price: "1188.15" },
  { sku: "5518162", uom: "L", unitSize: "20.000", price: "4116.67" },

  { sku: "5147605", uom: "L", unitSize: "5.000", price: "721.01" },
  { sku: "5147604", uom: "L", unitSize: "20.000", price: "2491.80" },
  { sku: "5152272", uom: "L", unitSize: "5.000", price: "764.71" },
  { sku: "5152271", uom: "L", unitSize: "20.000", price: "2670.52" },
  { sku: "5152298", uom: "L", unitSize: "5.000", price: "767.12" },
  { sku: "5152297", uom: "L", unitSize: "20.000", price: "2680.28" },
  { sku: "5152274", uom: "L", unitSize: "5.000", price: "804.91" },
  { sku: "5152273", uom: "L", unitSize: "20.000", price: "2847.03" },
  { sku: "5152300", uom: "L", unitSize: "5.000", price: "818.23" },
  { sku: "5152299", uom: "L", unitSize: "20.000", price: "2900.36" },
  { sku: "5152276", uom: "L", unitSize: "5.000", price: "867.02" },
  { sku: "5152275", uom: "L", unitSize: "20.000", price: "3113.06" },
  { sku: "5152302", uom: "L", unitSize: "5.000", price: "869.14" },
  { sku: "5152301", uom: "L", unitSize: "20.000", price: "3121.73" },

  { sku: "5147688", uom: "L", unitSize: "5.000", price: "791.78" },
  { sku: "5147619", uom: "L", unitSize: "5.000", price: "391.78" },
  { sku: "5147618", uom: "L", unitSize: "20.000", price: "1253.67" },
  { sku: "5147594", uom: "L", unitSize: "5.000", price: "1012.33" },
  { sku: "5147598", uom: "L", unitSize: "5.000", price: "1012.33" },
  { sku: "5147596", uom: "L", unitSize: "5.000", price: "1012.33" },
  { sku: "5147592", uom: "L", unitSize: "5.000", price: "1012.33" },
  { sku: "5147590", uom: "L", unitSize: "5.000", price: "1012.33" },
  { sku: "5147713", uom: "L", unitSize: "1.000", price: "318.71" },
  { sku: "5147714", uom: "L", unitSize: "5.000", price: "1008.59" },
  { sku: "5147727", uom: "L", unitSize: "1.000", price: "318.71" },
  { sku: "5147728", uom: "L", unitSize: "5.000", price: "1008.59" },
  { sku: "5147737", uom: "L", unitSize: "1.000", price: "318.71" },
  { sku: "5147738", uom: "L", unitSize: "5.000", price: "1008.59" },
  { sku: "5147717", uom: "L", unitSize: "1.000", price: "318.71" },
  { sku: "5147718", uom: "L", unitSize: "5.000", price: "1008.59" },
  { sku: "5147715", uom: "L", unitSize: "1.000", price: "318.71" },
  { sku: "5147716", uom: "L", unitSize: "5.000", price: "1008.59" },
  { sku: "5147745", uom: "L", unitSize: "1.000", price: "318.71" },
  { sku: "5147746", uom: "L", unitSize: "5.000", price: "1008.59" },
  { sku: "5147711", uom: "L", unitSize: "1.000", price: "318.71" },
  { sku: "5147712", uom: "L", unitSize: "5.000", price: "1008.59" },
  { sku: "5147635", uom: "L", unitSize: "5.000", price: "738.13" },
  { sku: "5147687", uom: "L", unitSize: "5.000", price: "455.41" },
  { sku: "5147617", uom: "L", unitSize: "5.000", price: "830.42" },
  { sku: "5147616", uom: "L", unitSize: "20.000", price: "2657.31" },
];

async function seedDuluxTradeSupplierPrices() {
  const skus = duluxTradePriceSeedBatch01.map((x) => x.sku);

  const products = await prisma.procurementProduct.findMany({
    where: {
      supplierId: DULUX_SUPPLIER_ID,
      sku: { in: skus },
    },
    select: { id: true, sku: true },
  });

  const productBySku = new Map(products.map((p) => [p.sku, p.id]));

  const rows = duluxTradePriceSeedBatch01
    .map((x) => {
      const productId = productBySku.get(x.sku);
      if (!productId) return null;

      return {
        supplierId: DULUX_SUPPLIER_ID,
        productId,
        uom: ProductUom[x.uom],
        unitSize: x.unitSize,
        price: x.price,
        startsOn: DULUX_STARTS_ON,
        isActive: true,
      };
    })
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  await prisma.supplierProductPrice.createMany({
    data: rows,
    skipDuplicates: true,
  });

  const missing = duluxTradePriceSeedBatch01.filter(
    (x) => !productBySku.has(x.sku),
  );
  if (missing.length) {
    console.log(
      "Missing ProcurementProduct SKUs:",
      missing.map((x) => x.sku),
    );
  }

  console.log(`Inserted ${rows.length} Dulux Trade supplier prices`);
}

seedDuluxTradeSupplierPrices()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
