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
import { Prisma, type ProductUom } from "@/generated/prisma/client";
import {
  resolveSupplierForOrderItems,
  resolveSupplierForProduct,
} from "@/lib/procurement/resolveBuildSmartSupplier";
import {
  isOrderReferenceTaken,
  loadExistingOrderReferences,
  trackOrderReference,
} from "@/lib/procurement/buildsmartOrderDedup";

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

function toDecimal(value: unknown, fallback = "0"): Prisma.Decimal {
  try {
    if (value === null || value === undefined || value === "") {
      return new Prisma.Decimal(fallback);
    }

    return new Prisma.Decimal(value as string | number | Prisma.Decimal);
  } catch {
    return new Prisma.Decimal(fallback);
  }
}

function normalizeCatalogueName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function resolveStoredUnitPrice({
  supplierId,
  productId,
  uom,
  unitSize,
  pdfUnitPrice,
  pdfLineTotal,
  quantity,
}: {
  supplierId: string | null;
  productId: string;
  uom: ProductUom | null;
  unitSize: number | null;
  pdfUnitPrice: string | null | undefined;
  pdfLineTotal: string;
  quantity: number;
}): Promise<Prisma.Decimal> {
  const directPrice = toDecimal(pdfUnitPrice);

  if (directPrice.gt(0)) {
    return directPrice;
  }

  const lineTotal = toDecimal(pdfLineTotal);
  const safeQuantity = quantity > 0 ? quantity : 1;

  if (lineTotal.gt(0)) {
    return lineTotal.div(safeQuantity);
  }

  const now = new Date();

  const unitSizeDecimal =
    unitSize !== null ? new Prisma.Decimal(unitSize) : null;

  if (supplierId) {
    const exactSupplierPrice = await prisma.supplierProductPrice.findFirst({
      where: {
        supplierId,
        productId,
        isActive: true,
        price: { gt: 0 },
        startsOn: { lte: now },
        OR: [{ endsOn: null }, { endsOn: { gte: now } }],
        ...(uom ? { uom } : {}),
        ...(unitSizeDecimal ? { unitSize: unitSizeDecimal } : {}),
      },
      orderBy: [{ startsOn: "desc" }, { updatedAt: "desc" }],
      select: {
        price: true,
      },
    });

    if (exactSupplierPrice?.price && exactSupplierPrice.price.gt(0)) {
      return exactSupplierPrice.price;
    }

    const supplierPrice = await prisma.supplierProductPrice.findFirst({
      where: {
        supplierId,
        productId,
        isActive: true,
        price: { gt: 0 },
        startsOn: { lte: now },
        OR: [{ endsOn: null }, { endsOn: { gte: now } }],
      },
      orderBy: [{ startsOn: "desc" }, { updatedAt: "desc" }],
      select: {
        price: true,
      },
    });

    if (supplierPrice?.price && supplierPrice.price.gt(0)) {
      return supplierPrice.price;
    }
  }

  const exactProductPrice = await prisma.supplierProductPrice.findFirst({
    where: {
      productId,
      isActive: true,
      price: { gt: 0 },
      startsOn: { lte: now },
      OR: [{ endsOn: null }, { endsOn: { gte: now } }],
      ...(uom ? { uom } : {}),
      ...(unitSizeDecimal ? { unitSize: unitSizeDecimal } : {}),
    },
    orderBy: [{ startsOn: "desc" }, { updatedAt: "desc" }],
    select: {
      price: true,
    },
  });

  if (exactProductPrice?.price && exactProductPrice.price.gt(0)) {
    return exactProductPrice.price;
  }

  const generalProductPrice = await prisma.supplierProductPrice.findFirst({
    where: {
      productId,
      isActive: true,
      price: { gt: 0 },
      startsOn: { lte: now },
      OR: [{ endsOn: null }, { endsOn: { gte: now } }],
    },
    orderBy: [{ startsOn: "desc" }, { updatedAt: "desc" }],
    select: {
      price: true,
    },
  });

  if (generalProductPrice?.price && generalProductPrice.price.gt(0)) {
    return generalProductPrice.price;
  }

  const previousOrderPrice = await prisma.siteProductOrderItem.findFirst({
    where: {
      productId,
      unitPriceAtOrder: { gt: 0 },
      ...(supplierId
        ? {
            order: {
              supplierId,
            },
          }
        : {}),
      ...(uom ? { uomAtOrder: uom } : {}),
      ...(unitSizeDecimal
        ? {
            unitSizeAtOrder: unitSizeDecimal,
          }
        : {}),
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      unitPriceAtOrder: true,
    },
  });

  if (
    previousOrderPrice?.unitPriceAtOrder &&
    previousOrderPrice.unitPriceAtOrder.gt(0)
  ) {
    return previousOrderPrice.unitPriceAtOrder;
  }

  const anyPreviousPrice = await prisma.siteProductOrderItem.findFirst({
    where: {
      productId,
      unitPriceAtOrder: { gt: 0 },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      unitPriceAtOrder: true,
    },
  });

  if (
    anyPreviousPrice?.unitPriceAtOrder &&
    anyPreviousPrice.unitPriceAtOrder.gt(0)
  ) {
    return anyPreviousPrice.unitPriceAtOrder;
  }

  throw new Error(
    `No stored price found for product ${productId}` +
      `${uom ? ` (${unitSize ?? ""}${uom})` : ""}`,
  );
}

