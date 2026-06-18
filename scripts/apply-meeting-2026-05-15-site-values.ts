import "dotenv/config";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";

const CUT_OFF = new Date("2026-05-15T12:00:00.000Z");
const END_EXCLUSIVE = new Date("2026-05-16T00:00:00.000Z");
const BATCH_REF = "manual-meeting-2026-05-15";
const CLAIM_NO = "MEETING-2026-05-15";

type MeetingRow = {
  code: string;
  wages: number;
  material: number;
  amountClaimed?: number;
  amountReceived?: number;
};

const rows: MeetingRow[] = [
  // Lawrence
  { code: "6316", wages: 2153177.22, material: 2778655.35, amountClaimed: 6304938.17, amountReceived: 5038201.67 },
  { code: "6450", wages: 987280.69, material: 967867.41, amountClaimed: 2615153.46, amountReceived: 1751997.37 },
  { code: "6595", wages: 234524.83, material: 196043.49, amountClaimed: 694988.42, amountReceived: 646287.66 },
  { code: "6660", wages: 96140.57, material: 70418.94, amountClaimed: 218244.60 },
  { code: "6727", wages: 24179.19, material: 18375.14 },
  { code: "6694", wages: 326226.61, material: 136574.37, amountClaimed: 1478864.95, amountReceived: 1428905.52 },

  // Temba
  { code: "5619", wages: 1238368.90, material: 1252439.95, amountClaimed: 3956444.23, amountReceived: 3357680.63 },
  { code: "5928", wages: 406696.27, material: 470148.18, amountClaimed: 1285027.04, amountReceived: 1210704.07 },
  { code: "6497", wages: 39532.37, material: 60372.31, amountClaimed: 193251.98, amountReceived: 108308.05 },
  { code: "6573", wages: 270714.27, material: 400035.86, amountClaimed: 984106.41, amountReceived: 456025.26 },
  { code: "6584", wages: 398176.27, material: 742288.07, amountClaimed: 2054531.58, amountReceived: 1134191.56 },
  { code: "6455", wages: 69700.97, material: 73254.02, amountClaimed: 222310.00, amountReceived: 216609.74 },
  { code: "6746", wages: 9525.95, material: 2441.64, amountClaimed: 26181.08 },

  // Thousand
  { code: "5083", wages: 1123672.47, material: 858031.44, amountClaimed: 3026058.37, amountReceived: 2777116.15 },
];

function money(value: Prisma.Decimal | string | number | null | undefined) {
  return new Prisma.Decimal(value ?? 0).toDecimalPlaces(2);
}

function statusFor(claimed: number, received: number) {
  if (received <= 0) return "SUBMITTED" as const;
  if (received >= claimed) return "RECEIVED" as const;
  return "PARTIALLY_RECEIVED" as const;
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
  excludeBatch = true,
) {
  const result = await prisma.historicalSiteCost.aggregate({
    where: {
      siteId,
      category: category === "LABOUR" ? "LABOUR" : { not: "LABOUR" },
      transactionDate: { lt: END_EXCLUSIVE },
      ...(excludeBatch
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
    select: {
      id: true,
      code: true,
      name: true,
      amountClaimed: true,
      claims: {
        where: { claimNo: CLAIM_NO },
        select: { amountClaimed: true, amountReceived: true },
        take: 1,
      },
    },
  });
  const siteByCode = new Map(sites.map((site) => [site.code, site]));

  console.log(
    `${verify ? "Verifying" : apply ? "Applying" : "Previewing"} ${rows.length} meeting rows as at 2026-05-15`,
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
    const wageDelta = targetWages.sub(currentWages).toDecimalPlaces(2);
    const materialDelta = targetMaterial.sub(currentMaterial).toDecimalPlaces(2);

    if (verify) {
      const claim = site.claims[0];
      const claimedText =
        row.amountClaimed === undefined
          ? "no claim target"
          : `claimed R${money(site.amountClaimed).toFixed(2)} / R${money(row.amountClaimed).toFixed(2)}, received R${money(claim?.amountReceived ?? 0).toFixed(2)} / R${money(row.amountReceived ?? 0).toFixed(2)}`;
      console.log(
        `${row.code} ${site.name}: wages R${currentWages.toFixed(2)} / R${targetWages.toFixed(2)}, material R${currentMaterial.toFixed(2)} / R${targetMaterial.toFixed(2)}, ${claimedText}`,
      );
      continue;
    }

    console.log(
      `${row.code} ${site.name}: wages delta R${wageDelta.toFixed(2)}, material delta R${materialDelta.toFixed(2)}`,
    );

    if (!apply) continue;

    await prisma.$transaction(async (tx) => {
      await tx.historicalSiteCost.deleteMany({
        where: { siteId: site.id, batchRef: BATCH_REF },
      });

      if (!wageDelta.isZero()) {
        await tx.historicalSiteCost.create({
          data: {
            siteId: site.id,
            source: "BUILDSMART",
            category: "LABOUR",
            transactionDate: CUT_OFF,
            externalRef: `${BATCH_REF}-${row.code}-wages`,
            batchRef: BATCH_REF,
            ledgerCode: "MANUAL-LABOUR",
            description: "Manual meeting total adjustment to 2026-05-15 wages",
            amount: wageDelta,
          },
        });
      }

      if (!materialDelta.isZero()) {
        await tx.historicalSiteCost.create({
          data: {
            siteId: site.id,
            source: "BUILDSMART",
            category: "MATERIAL",
            transactionDate: CUT_OFF,
            externalRef: `${BATCH_REF}-${row.code}-material`,
            batchRef: BATCH_REF,
            ledgerCode: "MANUAL-MATERIAL",
            description: "Manual meeting total adjustment to 2026-05-15 material",
            amount: materialDelta,
          },
        });
      }

      if (row.amountClaimed !== undefined) {
        const claimed = money(row.amountClaimed);
        const received = money(row.amountReceived ?? 0);
        await tx.site.update({
          where: { id: site.id },
          data: { amountClaimed: claimed, siteClaimDate: CUT_OFF },
        });
        const existingClaim = await tx.siteClaim.findFirst({
          where: { siteId: site.id, claimNo: CLAIM_NO },
          select: { id: true },
        });
        const claimData = {
          claimDate: CUT_OFF,
          siteClaimDate: CUT_OFF,
          description: "Historical meeting sheet values up to 2026-05-15",
          amountClaimed: claimed,
          amountReceived: received,
          status: statusFor(row.amountClaimed, row.amountReceived ?? 0),
        };
        if (existingClaim) {
          await tx.siteClaim.update({ where: { id: existingClaim.id }, data: claimData });
        } else {
          await tx.siteClaim.create({
            data: { siteId: site.id, claimNo: CLAIM_NO, ...claimData },
          });
        }
      }
    });
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
