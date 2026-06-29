import { prisma } from "@/lib/prisma";
import type { ProductUom } from "@/generated/prisma/client";
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

  const product = await prisma.procurementProduct.findUnique({
    where: { id: opts.productId },
    select: { sku: true, name: true },
  });

  const sku = product?.sku?.trim();
  if (sku && sku.length >= 6) {
    const wholeUnitSize =
      opts.unitSize != null ? String(Math.trunc(opts.unitSize)) : null;
    const sizePadded =
      wholeUnitSize != null ? wholeUnitSize.padStart(4, "0") : null;
    const normalizedVariantSku =
      sizePadded && wholeUnitSize && sku.endsWith(wholeUnitSize)
        ? `${sku.slice(0, -wholeUnitSize.length)}-${sizePadded}`
        : null;

    if (normalizedVariantSku) {
      const normalizedVariantPrice = await prisma.supplierProductPrice.findFirst({
        where: {
          product: {
            sku: { equals: normalizedVariantSku, mode: "insensitive" },
          },
          ...sizeFilter,
          isActive: true,
          startsOn: { lte: now },
          OR: [{ endsOn: null }, { endsOn: { gte: now } }],
        },
        orderBy: { startsOn: "desc" },
        select: { price: true },
      });

      if (normalizedVariantPrice) return normalizedVariantPrice.price;
    }

    if (wholeUnitSize && sku.endsWith(wholeUnitSize)) {
      const baseSku = sku.slice(0, -wholeUnitSize.length);
      const baseSkuPrice = await prisma.supplierProductPrice.findFirst({
        where: {
          product: {
            sku: { equals: baseSku, mode: "insensitive" },
          },
          ...sizeFilter,
          isActive: true,
          startsOn: { lte: now },
          OR: [{ endsOn: null }, { endsOn: { gte: now } }],
        },
        orderBy: { startsOn: "desc" },
        select: { price: true },
      });

      if (baseSkuPrice) return baseSkuPrice.price;
    }

    const skuVariantPrice = await prisma.supplierProductPrice.findFirst({
      where: {
        product: {
          sku: { startsWith: `${sku}-`, mode: "insensitive" },
        },
        ...sizeFilter,
        isActive: true,
        startsOn: { lte: now },
        OR: [{ endsOn: null }, { endsOn: { gte: now } }],
      },
      orderBy: { startsOn: "desc" },
      select: { price: true },
    });

    if (skuVariantPrice) return skuVariantPrice.price;

    const skuAliasPrice = await prisma.supplierProductPrice.findFirst({
      where: {
        productId: { not: opts.productId },
        product: {
          name: { contains: sku, mode: "insensitive" },
        },
        ...sizeFilter,
        isActive: true,
        startsOn: { lte: now },
        OR: [{ endsOn: null }, { endsOn: { gte: now } }],
      },
      orderBy: { startsOn: "desc" },
      select: { price: true },
    });

    if (skuAliasPrice) return skuAliasPrice.price;
  }

  const historicalPrice = await prisma.siteProductOrderItem.findFirst({
    where: {
      productId: opts.productId,
      unitPriceAtOrder: { gt: 0 },
      ...(opts.uom ? { uomAtOrder: opts.uom as ProductUom } : {}),
      ...(opts.unitSize != null ? { unitSizeAtOrder: opts.unitSize } : {}),
      ...(opts.supplierId
        ? { order: { supplierId: opts.supplierId } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    select: { unitPriceAtOrder: true },
  });

  if (historicalPrice) return historicalPrice.unitPriceAtOrder;

  if (opts.supplierId) {
    const anySupplierHistoricalPrice = await prisma.siteProductOrderItem.findFirst({
      where: {
        productId: opts.productId,
        unitPriceAtOrder: { gt: 0 },
        ...(opts.uom ? { uomAtOrder: opts.uom as ProductUom } : {}),
        ...(opts.unitSize != null ? { unitSizeAtOrder: opts.unitSize } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: { unitPriceAtOrder: true },
    });

    if (anySupplierHistoricalPrice) {
      return anySupplierHistoricalPrice.unitPriceAtOrder;
    }
  }

  // 4. Nothing found
  return new Decimal(0);
}
