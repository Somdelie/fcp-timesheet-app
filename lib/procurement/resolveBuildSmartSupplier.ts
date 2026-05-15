import { prisma } from "@/lib/prisma";
import { normalizeSkuKey } from "@/lib/procurement/buildsmartProductCodes";
import { inferSupplierNameFromDescription } from "@/lib/procurement/inferSupplierFromDescription";

export type SupplierResolutionSource =
  | "existing_product"
  | "supplier_price"
  | "sibling_sku"
  | "po_reference"
  | "description_inference"
  | "none";

export type SupplierResolution = {
  supplierId: string | null;
  supplierName: string | null;
  source: SupplierResolutionSource;
};

let supplierNameToIdCache: Map<string, string> | null = null;
let allSupplierNamesCache: string[] | null = null;

async function loadSupplierLookups() {
  if (supplierNameToIdCache) {
    return {
      nameToId: supplierNameToIdCache,
      names: allSupplierNamesCache!,
    };
  }

  const suppliers = await prisma.supplier.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  supplierNameToIdCache = new Map(
    suppliers.map((s) => [s.name.toLowerCase(), s.id]),
  );
  allSupplierNamesCache = suppliers.map((s) => s.name);

  return { nameToId: supplierNameToIdCache, names: allSupplierNamesCache };
}

export function clearSupplierLookupCache() {
  supplierNameToIdCache = null;
  allSupplierNamesCache = null;
}

function resolveByName(
  supplierName: string,
  nameToId: Map<string, string>,
): SupplierResolution | null {
  const id = nameToId.get(supplierName.toLowerCase());
  if (!id) return null;
  return {
    supplierId: id,
    supplierName,
    source: "description_inference",
  };
}

/**
 * Resolve a supplier for a procurement product using multiple strategies.
 */
export async function resolveSupplierForProduct(input: {
  productId?: string;
  description: string;
  sku?: string | null;
  orderReference?: string | null;
  existingSupplierId?: string | null;
}): Promise<SupplierResolution> {
  if (input.existingSupplierId) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: input.existingSupplierId },
      select: { id: true, name: true },
    });
    if (supplier) {
      return {
        supplierId: supplier.id,
        supplierName: supplier.name,
        source: "existing_product",
      };
    }
  }

  const { nameToId, names } = await loadSupplierLookups();

  // Active supplier price list (product may lack default supplier)
  if (input.productId) {
    const priceRow = await prisma.supplierProductPrice.findFirst({
      where: { productId: input.productId, isActive: true },
      select: { supplier: { select: { id: true, name: true } } },
      orderBy: { startsOn: "desc" },
    });
    if (priceRow?.supplier) {
      return {
        supplierId: priceRow.supplier.id,
        supplierName: priceRow.supplier.name,
        source: "supplier_price",
      };
    }
  }

  // Another product with the same name already has a supplier (seeded catalog)
  const nameMatch = await prisma.procurementProduct.findFirst({
    where: {
      name: { equals: input.description.trim(), mode: "insensitive" },
      supplierId: { not: null },
      ...(input.productId ? { id: { not: input.productId } } : {}),
    },
    select: { supplierId: true, supplier: { select: { name: true } } },
  });
  if (nameMatch?.supplierId && nameMatch.supplier) {
    return {
      supplierId: nameMatch.supplierId,
      supplierName: nameMatch.supplier.name,
      source: "sibling_sku",
    };
  }

  // Another product with the same SKU already has a supplier
  if (input.sku) {
    const key = normalizeSkuKey(input.sku);
    if (key) {
      const siblings = await prisma.procurementProduct.findMany({
        where: {
          sku: { not: null },
          supplierId: { not: null },
          ...(input.productId ? { id: { not: input.productId } } : {}),
        },
        select: { sku: true, supplierId: true, supplier: { select: { name: true } } },
        take: 500,
      });
      const match = siblings.find(
        (p) => p.sku && normalizeSkuKey(p.sku) === key && p.supplierId,
      );
      if (match?.supplierId && match.supplier) {
        return {
          supplierId: match.supplierId,
          supplierName: match.supplier.name,
          source: "sibling_sku",
        };
      }
    }
  }

  // PDF-imported order with same PO reference already has a supplier
  if (input.orderReference) {
    const ref = input.orderReference.trim();
    if (ref) {
      const orderWithSupplier = await prisma.siteProductOrder.findFirst({
        where: {
          reference: ref,
          supplierId: { not: null },
        },
        select: { supplier: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      });
      if (orderWithSupplier?.supplier) {
        return {
          supplierId: orderWithSupplier.supplier.id,
          supplierName: orderWithSupplier.supplier.name,
          source: "po_reference",
        };
      }
    }
  }

  // Brand / keyword inference from description
  const inferredName = inferSupplierNameFromDescription(
    input.description,
    names,
    input.sku,
  );
  if (inferredName) {
    const resolved = resolveByName(inferredName, nameToId);
    if (resolved) {
      resolved.source = "description_inference";
      return resolved;
    }
  }

  return { supplierId: null, supplierName: null, source: "none" };
}

/**
 * Pick the dominant supplier from a list of product IDs (for order-level supplier).
 */
export async function resolveSupplierForOrderItems(
  productIds: string[],
): Promise<SupplierResolution> {
  if (!productIds.length) {
    return { supplierId: null, supplierName: null, source: "none" };
  }

  const products = await prisma.procurementProduct.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      supplierId: true,
      supplier: { select: { id: true, name: true } },
    },
  });

  const counts = new Map<string, { id: string; name: string; count: number }>();
  for (const p of products) {
    if (!p.supplierId || !p.supplier) continue;
    const existing = counts.get(p.supplierId);
    if (existing) existing.count++;
    else counts.set(p.supplierId, { id: p.supplierId, name: p.supplier.name, count: 1 });
  }

  if (counts.size === 0) {
    return { supplierId: null, supplierName: null, source: "none" };
  }

  const winner = [...counts.values()].sort((a, b) => b.count - a.count)[0];
  return {
    supplierId: winner.id,
    supplierName: winner.name,
    source: "existing_product",
  };
}
