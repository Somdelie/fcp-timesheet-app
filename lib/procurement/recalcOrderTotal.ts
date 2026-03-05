import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/client";

/**
 * Recalculate SiteProductOrder.totalCost from its items:
 *   totalCost = SUM(item.quantity * item.unitPriceAtOrder)
 *
 * Call this after every item create / update / delete.
 */
export async function recalcOrderTotal(orderId: string): Promise<Decimal> {
  const items = await prisma.siteProductOrderItem.findMany({
    where: { orderId },
    select: { quantity: true, unitPriceAtOrder: true },
  });

  const total = items.reduce((sum, item) => {
    // quantity (int) * unitPriceAtOrder (Decimal)
    return sum.add(new Decimal(item.quantity).mul(item.unitPriceAtOrder));
  }, new Decimal(0));

  await prisma.siteProductOrder.update({
    where: { id: orderId },
    data: { totalCost: total },
  });

  return total;
}
