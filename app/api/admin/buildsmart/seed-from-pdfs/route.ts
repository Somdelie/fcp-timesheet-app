import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  parsePdfBuffer,
  generatePrismaSeedCode,
} from "@/lib/buildsmart-parser";
import type {
  ParsedOrder,
  SeedOrder,
  SeedOrderItem,
} from "@/lib/buildsmart-parser";
import { resolveUnitPrice } from "@/lib/procurement/resolveUnitPrice";
import { recalcOrderTotal } from "@/lib/procurement/recalcOrderTotal";
import {
  normalizeSupplierName,
  mapDescriptionToProduct,
} from "@/lib/buildsmart-import-mappings";
import {
  matchBuildSmartProduct,
  normalizeImportedProductName,
  shouldCreateNewProduct,
} from "@/lib/procurement/buildsmartProductMatcher";
import {
  inferBuildSmartProductCode,
  isNumericCostCode,
  normalizeSkuKey,
} from "@/lib/procurement/buildsmartProductCodes";
import { parseBuildSmartProduct } from "@/lib/product-color-parser";
import { matchStockProduct } from "@/lib/stock/stockProductMatcher";
import {
  isOrderReferenceTaken,
  loadExistingOrderReferences,
  trackOrderReference,
} from "@/lib/procurement/buildsmartOrderDedup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_FILES = 50;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per file

export async function POST(req: NextRequest) {
  try {
    return await seedFromPdfs(req);
  } catch (err) {
    console.error("BuildSmart PDF Orders import failed", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "BuildSmart PDF Orders import failed",
      },
      { status: 500 },
    );
  }
}

