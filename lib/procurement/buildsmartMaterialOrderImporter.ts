import { prisma } from "@/lib/prisma";
import {
  mapDescriptionToProduct,
  parseUnitToken,
} from "@/lib/buildsmart-import-mappings";
import { parseBuildSmartProduct } from "@/lib/product-color-parser";
import {
  inferBuildSmartProductCode,
  normalizeSkuKey,
} from "@/lib/procurement/buildsmartProductCodes";
import type { ParsedMaterialLine } from "@/lib/buildsmart-cost-parser";
import type { ProductUom } from "@/generated/prisma/client";
import {
  resolveSupplierForOrderItems,
  resolveSupplierForProduct,
} from "@/lib/procurement/resolveBuildSmartSupplier";

export type MaterialOrderImportStatus =
  | "CREATED"
  | "DUPLICATE"
  | "MISSING_SITE"
  | "NO_ORDER_NUMBER"
  | "ERROR";

export interface MaterialOrderImportResult {
  orderNumber: string | null;
  siteCode: string;
  siteName: string | null;
  transactionDate: Date;
  status: MaterialOrderImportStatus;
  reason?: string;
  orderId?: string;
  linesCreated: number;
  totalAmount: string;
}

/**
 * Find or create a ProcurementProduct by clean name, then find or create a
 * ProductColorVariant if a color was detected in the raw description.
 *
 * Returns the product id (always) and the color variant id (when applicable).
 */
async function resolveProduct(
  description: string,
  orderReference?: string | null,
): Promise<{
  productId: string;
  colorVariantId: string | null;
}> {
  // Explicit override mapping takes priority over parser
  const mapped = mapDescriptionToProduct(description);

  const { cleanName, sku: parsedSku, colorName, baseType, isTinted } =
    parseBuildSmartProduct(description.trim());
  const productCode = parsedSku ?? inferBuildSmartProductCode(description);

  const canonicalName = mapped ?? cleanName;

  // ── Find or create base product ──────────────────────────────────────────
  const products = await prisma.procurementProduct.findMany({
    where: {
      OR: [
        { name: { equals: canonicalName, mode: "insensitive" } },
        ...(productCode ? [{ sku: { not: null } }] : []),
      ],
    },
    select: { id: true, sku: true, name: true, supplierId: true },
  });

  let product =
    productCode
      ? products.find((p) => normalizeSkuKey(p.sku) === normalizeSkuKey(productCode))
      : undefined;

  product ??= products.find(
    (p) => p.name.toLowerCase() === canonicalName.toLowerCase(),
  );

  if (!product) {
    const supplierResolution = await resolveSupplierForProduct({
      description,
      sku: productCode,
      orderReference,
    });

    product = await prisma.procurementProduct.create({
      data: {
        name: canonicalName,
        productType: "MATERIAL",
        ...(productCode && !mapped ? { sku: productCode } : {}),
        ...(supplierResolution.supplierId
          ? { supplier: { connect: { id: supplierResolution.supplierId } } }
          : {}),
      },
      select: { id: true, sku: true, name: true, supplierId: true },
    });
  } else if (!product.supplierId) {
    const supplierResolution = await resolveSupplierForProduct({
      productId: product.id,
      description,
      sku: product.sku ?? productCode,
      orderReference,
      existingSupplierId: null,
    });
    if (supplierResolution.supplierId) {
      await prisma.procurementProduct.update({
        where: { id: product.id },
        data: { supplierId: supplierResolution.supplierId },
      });
      product = { ...product, supplierId: supplierResolution.supplierId };
    }
  }

  // ── Find or create color variant (if a color was detected) ───────────────
  let colorVariantId: string | null = null;
  if (colorName) {
    const existing = await prisma.productColorVariant.findFirst({
      where: {
        productId: product.id,
        colorName: { equals: colorName, mode: "insensitive" },
        baseType,
      },
      select: { id: true },
    });

    if (existing) {
      colorVariantId = existing.id;
    } else {
      try {
        const created = await prisma.productColorVariant.create({
          data: {
            productId: product.id,
            colorName,
            baseType,
            isTinted,
          },
          select: { id: true },
        });
        colorVariantId = created.id;
      } catch {
        // Unique constraint race — fetch whatever was just inserted
        const raced = await prisma.productColorVariant.findFirst({
          where: {
            productId: product.id,
            colorName: { equals: colorName, mode: "insensitive" },
            baseType,
          },
          select: { id: true },
        });
        colorVariantId = raced?.id ?? null;
      }
    }
  }

  return { productId: product.id, colorVariantId };
}

