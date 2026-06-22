import "dotenv/config";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";

const CUT_OFF = new Date("2026-06-11T12:00:00.000Z");
const END_EXCLUSIVE = new Date("2026-06-12T00:00:00.000Z");
const BATCH_REF = "manual-mawesi-cost-topup-2026-06-11";

type PaperRow = {
  code: string;
  wages: number;
  material: number;
};

const rows: PaperRow[] = [
  { code: "6105", wages: 1580566.31, material: 1302462.17 },
  { code: "6411", wages: 107655.78, material: 129254.96 },
  { code: "6552", wages: 106238.69, material: 54178.34 },
  { code: "6606", wages: 256949.99, material: 339077.43 },
  { code: "6683", wages: 62141.54, material: 58002.85 },
  { code: "6719", wages: 22138.4, material: 18501.18 },
  { code: "6747", wages: 17315.55, material: 22619.01 },
  { code: "6760", wages: 6255.66, material: 4028.53 },
  { code: "6764", wages: 0, material: 0 },
  { code: "6769", wages: 4660, material: 0 },
];

function money(value: Prisma.Decimal | string | number | null | undefined) {
  return new Prisma.Decimal(value ?? 0).toDecimalPlaces(2);
}

async function sumLiveWages(siteId: string) {
  const result = await prisma.attendanceScan.aggregate({
    where: { siteId, workDate: { lt: END_EXCLUSIVE } },
    _sum: { dayRateAtScan: true },
  });
  return money(result._sum.dayRateAtScan ?? 0);
}

async function sumLiveMaterial(siteId: string) {
  const items = await prisma.siteProductOrderItem.findMany({
    where: { order: { siteId, createdAt: { lt: END_EXCLUSIVE } } },
    select: { quantity: true, unitPriceAtOrder: true },
  });
  return items.reduce(
    (sum, item) => sum.add(money(item.unitPriceAtOrder).mul(item.quantity)),
    money(0),
  );
}

async function sumHistorical(
  siteId: string,
  category: "LABOUR" | "MATERIAL",
  excludeThisBatch: boolean,
) {
  const result = await prisma.historicalSiteCost.aggregate({
    where: {
      siteId,
      category: category === "LABOUR" ? "LABOUR" : { not: "LABOUR" },
      transactionDate: { lt: END_EXCLUSIVE },
      ...(excludeThisBatch
        ? { OR: [{ batchRef: null }, { batchRef: { not: BATCH_REF } }] }
        : {}),
    },
    _sum: { amount: true },
  });
  return money(result._sum.amount ?? 0);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const verify = process.argv.includes("--verify");

  const sites = await prisma.site.findMany({
    where: { code: { in: rows.map((row) => row.code) } },
    select: { id: true, code: true, name: true },
  });
  const siteByCode = new Map(sites.map((site) => [site.code, site]));

  console.log(
    `${verify ? "Verifying" : apply ? "Applying" : "Previewing"} Mawesi cost top-ups as at 2026-06-11`,
  );

  for (const row of rows) {
    const site = siteByCode.get(row.code);
    if (!site) {
      console.log(`MISS ${row.code}: site not found`);
      continue;
    }

    const liveWages = await sumLiveWages(site.id);
    const histWages = await sumHistorical(site.id, "LABOUR", !verify);
    const liveMaterial = await sumLiveMaterial(site.id);
    const histMaterial = await sumHistorical(site.id, "MATERIAL", !verify);

    const targetWages = money(row.wages);
    const targetMaterial = money(row.material);
    const currentWages = liveWages.add(histWages).toDecimalPlaces(2);
    const currentMaterial = liveMaterial.add(histMaterial).toDecimalPlaces(2);
    const wageDelta = Prisma.Decimal.max(
      targetWages.sub(currentWages).toDecimalPlaces(2),
      money(0),
    );
    const materialDelta = Prisma.Decimal.max(
      targetMaterial.sub(currentMaterial).toDecimalPlaces(2),
      money(0),
    );

    if (verify) {
      console.log(
        `${row.code} ${site.name}: wages R${currentWages.toFixed(2)} / R${targetWages.toFixed(2)}, material R${currentMaterial.toFixed(2)} / R${targetMaterial.toFixed(2)}`,
      );
      continue;
    }

    console.log(
      `${row.code} ${site.name}: add wages R${wageDelta.toFixed(2)}, add material R${materialDelta.toFixed(2)}`,
    );

    if (!apply) continue;

    await prisma.$transaction(async (tx) => {
      await tx.historicalSiteCost.deleteMany({
        where: { siteId: site.id, batchRef: BATCH_REF },
      });

      if (wageDelta.gt(0)) {
        await tx.historicalSiteCost.create({
          data: {
            siteId: site.id,
            source: "BUILDSMART",
            category: "LABOUR",
            transactionDate: CUT_OFF,
            externalRef: `${BATCH_REF}-${row.code}-wages`,
            batchRef: BATCH_REF,
            ledgerCode: "MANUAL-LABOUR",
            description: "Manual Mawesi paper top-up to 2026-06-11 wages",
            amount: wageDelta,
          },
        });
      }

      if (materialDelta.gt(0)) {
        await tx.historicalSiteCost.create({
          data: {
            siteId: site.id,
            source: "BUILDSMART",
            category: "MATERIAL",
            transactionDate: CUT_OFF,
            externalRef: `${BATCH_REF}-${row.code}-material`,
            batchRef: BATCH_REF,
            ledgerCode: "MANUAL-MATERIAL",
            description: "Manual Mawesi paper top-up to 2026-06-11 material",
            amount: materialDelta,
          },
        });
      }
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