async function seedFromPdfs(req: NextRequest) {
  // Auth: require ADMIN or OFFICE role
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;

  if (!session || !role || !["ADMIN", "OFFICE"].includes(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const pdfFiles = formData.getAll("pdfs");

  if (!pdfFiles.length) {
    return NextResponse.json(
      { error: "No PDF files provided" },
      { status: 400 },
    );
  }

  if (pdfFiles.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Too many files (max ${MAX_FILES})` },
      { status: 400 },
    );
  }

  // ── Parse all PDFs ──
  const parsedOrders: (ParsedOrder & { sourceFileName: string })[] = [];
  const parseFailures: { fileName: string; orderNumber: string | null; reason: string }[] =
    [];

  for (const entry of pdfFiles) {
    if (!(entry instanceof File)) continue;

    if (entry.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File "${entry.name}" exceeds 10 MB limit` },
        { status: 400 },
      );
    }

    if (
      entry.type !== "application/pdf" &&
      !entry.name.toLowerCase().endsWith(".pdf")
    ) {
      continue;
    }

    const arrayBuffer = await entry.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      parseFailures.push({
        fileName: entry.name,
        orderNumber: entry.name.match(/(\d{4,})/)?.[1] ?? null,
        reason: "Empty PDF file",
      });
      continue;
    }
    const buffer = Buffer.from(arrayBuffer);

    const parsed = await parsePdfBuffer(buffer);
    if (parsed) {
      parsedOrders.push({ ...parsed, sourceFileName: entry.name });
    } else {
      parseFailures.push({
        fileName: entry.name,
        orderNumber: entry.name.match(/(\d{4,})/)?.[1] ?? null,
        reason: "Could not read PDF text or extract order number",
      });
    }
  }

  // ── Load all products with suppliers for matching ──
  const allProducts = await prisma.procurementProduct.findMany({
    where: { isActive: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      normalizedName: true,
      sku: true,
      description: true,
      uom: true,
      unitSize: true,
      supplierId: true,
      supplier: { select: { id: true, name: true } },
    },
  });

  // Build a SKU → product lookup
  const skuLookup = new Map<string, (typeof allProducts)[number]>();
  for (const p of allProducts) {
    if (p.sku) skuLookup.set(normalizeSkuKey(p.sku), p);
  }

  // Build a supplier name → id lookup (case-insensitive) for normalized matching
  const allSuppliers = await prisma.supplier.findMany({
    select: { id: true, name: true },
  });
  const supplierNameLookup = new Map<string, string>();
  for (const s of allSuppliers) {
    supplierNameLookup.set(s.name.toLowerCase(), s.id);
  }

  type Product = (typeof allProducts)[number];

  function findMatchedProduct(
    rawDescription: string,
    options?: {
      supplierName?: string | null;
      mappedCanonicalName?: string | null;
      trustedCode?: string | null;
    },
  ) {
    return matchBuildSmartProduct(
      {
        rawDescription,
        supplierName: options?.supplierName ?? null,
        mappedCanonicalName: options?.mappedCanonicalName ?? null,
        trustedCode: options?.trustedCode ?? null,
      },
      allProducts as Product[],
    );
  }

  function deriveOrderUnit(unit: string | null | undefined): {
    uom: string | null;
    unitSize: number | null;
  } {
    const raw = String(unit ?? "").trim();
    const unitMatch = raw.match(/(\d+(?:\.\d+)?)([A-Za-z]+)/);
    if (unitMatch) {
      const unitSize = Number(unitMatch[1]);
      const code = unitMatch[2].toUpperCase();
      return {
        unitSize: Number.isFinite(unitSize) ? unitSize : null,
        uom: code === "L" || code === "KG" ? code : "UNIT",
      };
    }
    if (/each/i.test(raw)) {
      return { uom: "EACH", unitSize: 1 };
    }
    return { uom: null, unitSize: null };
  }

  // ── Load sites for siteCode → siteId resolution ──
  const allSites = await prisma.site.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true },
  });
  const siteCodeLookup = new Map<string, string>();
  for (const s of allSites) {
    if (s.code) siteCodeLookup.set(s.code, s.id);
  }

  // ── Separate STOCK orders from site product orders ──
  const isStockOrder = (o: ParsedOrder) =>
    o.subject?.toUpperCase().startsWith("STOCK") ?? false;

  const stockParsed = parsedOrders.filter(isStockOrder);
  const siteParsed = parsedOrders.filter((o) => !isStockOrder(o));

  // ── Process STOCK orders → ProductOrder + ProductOrderItem ──
  type StockOrderResult = {
    orderNumber: string;
    foremanName: string | null;
    createdAt: string;
    itemsCreated: number;
    status: "created" | "skipped" | "duplicate";
    reason?: string;
  };

  const stockResults: StockOrderResult[] = [];

  if (stockParsed.length > 0) {
    const legacyProducts = await prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        normalizedName: true,
        sku: true,
        category: true,
        price: true,
      },
    });

    const allForemen = await prisma.foreman.findMany({
      include: { user: { select: { id: true, name: true } } },
    });

    function suggestForemanId(hint: string | null): string | null {
      if (!hint) return null;
      const h = hint
        .toLowerCase()
        .replace(/[^a-z\s]/g, " ")
        .trim();
      const hTokens = h.split(" ").filter((t) => t.length > 1);
      let best: { id: string; score: number } | null = null;
      for (const f of allForemen) {
        const n = (f.user?.name ?? "")
          .toLowerCase()
          .replace(/[^a-z\s]/g, " ")
          .trim();
        if (!n) continue;
        if (n === h) return f.id;
        const nTokens = n.split(" ").filter((t) => t.length > 1);
        const setN = new Set(nTokens);
        const common = hTokens.filter((t) => setN.has(t));
        const union = new Set([...hTokens, ...nTokens]);
        const score = union.size === 0 ? 0 : common.length / union.size;
        if (score > 0 && (!best || score > best.score))
          best = { id: f.id, score };
      }
      return best && best.score >= 0.4 ? best.id : null;
    }

    for (const order of stockParsed) {
      const foremanId = suggestForemanId(order.foremanNameHint);
      const foremanRecord = allForemen.find((f) => f.id === foremanId);
      const foremanName =
        foremanRecord?.user?.name ?? order.foremanNameHint ?? null;

      if (!foremanId) {
        stockResults.push({
          orderNumber: order.orderNumber,
          foremanName,
          createdAt: order.createdDate ?? new Date().toISOString(),
          itemsCreated: 0,
          status: "skipped",
          reason: `No foreman matched for "${order.foremanNameHint ?? "unknown"}"`,
        });
        continue;
      }

      // Check duplicate
      const existing = await prisma.productOrder.findFirst({
        where: {
          foreman: { id: foremanId },
          createdAt: order.createdDate
            ? {
                gte: new Date(order.createdDate + "T00:00:00Z"),
                lte: new Date(order.createdDate + "T23:59:59Z"),
              }
            : undefined,
        },
        select: { id: true },
      });
      if (existing) {
        stockResults.push({
          orderNumber: order.orderNumber,
          foremanName,
          createdAt: order.createdDate ?? new Date().toISOString(),
          itemsCreated: 0,
          status: "duplicate",
        });
        continue;
      }

      const matchedItems: { productId: string; quantity: number }[] = [];
      for (const item of order.items) {
        const match = matchStockProduct(item.rawDescription, legacyProducts);
        if (match.matched && match.product) {
          matchedItems.push({
            productId: match.product.id,
            quantity: item.quantity,
          });
        }
      }

      if (matchedItems.length === 0) {
        stockResults.push({
          orderNumber: order.orderNumber,
          foremanName,
          createdAt: order.createdDate ?? new Date().toISOString(),
          itemsCreated: 0,
          status: "skipped",
          reason: "No products matched",
        });
        continue;
      }

      const adminUserId = (session!.user as any).id as string;
      await prisma.productOrder.create({
        data: {
          foreman: { connect: { id: foremanId } },
          createdByUser: { connect: { id: adminUserId } },
          status: "PENDING",
          ...(order.createdDate
            ? { createdAt: new Date(order.createdDate) }
            : {}),
          items: {
            create: matchedItems.map((m) => {
              const p = legacyProducts.find((lp) => lp.id === m.productId);
              return {
                product: { connect: { id: m.productId } },
                quantity: m.quantity,
                unitPrice: p?.price ?? 0,
              };
            }),
          },
        },
        select: { id: true },
      });

      stockResults.push({
        orderNumber: order.orderNumber,
        foremanName,
        createdAt: order.createdDate ?? new Date().toISOString(),
        itemsCreated: matchedItems.length,
        status: "created",
      });
    }
  }

  // ── Match parsed items to DB products and build seed orders ──
  type MatchedItem = SeedOrderItem & { productId: string };
  type MatchedOrder = SeedOrder & {
    siteId: string | null;
    matchedItems: MatchedItem[];
  };

  const matchedOrders: MatchedOrder[] = [];
  const siteProductOrders: SeedOrder[] = [];
  const skippedOrderNumbers: string[] = [];
  const skipReasons: Record<string, string[]> = {};
  const duplicateRefs: string[] = [];
  const existingOrderRefs = await loadExistingOrderReferences();

  for (const order of siteParsed) {
    if (isOrderReferenceTaken(existingOrderRefs, order.orderNumber)) {
      duplicateRefs.push(order.orderNumber);
      skipReasons[order.orderNumber] = [
        "PO already imported (PDF Orders or Historical Materials)",
      ];
      continue;
    }

    const reasons: string[] = [];
    const matchedItems: MatchedItem[] = [];
    const unmatchedItems: typeof order.items = [];
    const unmatchedDescs: string[] = [];
    let resolvedSupplierId: string | null = null;

    for (const item of order.items) {
      const mappedCanonicalName = mapDescriptionToProduct(item.rawDescription);
      const match = findMatchedProduct(item.rawDescription, {
        supplierName: order.vendorName ?? null,
        mappedCanonicalName,
        trustedCode:
          item.candidateSku ?? inferBuildSmartProductCode(item.rawDescription, item.unit),
      });
      const product = match.matched ? (match.product as Product) : undefined;

      if (product) {
        const orderUnit = deriveOrderUnit(item.unit);
        matchedItems.push({
          productId: product.id,
          sku: product.sku ?? "",
          quantity: item.quantity,
          unitPriceAtOrder: null,
          uomAtOrder: (orderUnit.uom as any) ?? product.uom ?? "UNIT",
          unitSizeAtOrder:
            orderUnit.unitSize != null
              ? String(orderUnit.unitSize)
              : product.unitSize?.toString() ?? "1.000",
          note: item.rawDescription,
        });
      } else {
        unmatchedItems.push(item);
      }
    }

    // If we still don't have a supplier, fall back to the vendor name on the PDF
    // with normalization to match known aliases.
    if (!resolvedSupplierId && order.vendorName) {
      const normalizedName = normalizeSupplierName(order.vendorName);

      // Try normalized name first (case-insensitive), then original
      const supplierId =
        supplierNameLookup.get(normalizedName.toLowerCase()) ??
        supplierNameLookup.get(order.vendorName.trim().toLowerCase());

      if (supplierId) {
        resolvedSupplierId = supplierId;
      } else {
        // Exact DB lookup as final attempt before creating
        const existingSupplier = await prisma.supplier.findFirst({
          where: {
            name: {
              in: [normalizedName, order.vendorName.trim()],
              mode: "insensitive",
            },
          },
          select: { id: true },
        });

        if (existingSupplier) {
          resolvedSupplierId = existingSupplier.id;
        } else {
          const createdSupplier = await prisma.supplier.create({
            data: {
              name: normalizedName,
            },
          });
          resolvedSupplierId = createdSupplier.id;
          // Keep in-memory lookup in sync
          supplierNameLookup.set(
            normalizedName.toLowerCase(),
            createdSupplier.id,
          );
        }
      }
    }

    // Auto-create missing products for unmatched items so the order can still be
    // imported end-to-end.
    for (const item of unmatchedItems) {
      if (!resolvedSupplierId) {
        unmatchedDescs.push(
          item.candidateSku
            ? `"${item.rawDescription}" (tried SKU: ${item.candidateSku})`
            : `"${item.rawDescription}"`,
        );
        continue;
      }

      const { uom: derivedUom, unitSize: derivedUnitSize } = deriveOrderUnit(
        item.unit,
      );

      const parsedProduct = parseBuildSmartProduct(item.rawDescription.trim());
      const name =
        parsedProduct.cleanName ||
        item.rawDescription.trim() ||
        `BuildSmart item ${item.costCode}`;
      const sku =
        item.candidateSku ??
        parsedProduct.sku ??
        inferBuildSmartProductCode(item.rawDescription, item.unit);
      const mappedCanonicalName = mapDescriptionToProduct(item.rawDescription);

      let product: Product | undefined;
      const match = findMatchedProduct(name, {
        supplierName: order.vendorName ?? null,
        mappedCanonicalName,
        trustedCode: sku && !isNumericCostCode(sku) ? sku : null,
      });

      if (match.matched) {
        product = match.product as Product;
      }

      if (!product) {
        if (!shouldCreateNewProduct(match)) {
          unmatchedDescs.push(`${match.reason}: "${item.rawDescription}"`);
          continue;
        }

        if (!resolvedSupplierId) {
          unmatchedDescs.push(
            `No supplier resolved for new shop item: "${item.rawDescription}"`,
          );
          continue;
        }

        if (!product) {
          product = await prisma.procurementProduct.create({
            data: {
              name,
              normalizedName: normalizeImportedProductName(name).toLowerCase(),
              sku: sku && !isNumericCostCode(sku) ? sku : null,
              description: `BuildSmart import (PO ${order.orderNumber})`,
              supplier: { connect: { id: resolvedSupplierId } },
            },
            select: {
              id: true,
              name: true,
              normalizedName: true,
              sku: true,
              description: true,
              uom: true,
              unitSize: true,
              supplierId: true,
              supplier: { select: { id: true, name: true } },
            },
          });

          // Keep in-memory lookups in sync so subsequent items can match this product
          allProducts.push(product as any);
          if (sku && !isNumericCostCode(sku)) {
            skuLookup.set(normalizeSkuKey(sku), product as any);
          }
        }
      }

      matchedItems.push({
        productId: product.id,
        sku: product.sku ?? "",
        quantity: item.quantity,
        unitPriceAtOrder: null,
        uomAtOrder: (derivedUom as any) ?? product.uom ?? "UNIT",
        unitSizeAtOrder:
          derivedUnitSize != null
            ? String(derivedUnitSize)
            : product.unitSize != null
              ? String(product.unitSize)
              : "1",
        note: item.rawDescription,
      });
    }

    // Resolve siteId from siteCode — auto-create if the contract line gave us
    // a code and a name but no matching site exists yet.
    let siteId = order.siteCode
      ? (siteCodeLookup.get(order.siteCode) ?? null)
      : null;

    if (!siteId && order.siteCode && order.siteName) {
      // Try case-insensitive name match as fallback
      const existingSite = await prisma.site.findFirst({
        where: { name: { equals: order.siteName, mode: "insensitive" } },
        select: { id: true },
      });

      if (existingSite) {
        siteId = existingSite.id;
        siteCodeLookup.set(order.siteCode, existingSite.id);
      } else {
        // Auto-create the site from Contract info
        const created = await prisma.site.create({
          data: {
            code: order.siteCode,
            name: order.siteName.toUpperCase(),
            isActive: true,
          },
          select: { id: true },
        });
        siteId = created.id;
        siteCodeLookup.set(order.siteCode, created.id);
      }
    }

    if (!siteId) {
      reasons.push(
        order.siteCode
          ? `No matching site for code "${order.siteCode}".`
          : `No Contract line found — Balance Sheet / stock order with no site assignment.`,
      );
    }

    if (!resolvedSupplierId) {
      reasons.push(
        `No supplier resolved (vendor from PDF: ${order.vendorName ?? "unknown"})`,
      );
    }

    if (matchedItems.length === 0) {
      reasons.push("No matched products");
    }

    if (unmatchedDescs.length > 0) {
      reasons.push(`Unmatched items: ${unmatchedDescs.join(", ")}`);
    }

    if (!resolvedSupplierId || matchedItems.length === 0 || !siteId) {
      skippedOrderNumbers.push(order.orderNumber);
      skipReasons[order.orderNumber] = reasons;
      continue;
    }

    const seedOrder: SeedOrder = {
      reference: order.orderNumber,
      supplierId: resolvedSupplierId,
      siteCode: order.siteCode ?? "",
      createdAt: order.createdDate
        ? new Date(order.createdDate).toISOString()
        : new Date().toISOString(),
      note: `Imported from BuildSmart PO ${order.orderNumber}`,
      items: matchedItems,
    };
    siteProductOrders.push(seedOrder);
    matchedOrders.push({ ...seedOrder, siteId, matchedItems });

    // Still report unmatched items as warnings
    if (unmatchedDescs.length > 0) {
      skipReasons[order.orderNumber] = [
        `Partial: ${unmatchedDescs.length} unmatched items: ${unmatchedDescs.join(", ")}`,
      ];
    }
  }

  // ── Persist matched orders to the database ──
  const savedOrderIds: string[] = [];

  for (const mo of matchedOrders) {
    if (isOrderReferenceTaken(existingOrderRefs, mo.reference)) {
      duplicateRefs.push(mo.reference);
      continue;
    }

    // Resolve unit prices from SupplierProductPrice table.
    // First try an exact (uom + unitSize) match; if that yields 0, fall back
    // to a more general lookup for the product/supplier only.
    const itemsWithPrices = await Promise.all(
      mo.matchedItems.map(async (mi) => {
        let price = await resolveUnitPrice({
          manualPrice: mi.unitPriceAtOrder,
          supplierId: mo.supplierId,
          productId: mi.productId,
          uom: mi.uomAtOrder,
          unitSize: mi.unitSizeAtOrder
            ? parseFloat(mi.unitSizeAtOrder)
            : undefined,
        });

        // If no specific price found, try without size filters
        if ((price as any).isZero?.()) {
          price = await resolveUnitPrice({
            manualPrice: null,
            supplierId: mo.supplierId,
            productId: mi.productId,
          });
        }

        return { ...mi, resolvedPrice: price };
      }),
    );

    const created = await prisma.siteProductOrder.create({
      data: {
        siteId: mo.siteId!,
        supplierId: mo.supplierId,
        reference: mo.reference,
        note: mo.note,
        createdAt: new Date(mo.createdAt),
        items: {
          create: itemsWithPrices.map((mi) => ({
            productId: mi.productId,
            quantity: mi.quantity,
            unitPriceAtOrder: mi.resolvedPrice,
            uomAtOrder: mi.uomAtOrder as any,
            unitSizeAtOrder: mi.unitSizeAtOrder
              ? parseFloat(mi.unitSizeAtOrder)
              : undefined,
            note: mi.note,
          })),
        },
      },
    });

    // Recalculate and persist the order total
    await recalcOrderTotal(created.id);

    trackOrderReference(existingOrderRefs, mo.reference);
    savedOrderIds.push(created.id);
  }

  const prismaSeedCode = generatePrismaSeedCode(siteProductOrders);

  return NextResponse.json({
    summary: {
      totalFiles: pdfFiles.length,
      parsedOrders: parsedOrders.length,
      parseFailures: parseFailures.length,
      queuedOrders: parsedOrders.length,
      seededOrders: siteProductOrders.length,
      savedToDb: savedOrderIds.length,
      duplicates: duplicateRefs.length,
      skippedOrders: skippedOrderNumbers.length,
      stockOrdersDetected: stockParsed.length,
      stockOrdersCreated: stockResults.filter((r) => r.status === "created")
        .length,
    },
    orders: siteProductOrders,
    stockOrders: stockResults,
    savedOrderIds,
    duplicateRefs,
    skippedOrderNumbers,
    skipReasons,
    parseFailures,
    debug: parsedOrders.map((o) => ({
      orderNumber: o.orderNumber,
      vendorName: o.vendorName,
      vendorCode: o.vendorCode,
      siteCode: o.siteCode,
      siteName: o.siteName,
      createdDate: o.createdDate,
      items: o.items.map((i) => ({
        costCode: i.costCode,
        productCode: i.productCode,
        raw: i.rawDescription.slice(0, 200),
        unit: i.unit,
        quantity: i.quantity,
        candidateSku: i.candidateSku,
        matchedProduct: (() => {
          const mappedCanonicalName = mapDescriptionToProduct(i.rawDescription);
          const match = findMatchedProduct(i.rawDescription, {
            supplierName: o.vendorName ?? null,
            mappedCanonicalName,
            trustedCode:
              i.candidateSku ?? inferBuildSmartProductCode(i.rawDescription, i.unit),
          });
          const product = match.matched ? (match.product as Product) : null;
          return product
            ? { name: product.name, sku: product.sku, reason: match.reason }
            : null;
        })(),
      })),
    })),
    prismaSeedCode,
  });
}