/** Process a single order group against the already-resolved site map. */
async function processOrderGroup(
  groupLines: ParsedMaterialLine[],
  siteMap: Map<string, string>,
): Promise<MaterialOrderImportResult> {
  const first = groupLines[0];
  const orderNumber = first.orderNumber;

  if (!orderNumber) {
    const total = groupLines.reduce((s, l) => s + parseFloat(l.totalAmount), 0);
    return {
      orderNumber: null,
      siteCode: first.siteCode,
      siteName: first.siteName,
      transactionDate: first.transactionDate,
      status: "NO_ORDER_NUMBER",
      reason: "Could not extract order number from line",
      linesCreated: 0,
      totalAmount: total.toFixed(2),
    };
  }

  const siteId = siteMap.get(first.siteCode);
  if (!siteId) {
    const total = groupLines.reduce((s, l) => s + parseFloat(l.totalAmount), 0);
    return {
      orderNumber,
      siteCode: first.siteCode,
      siteName: first.siteName,
      transactionDate: first.transactionDate,
      status: "MISSING_SITE",
      reason: `Site code "${first.siteCode}" not found`,
      linesCreated: 0,
      totalAmount: total.toFixed(2),
    };
  }

  const existingOrder = await prisma.siteProductOrder.findFirst({
    where: { siteId, reference: orderNumber },
    select: { id: true },
  });
  if (existingOrder) {
    const total = groupLines.reduce((s, l) => s + parseFloat(l.totalAmount), 0);
    return {
      orderNumber,
      siteCode: first.siteCode,
      siteName: first.siteName,
      transactionDate: first.transactionDate,
      status: "DUPLICATE",
      reason: `Order ${orderNumber} already exists for this site`,
      orderId: existingOrder.id,
      linesCreated: 0,
      totalAmount: total.toFixed(2),
    };
  }

  try {
    const orderDate = groupLines.reduce(
      (earliest, l) => (l.transactionDate < earliest ? l.transactionDate : earliest),
      groupLines[0].transactionDate,
    );
    const totalAmount = groupLines
      .reduce((s, l) => s + parseFloat(l.totalAmount), 0)
      .toFixed(2);

    const itemData: {
      productId: string;
      quantity: number;
      unitPriceAtOrder: number;
      uomAtOrder: ProductUom | null;
      unitSizeAtOrder: number | null;
    }[] = [];

    const resolvedProducts: { productId: string }[] = [];

    for (const line of groupLines) {
      const { productId } = await resolveProduct(line.description, orderNumber);
      resolvedProducts.push({ productId });
      const qty = line.quantity ?? 1;
      const unitPrice = line.unitPrice
        ? parseFloat(line.unitPrice)
        : parseFloat(line.totalAmount);
      const { uomAtOrder, unitSizeAtOrder } = parseUnitToken(line.unit ?? null);
      itemData.push({ productId, quantity: qty, unitPriceAtOrder: unitPrice, uomAtOrder, unitSizeAtOrder });
    }

    let orderSupplierId: string | null = null;
    if (orderNumber) {
      const refSupplier = await resolveSupplierForProduct({
        description: groupLines[0].description,
        orderReference: orderNumber,
      });
      orderSupplierId = refSupplier.supplierId;
    }
    if (!orderSupplierId) {
      const fromItems = await resolveSupplierForOrderItems(
        resolvedProducts.map((p) => p.productId),
      );
      orderSupplierId = fromItems.supplierId;
    }

    const order = await prisma.siteProductOrder.create({
      data: {
        siteId,
        reference: orderNumber,
        note: `Seeded from BuildSmart historical cost report`,
        createdAt: orderDate,
        totalCost: parseFloat(totalAmount),
        supplierId: orderSupplierId,
        items: {
          create: itemData.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPriceAtOrder: item.unitPriceAtOrder,
            uomAtOrder: item.uomAtOrder ?? undefined,
            unitSizeAtOrder: item.unitSizeAtOrder ?? undefined,
          })),
        },
      },
      select: { id: true },
    });

    return {
      orderNumber,
      siteCode: first.siteCode,
      siteName: first.siteName,
      transactionDate: orderDate,
      status: "CREATED",
      orderId: order.id,
      linesCreated: itemData.length,
      totalAmount,
    };
  } catch (err) {
    const total = groupLines.reduce((s, l) => s + parseFloat(l.totalAmount), 0);
    return {
      orderNumber,
      siteCode: first.siteCode,
      siteName: first.siteName,
      transactionDate: first.transactionDate,
      status: "ERROR",
      reason: err instanceof Error ? err.message : "Unknown error",
      linesCreated: 0,
      totalAmount: total.toFixed(2),
    };
  }
}

function buildGroupsAndSiteMap(lines: ParsedMaterialLine[]) {
  const siteCodes = [...new Set(lines.map((l) => l.siteCode).filter(Boolean))];
  const groups = new Map<string, ParsedMaterialLine[]>();
  for (const line of lines) {
    const key = `${line.siteCode}::${line.orderNumber ?? "__NO_ORDER__"}`;
    const group = groups.get(key) ?? [];
    group.push(line);
    groups.set(key, group);
  }
  return { siteCodes, groups };
}

/**
 * Streaming variant — yields one result per order group with running totals.
 * Use this when you need live progress (e.g. a streaming HTTP response).
 */
export async function* importMaterialOrdersStream(
  lines: ParsedMaterialLine[],
): AsyncGenerator<{ total: number; done: number; result: MaterialOrderImportResult }> {
  const { siteCodes, groups } = buildGroupsAndSiteMap(lines);

  const sites = await prisma.site.findMany({
    where: { code: { in: siteCodes } },
    select: { id: true, code: true },
  });
  const siteMap = new Map(sites.map((s) => [s.code!, s.id]));

  const total = groups.size;
  let done = 0;

  for (const [, groupLines] of groups) {
    const result = await processOrderGroup(groupLines, siteMap);
    done++;
    yield { total, done, result };
  }
}

/**
 * Batch variant — collects all results and returns them at once.
 * Kept for backward compatibility (cleanup API etc.).
 */
export async function importMaterialOrders(
  lines: ParsedMaterialLine[],
): Promise<MaterialOrderImportResult[]> {
  const results: MaterialOrderImportResult[] = [];
  for await (const { result } of importMaterialOrdersStream(lines)) {
    results.push(result);
  }
  return results;
}