/**
 * Resolve a BuildSmart description against the canonical master catalogue.
 *
 * SiteProductOrderItem, SupplierProductPrice and ProductColorVariant still use
 * ProcurementProduct during Stage 1, so this function always returns the linked
 * compatibility ProcurementProduct id.
 */
async function resolveProduct(
  description: string,
  orderReference?: string | null,
): Promise<{
  productId: string;
  masterCatalogueProductId: string | null;
  colorVariantId: string | null;
}> {
  const mapped = mapDescriptionToProduct(description);

  const {
    cleanName,
    sku: parsedSku,
    colorName,
    baseType,
    isTinted,
  } = parseBuildSmartProduct(description.trim());

  const productCode = parsedSku ?? inferBuildSmartProductCode(description);

  const canonicalName = (mapped ?? cleanName).trim();
  const normalizedName = normalizeCatalogueName(canonicalName);
  const normalizedSku = normalizeSkuKey(productCode);

  /*
   * First inspect legacy products. This catches:
   * - existing imported products,
   * - products already linked by the backfill,
   * - old records that still need a master link.
   */
  const legacyCandidates = await prisma.procurementProduct.findMany({
    where: {
      OR: [
        {
          name: {
            equals: canonicalName,
            mode: "insensitive",
          },
        },
        { normalizedName },
        ...(productCode ? [{ sku: { not: null } }] : []),
      ],
    },
    select: {
      id: true,
      sku: true,
      name: true,
      normalizedName: true,
      supplierId: true,
      masterCatalogueProductId: true,
    },
  });

  let legacyProduct = normalizedSku
    ? legacyCandidates.find(
        (candidate) => normalizeSkuKey(candidate.sku) === normalizedSku,
      )
    : undefined;

  legacyProduct ??= legacyCandidates.find(
    (candidate) =>
      normalizeCatalogueName(candidate.name) === normalizedName ||
      candidate.normalizedName === normalizedName,
  );

  /*
   * Resolve the brand/default supplier used by MasterCatalogueProduct.
   * Existing legacy supplier takes priority. The supplier resolver can then
   * infer from description, SKU and PO reference.
   */
  const supplierResolution = await resolveSupplierForProduct({
    productId: legacyProduct?.id,
    description,
    sku: legacyProduct?.sku ?? productCode,
    orderReference,
    existingSupplierId: legacyProduct?.supplierId ?? null,
  });

  const supplierId =
    legacyProduct?.supplierId ?? supplierResolution.supplierId ?? null;

  let masterProduct: {
    id: string;
    supplierId: string;
    name: string;
    normalizedName: string;
    sku: string | null;
    legacyProcurementProduct: {
      id: string;
      supplierId: string | null;
    } | null;
  } | null = null;

  if (legacyProduct?.masterCatalogueProductId) {
    masterProduct = await prisma.masterCatalogueProduct.findUnique({
      where: {
        id: legacyProduct.masterCatalogueProductId,
      },
      select: {
        id: true,
        supplierId: true,
        name: true,
        normalizedName: true,
        sku: true,
        legacyProcurementProduct: {
          select: {
            id: true,
            supplierId: true,
          },
        },
      },
    });
  }

  /*
   * Master catalogue identity is supplier + normalizedName.
   * SKU is also checked first when present because BuildSmart descriptions can
   * vary while the manufacturer's product code remains stable.
   */
  if (!masterProduct && supplierId) {
    const masterCandidates = await prisma.masterCatalogueProduct.findMany({
      where: {
        supplierId,
        OR: [
          { normalizedName },
          {
            name: {
              equals: canonicalName,
              mode: "insensitive",
            },
          },
          ...(productCode ? [{ sku: { not: null } }] : []),
        ],
      },
      select: {
        id: true,
        supplierId: true,
        name: true,
        normalizedName: true,
        sku: true,
        legacyProcurementProduct: {
          select: {
            id: true,
            supplierId: true,
          },
        },
      },
    });

    masterProduct = normalizedSku
      ? (masterCandidates.find(
          (candidate) => normalizeSkuKey(candidate.sku) === normalizedSku,
        ) ?? null)
      : null;

    masterProduct ??=
      masterCandidates.find(
        (candidate) =>
          candidate.normalizedName === normalizedName ||
          normalizeCatalogueName(candidate.name) === normalizedName,
      ) ?? null;
  }

  /*
   * Create the canonical master product when supplier identity is known.
   * A required supplier relation prevents creating unsafe ownerless master
   * records. In that rare case the legacy product remains usable and can be
   * linked later after supplier cleanup.
   */
  if (!masterProduct && supplierId) {
    try {
      masterProduct = await prisma.masterCatalogueProduct.create({
        data: {
          supplierId,
          name: canonicalName,
          normalizedName,
          description: description.trim() || null,
          category: "Materials",
          sku: productCode ?? null,
          productType: "MATERIAL",
          colors: [],
          sizes: [],
          stockQty: 0,
          isReturnable: false,
          isDeductible: true,
          deductionSplits: 1,
          isActive: true,
        },
        select: {
          id: true,
          supplierId: true,
          name: true,
          normalizedName: true,
          sku: true,
          legacyProcurementProduct: {
            select: {
              id: true,
              supplierId: true,
            },
          },
        },
      });
    } catch (error: any) {
      /*
       * Concurrent imports can race on @@unique([supplierId, normalizedName]).
       * Re-read the row created by the other request.
       */
      if (error?.code !== "P2002") throw error;

      masterProduct = await prisma.masterCatalogueProduct.findUnique({
        where: {
          supplierId_normalizedName: {
            supplierId,
            normalizedName,
          },
        },
        select: {
          id: true,
          supplierId: true,
          name: true,
          normalizedName: true,
          sku: true,
          legacyProcurementProduct: {
            select: {
              id: true,
              supplierId: true,
            },
          },
        },
      });
    }
  }

  /*
   * Prefer the compatibility product already connected to the master.
   */
  if (masterProduct?.legacyProcurementProduct) {
    legacyProduct = {
      id: masterProduct.legacyProcurementProduct.id,
      sku: masterProduct.sku,
      name: masterProduct.name,
      normalizedName: masterProduct.normalizedName,
      supplierId: masterProduct.legacyProcurementProduct.supplierId,
      masterCatalogueProductId: masterProduct.id,
    };
  }

  /*
   * Create the compatibility ProcurementProduct when the master exists but no
   * legacy anchor has been created yet.
   */
  if (!legacyProduct && masterProduct) {
    try {
      legacyProduct = await prisma.procurementProduct.create({
        data: {
          name: masterProduct.name,
          normalizedName: masterProduct.normalizedName,
          sku: masterProduct.sku,
          productType: "MATERIAL",
          supplierId: masterProduct.supplierId,
          masterCatalogueProductId: masterProduct.id,
        },
        select: {
          id: true,
          sku: true,
          name: true,
          normalizedName: true,
          supplierId: true,
          masterCatalogueProductId: true,
        },
      });
    } catch (error: any) {
      if (error?.code !== "P2002") throw error;

      const linked = await prisma.procurementProduct.findFirst({
        where: {
          OR: [
            {
              masterCatalogueProductId: masterProduct.id,
            },
            ...(masterProduct.sku ? [{ sku: masterProduct.sku }] : []),
          ],
        },
        select: {
          id: true,
          sku: true,
          name: true,
          normalizedName: true,
          supplierId: true,
          masterCatalogueProductId: true,
        },
      });

      if (linked) {
        legacyProduct = linked;
      }
    }
  }

  /*
   * If an old ProcurementProduct exists but is not linked, connect it to the
   * master. The unique bridge guarantees one compatibility row per master.
   */
  if (
    legacyProduct &&
    masterProduct &&
    legacyProduct.masterCatalogueProductId !== masterProduct.id
  ) {
    try {
      legacyProduct = await prisma.procurementProduct.update({
        where: { id: legacyProduct.id },
        data: {
          masterCatalogueProductId: masterProduct.id,
          normalizedName,
          supplierId: legacyProduct.supplierId ?? masterProduct.supplierId,
        },
        select: {
          id: true,
          sku: true,
          name: true,
          normalizedName: true,
          supplierId: true,
          masterCatalogueProductId: true,
        },
      });
    } catch (error: any) {
      if (error?.code !== "P2002") throw error;

      const linked = await prisma.procurementProduct.findUnique({
        where: {
          masterCatalogueProductId: masterProduct.id,
        },
        select: {
          id: true,
          sku: true,
          name: true,
          normalizedName: true,
          supplierId: true,
          masterCatalogueProductId: true,
        },
      });

      if (linked) legacyProduct = linked;
    }
  }

  /*
   * Supplier could not be resolved, so a canonical master cannot safely be
   * created. Preserve the import by falling back to the legacy anchor.
   */
  if (!legacyProduct) {
    legacyProduct = await prisma.procurementProduct.create({
      data: {
        name: canonicalName,
        normalizedName,
        productType: "MATERIAL",
        ...(productCode && !mapped ? { sku: productCode } : {}),
        ...(supplierId ? { supplierId } : {}),
      },
      select: {
        id: true,
        sku: true,
        name: true,
        normalizedName: true,
        supplierId: true,
        masterCatalogueProductId: true,
      },
    });
  } else if (!legacyProduct.supplierId && supplierId) {
    legacyProduct = await prisma.procurementProduct.update({
      where: { id: legacyProduct.id },
      data: {
        supplierId,
        normalizedName: legacyProduct.normalizedName ?? normalizedName,
      },
      select: {
        id: true,
        sku: true,
        name: true,
        normalizedName: true,
        supplierId: true,
        masterCatalogueProductId: true,
      },
    });
  }

  /*
   * Color variants remain attached to ProcurementProduct during Stage 1.
   */
  let colorVariantId: string | null = null;

  if (colorName) {
    const existing = await prisma.productColorVariant.findFirst({
      where: {
        productId: legacyProduct.id,
        colorName: {
          equals: colorName,
          mode: "insensitive",
        },
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
            productId: legacyProduct.id,
            colorName,
            baseType,
            isTinted,
          },
          select: { id: true },
        });

        colorVariantId = created.id;
      } catch {
        const raced = await prisma.productColorVariant.findFirst({
          where: {
            productId: legacyProduct.id,
            colorName: {
              equals: colorName,
              mode: "insensitive",
            },
            baseType,
          },
          select: { id: true },
        });

        colorVariantId = raced?.id ?? null;
      }
    }
  }

  return {
    productId: legacyProduct.id,
    masterCatalogueProductId:
      masterProduct?.id ?? legacyProduct.masterCatalogueProductId ?? null,
    colorVariantId,
  };
}

