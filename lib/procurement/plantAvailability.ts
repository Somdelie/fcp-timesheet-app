import { prisma } from "@/lib/prisma";
import type { PlantCondition } from "@/generated/prisma/client";

export interface PlantVariantAvailability {
  size: string | null;
  color: string | null;
  condition: PlantCondition;
  total: number;
  deployed: number;
  available: number;
}

function variantKey(
  productId: string,
  size: string | null,
  condition: PlantCondition,
) {
  return `${productId}|${size ?? ""}|${condition}`;
}

/**
 * Per-(product, size, condition) availability, computed live from
 * ProductVariantStock totals minus currently DEPLOYED/REPAIR assignments —
 * same "no manual counters" approach as the existing stockQty/deployedQty
 * aggregate on ProcurementProduct, just grouped one level finer.
 *
 * Color is carried on each returned row for display but isn't part of the
 * availability grouping key — stock isn't tracked per color today.
 */
export async function getPlantAvailability(
  productIds: string[],
): Promise<Map<string, PlantVariantAvailability[]>> {
  if (productIds.length === 0) return new Map();

  const [variantStocks, deployedSums] = await Promise.all([
    prisma.productVariantStock.findMany({
      where: { productId: { in: productIds } },
      select: { productId: true, size: true, color: true, condition: true, qty: true },
    }),
    prisma.sitePlantAssignment.groupBy({
      by: ["productId", "size", "condition"],
      where: {
        productId: { in: productIds },
        status: { in: ["DEPLOYED", "REPAIR"] },
      },
      _sum: { quantity: true },
    }),
  ]);

  const deployedByKey = new Map<string, number>();
  for (const row of deployedSums) {
    deployedByKey.set(
      variantKey(row.productId, row.size, row.condition),
      row._sum.quantity ?? 0,
    );
  }

  const byProduct = new Map<string, PlantVariantAvailability[]>();
  for (const stock of variantStocks) {
    const deployed =
      deployedByKey.get(variantKey(stock.productId, stock.size, stock.condition)) ?? 0;
    const list = byProduct.get(stock.productId) ?? [];
    list.push({
      size: stock.size,
      color: stock.color,
      condition: stock.condition,
      total: stock.qty,
      deployed,
      available: Math.max(0, stock.qty - deployed),
    });
    byProduct.set(stock.productId, list);
  }

  return byProduct;
}
