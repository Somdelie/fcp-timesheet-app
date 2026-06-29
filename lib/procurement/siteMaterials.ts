import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

type Db = typeof prisma | Prisma.TransactionClient;

export async function ensureSiteMaterialsForProducts(
  db: Db,
  input: { siteId: string; productIds: string[] },
) {
  const productIds = [...new Set(input.productIds.filter(Boolean))];
  if (productIds.length === 0) return 0;

  const result = await db.siteMaterial.createMany({
    data: productIds.map((productId) => ({
      siteId: input.siteId,
      productId,
    })),
    skipDuplicates: true,
  });

  return result.count;
}

export async function ensureSiteMaterialsFromOrders(db: Db, siteId: string) {
  const orderedProducts = await db.siteProductOrderItem.groupBy({
    by: ["productId"],
    where: { order: { siteId } },
  });

  return ensureSiteMaterialsForProducts(db, {
    siteId,
    productIds: orderedProducts.map((row) => row.productId),
  });
}