/** Process a single order group against the already-resolved site map. */
async function processOrderGroup(
  groupLines: ParsedMaterialLine[],
  siteMap: Map<string, string>,
  existingOrderRefs: Set<string>,
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

  if (isOrderReferenceTaken(existingOrderRefs, orderNumber)) {
    const total = groupLines.reduce((s, l) => s + parseFloat(l.totalAmount), 0);

    return {
      orderNumber,
      siteCode: first.siteCode,
      siteName: first.siteName,
      transactionDate: first.transactionDate,
      status: "DUPLICATE",
      reason: `PO ${orderNumber} already imported (PDF Orders or Historical Materials)`,
      linesCreated: 0,
      totalAmount: total.toFixed(2),
    };
  }

  try {
    const orderDate = groupLines.reduce(
      (earliest, line) =>
        line.transactionDate < earliest ? line.transactionDate : earliest,
      groupLines[0].transactionDate,
    );

    const resolvedLines: {
      productId: string;
      quantity: number;
      uomAtOrder: ProductUom | null;
      unitSizeAtOrder: number | null;
      line: ParsedMaterialLine;
    }[] = [];

    for (const line of groupLines) {
      const { productId } = await resolveProduct(line.description, orderNumber);

      const quantity =
        line.quantity && line.quantity > 0 ? Math.round(line.quantity) : 1;

      const { uomAtOrder, unitSizeAtOrder } = parseUnitToken(line.unit ?? null);

      resolvedLines.push({
        productId,
        quantity,
        uomAtOrder,
        unitSizeAtOrder,
        line,
      });
    }

    let orderSupplierId: string | null = null;

    const fromItems = await resolveSupplierForOrderItems(
      resolvedLines.map((item) => item.productId),
    );

    orderSupplierId = fromItems.supplierId;

    if (!orderSupplierId) {
      const refSupplier = await resolveSupplierForProduct({
        description: groupLines[0].description,
        orderReference: orderNumber,
      });

      orderSupplierId = refSupplier.supplierId;
    }

    const itemData = await Promise.all(
      resolvedLines.map(async (resolved) => {
        const unitPriceAtOrder = await resolveStoredUnitPrice({
          supplierId: orderSupplierId,
          productId: resolved.productId,
          uom: resolved.uomAtOrder,
          unitSize: resolved.unitSizeAtOrder,
          pdfUnitPrice: resolved.line.unitPrice,
          pdfLineTotal: resolved.line.totalAmount,
          quantity: resolved.quantity,
        });

        return {
          productId: resolved.productId,
          quantity: resolved.quantity,
          unitPriceAtOrder,
          uomAtOrder: resolved.uomAtOrder,
          unitSizeAtOrder: resolved.unitSizeAtOrder,
        };
      }),
    );

    const totalAmountDecimal = itemData.reduce(
      (sum, item) => sum.add(item.unitPriceAtOrder.mul(item.quantity)),
      new Prisma.Decimal(0),
    );

    const totalAmount = totalAmountDecimal.toFixed(2);

    const order = await prisma.siteProductOrder.create({
      data: {
        siteId,
        reference: orderNumber,
        note: "Seeded from BuildSmart historical cost report",
        createdAt: orderDate,
        totalCost: totalAmountDecimal,
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

    trackOrderReference(existingOrderRefs, orderNumber);

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
  const siteCodes = [
    ...new Set(lines.map((line) => line.siteCode).filter(Boolean)),
  ];

  const groups = new Map<string, ParsedMaterialLine[]>();

  for (const line of lines) {
    const key = `${line.siteCode}::` + `${line.orderNumber ?? "__NO_ORDER__"}`;

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
): AsyncGenerator<{
  total: number;
  done: number;
  result: MaterialOrderImportResult;
}> {
  const { siteCodes, groups } = buildGroupsAndSiteMap(lines);

  const sites = await prisma.site.findMany({
    where: {
      code: { in: siteCodes },
    },
    select: {
      id: true,
      code: true,
    },
  });

  const siteMap = new Map(sites.map((site) => [site.code!, site.id]));

  const existingOrderRefs = await loadExistingOrderReferences();

  const total = groups.size;
  let done = 0;

  for (const [, groupLines] of groups) {
    const result = await processOrderGroup(
      groupLines,
      siteMap,
      existingOrderRefs,
    );

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
