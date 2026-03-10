import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const DULUX_SUPPLIER_ID = "cmmeftzq4000009l2msbxss71";

export const duluxCategoryUpdates = [
  {
    categoryId: "cmmkuzabt0000sgplwm07uc5e", // Primers
    skus: [
      "5147674",
      "5147673",
      "5147685",
      "5147684",
      "5147677",
      "5147620",
      "5147653",
      "5147652",
      "5147676",
      "5147675",
      "5147672",
    ],
  },
  {
    categoryId: "cmmkuzap80001sgplskriu5x5", // Undercoats
    skus: ["5147671", "5147670"],
  },
  {
    categoryId: "cmmkuzb2l0002sgplzxl23cxy", // Enamels
    skus: [
      "5147683",
      "5147682",
      "5147705",
      "5147707",
      "5147706",
      "5147708",
      "5147681",
      "5147680",
      "5152313",
      "5518147",
      "5152314",
      "5518149",
      "5152315",
      "5518151",
      "5152312",
      "5518145",
      "5081993",
      "5212722",
      "5212723",
      "5212724",
      "5147688",
    ],
  },
  {
    categoryId: "cmmkuzbg00003sgplae36gtnx", // Roof Paints
    skus: ["5147625", "5147624", "5147627", "5147626", "5147629", "5147628"],
  },
  {
    categoryId: "cmmkuzbtg0004sgplqzkz8djy", // Waterproofing
    skus: [
      "5147661",
      "5147660",
      "5309422",
      "5309423",
      "5309424",
      "5309435",
      "5309437",
      "5309438",
      "5600928",
      "5600929",
      "5801693",
      "5801695",
      "5801696",
      "5801697",
      "5801698",
      "5801699",
      "5801700",
      "5801702",
    ],
  },
  {
    categoryId: "cmmkuzc6u0005sgpld7k1vppz", // Sealers
    skus: ["5147635"],
  },
  {
    categoryId: "cmmkuzck70006sgplkuh553g8", // Thinners & Solvents
    skus: ["5147687"],
  },
  {
    categoryId: "cmmkuzcxl0007sgplt02vb0hk", // Industrial & Protective Coatings
    skus: [
      "5147710",
      "5147709",
      "5147594",
      "5147598",
      "5147596",
      "5147592",
      "5147590",
      "5147713",
      "5147714",
      "5147727",
      "5147728",
      "5147737",
      "5147738",
      "5147717",
      "5147718",
      "5147715",
      "5147716",
      "5147745",
      "5147746",
      "5147711",
      "5147712",
      "5147617",
      "5147616",
    ],
  },
];

async function remapDuluxCategories() {
  let totalUpdated = 0;

  for (const group of duluxCategoryUpdates) {
    const result = await prisma.procurementProduct.updateMany({
      where: {
        supplierId: DULUX_SUPPLIER_ID,
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

  console.log(`\nTotal Dulux products remapped: ${totalUpdated}`);
}

remapDuluxCategories()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
