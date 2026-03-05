import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/client";

/**
 * Resolve the unit price to snapshot on a SiteProductOrderItem.
 *
 * Priority:
 *  1. If the caller manually provides a price → use it.
 *  2. If the parent order has a supplierId → latest active SupplierProductPrice
 *     for (supplierId, productId, uom, unitSize) where startsOn <= now and
 *     (endsOn is null or endsOn >= now).
 *  3. Fallback → latest active price for the product across ALL suppliers
 *     (optionally filtered by uom/unitSize).
 *  4. If nothing found → Decimal(0).
 */
export async function resolveUnitPrice(opts: {
  manualPrice?: number | string | null;
  supplierId?: string | null;
  productId: string;
  uom?: string;
  unitSize?: number;
}): Promise<Decimal> {
  // 1. Manual override
  if (opts.manualPrice != null && opts.manualPrice !== "") {
    return new Decimal(opts.manualPrice);
  }

  const now = new Date();

  // Build optional size-match filter
  const sizeFilter: Record<string, unknown> = {};
  if (opts.uom) sizeFilter.uom = opts.uom;
  if (opts.unitSize != null) sizeFilter.unitSize = opts.unitSize;

  // 2. Supplier-specific price
  if (opts.supplierId) {
    const supplierPrice = await prisma.supplierProductPrice.findFirst({
      where: {
        supplierId: opts.supplierId,
        productId: opts.productId,
        ...sizeFilter,
        isActive: true,
        startsOn: { lte: now },
        OR: [{ endsOn: null }, { endsOn: { gte: now } }],
      },
      orderBy: { startsOn: "desc" },
      select: { price: true },
    });

    if (supplierPrice) return supplierPrice.price;
  }

  // 3. Fallback: latest active price across any supplier
  const anyPrice = await prisma.supplierProductPrice.findFirst({
    where: {
      productId: opts.productId,
      ...sizeFilter,
      isActive: true,
      startsOn: { lte: now },
      OR: [{ endsOn: null }, { endsOn: { gte: now } }],
    },
    orderBy: { startsOn: "desc" },
    select: { price: true },
  });

  if (anyPrice) return anyPrice.price;

  // 4. Nothing found
  return new Decimal(0);
}
