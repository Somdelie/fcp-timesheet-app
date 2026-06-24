import { prisma } from "@/lib/prisma";
import { ensureSitePaintColorFromOrderItem } from "@/lib/procurement/sitePaintColorSeeder";

async function main() {
  const siteCode = process.argv
    .find((arg) => arg.startsWith("--site-code="))
    ?.slice("--site-code=".length);

  const items = await prisma.siteProductOrderItem.findMany({
    where: siteCode
      ? {
          order: {
            site: {
              code: siteCode,
            },
          },
        }
      : undefined,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      productId: true,
      note: true,
      product: { select: { name: true } },
      order: {
        select: {
          id: true,
          siteId: true,
          reference: true,
          supplierId: true,
          supplier: { select: { name: true } },
          site: { select: { code: true, name: true } },
        },
      },
    },
  });

  let seeded = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of items) {
    const result = await ensureSitePaintColorFromOrderItem(prisma, {
      siteId: item.order.siteId,
      productId: item.productId,
      rawDescription: item.note ?? item.product.name,
      supplierId: item.order.supplierId,
      supplierName: item.order.supplier?.name ?? null,
      sourceOrderId: item.order.id,
      sourceOrderItemId: item.id,
      orderReference: item.order.reference,
      sourceFile: "existing site product order backfill",
    });

    if (!result.ok) {
      failed += 1;
      console.warn(
        `Failed ${item.order.site.code ?? item.order.site.name} ${item.order.reference ?? item.order.id}: ${result.error}`,
      );
    } else if (result.seeded) {
      seeded += 1;
    } else {
      skipped += 1;
    }
  }

  console.log(
    `Backfill complete. scanned=${items.length} seededOrExisting=${seeded} skipped=${skipped} failed=${failed}`,
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
