import { prisma } from "@/lib/prisma";
import type { ProductUom } from "@/generated/prisma/client";
import type { Decimal } from "@prisma/client/runtime/client";

function normalizeCatalogueName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The resolver's stable return contract. Deliberately narrower than any
 * single Prisma record — callers get exactly these four fields regardless
 * of which branch (legacy hit, linked master, or newly-created
 * compatibility row) resolved them.
 */
export type ResolvedCatalogueProduct = {
  legacyProductId: string;
  masterCatalogueProductId: string | null;
  uom: ProductUom | null;
  unitSize: Decimal | null;
};

/**
 * Resolves a product reference to the canonical procurement pair.
 *
 * Accepts either a legacy ProcurementProduct id or a MasterCatalogueProduct
 * id.
 *
 * Guarantees:
 * - returns the linked ProcurementProduct
 * - creates the compatibility ProcurementProduct when required
 * - preserves legacy order behaviour
 *
 * Used by:
 * - material-orders
 * - supplier-prices
 *
 * Was duplicated (as resolveOrderProduct / resolvePriceProduct) in
 * material-orders/route.ts and supplier-prices/route.ts with identical
 * resolution and compatibility-product-creation logic; only the query
 * breadth differed (material-orders also needed uom/unitSize), which this
 * unified version always returns.
 */
export async function resolveCatalogueProduct(
  productId: string,
): Promise<ResolvedCatalogueProduct | null> {
  const legacy = await prisma.procurementProduct.findUnique({
    where: { id: productId },
    include: { masterCatalogueProduct: true },
  });

  if (legacy) {
    return {
      legacyProductId: legacy.id,
      masterCatalogueProductId: legacy.masterCatalogueProductId,
      uom: legacy.masterCatalogueProduct?.uom ?? legacy.uom,
      unitSize: legacy.masterCatalogueProduct?.unitSize ?? legacy.unitSize,
    };
  }

  const master = await prisma.masterCatalogueProduct.findUnique({
    where: { id: productId },
    include: { legacyProcurementProduct: true },
  });

  if (!master) return null;

  if (master.legacyProcurementProduct) {
    return {
      legacyProductId: master.legacyProcurementProduct.id,
      masterCatalogueProductId: master.id,
      uom: master.uom ?? master.legacyProcurementProduct.uom,
      unitSize: master.unitSize ?? master.legacyProcurementProduct.unitSize,
    };
  }

  const compatibilityProduct = await prisma.procurementProduct.create({
    data: {
      name: master.name,
      normalizedName:
        master.normalizedName || normalizeCatalogueName(master.name),
      sku: master.sku,
      description: master.description,
      categoryId: master.categoryId,
      supplierId: master.supplierId,
      thumbnailUrl: master.thumbnailUrl,
      productType: master.productType,
      uom: master.uom,
      unitSize: master.unitSize,
      isReturnable: master.isReturnable,
      isDeductible: master.isDeductible,
      deductionSplits: master.deductionSplits,
      colors: master.colors,
      sizes: master.sizes,
      stockQty: master.stockQty,
      isActive: master.isActive,
      masterCatalogueProductId: master.id,
    },
  });

  return {
    legacyProductId: compatibilityProduct.id,
    masterCatalogueProductId: master.id,
    uom: master.uom,
    unitSize: master.unitSize,
  };
}
