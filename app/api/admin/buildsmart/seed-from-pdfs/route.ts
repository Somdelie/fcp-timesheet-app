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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILES = 50;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per file

export async function POST(req: NextRequest) {
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
  const parsedOrders: ParsedOrder[] = [];

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
    const buffer = Buffer.from(arrayBuffer);

    const parsed = await parsePdfBuffer(buffer);
    if (parsed) {
      parsedOrders.push(parsed);
    }
  }

  // ── Load all products with suppliers for matching ──
  const allProducts = await prisma.procurementProduct.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      sku: true,
      uom: true,
      unitSize: true,
      supplierId: true,
      supplier: { select: { id: true, name: true } },
    },
  });

  // Build a SKU → product lookup
  const skuLookup = new Map<string, (typeof allProducts)[number]>();
  for (const p of allProducts) {
    if (p.sku) skuLookup.set(p.sku, p);
  }

  // ── Name-based fallback matching ──
  type Product = (typeof allProducts)[number];

  function tokenize(text: string): Set<string> {
    return new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 0),
    );
  }

  function findProductByName(
    rawDesc: string,
    unit: string,
  ): Product | undefined {
    // Strip product code prefix (e.g. "PP 00070020L", "5147607", "TLS001000")
    const descOnly = rawDesc
      .replace(/^[A-Z]{2,4}\s*[\d\s]+(?:[A-Z]{1,3})?\s*/i, "")
      .trim();

    if (!descOnly) return undefined;

    // Build search tokens from description + unit
    const searchText = unit ? `${descOnly} ${unit}` : descOnly;
    const searchTokens = tokenize(searchText);

    if (searchTokens.size < 2) return undefined;

    let bestProduct: Product | undefined;
    let bestScore = 0;

    for (const p of allProducts) {
      const nameTokens = tokenize(p.name);

      let matchCount = 0;
      for (const t of searchTokens) {
        if (nameTokens.has(t)) matchCount++;
      }

      // Score: proportion of search tokens found in product name
      const score = matchCount / searchTokens.size;

      // Require at least 60% overlap and min 2 matching tokens
      if (score > bestScore && score >= 0.6 && matchCount >= 2) {
        bestScore = score;
        bestProduct = p;
      }
    }

    return bestProduct;
  }

  // ── Match parsed items to DB products and build seed orders ──
  const siteProductOrders: SeedOrder[] = [];
  const skippedOrderNumbers: string[] = [];
  const skipReasons: Record<string, string[]> = {};

  for (const order of parsedOrders) {
    const reasons: string[] = [];
    const matchedItems: SeedOrderItem[] = [];
    const unmatchedDescs: string[] = [];
    let resolvedSupplierId: string | null = null;

    for (const item of order.items) {
      // 1) Try exact SKU match (Plascon-style codes)
      let product = item.candidateSku
        ? skuLookup.get(item.candidateSku)
        : undefined;

      // 2) Fallback: name-based fuzzy match (Dulux & others)
      if (!product) {
        product = findProductByName(item.rawDescription, item.unit);
      }

      if (product) {
        if (!resolvedSupplierId && product.supplierId) {
          resolvedSupplierId = product.supplierId;
        }

        matchedItems.push({
          sku: product.sku!,
          quantity: item.quantity,
          unitPriceAtOrder: null,
          uomAtOrder: product.uom ?? "UNIT",
          unitSizeAtOrder: product.unitSize?.toString() ?? "1.000",
          note: item.rawDescription,
        });
      } else {
        unmatchedDescs.push(
          item.candidateSku
            ? `"${item.rawDescription}" (tried SKU: ${item.candidateSku})`
            : `"${item.rawDescription}"`,
        );
      }
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

    if (!resolvedSupplierId || matchedItems.length === 0) {
      skippedOrderNumbers.push(order.orderNumber);
      skipReasons[order.orderNumber] = reasons;
      continue;
    }

    siteProductOrders.push({
      reference: order.orderNumber,
      supplierId: resolvedSupplierId,
      siteCode: order.siteCode ?? "",
      createdAt: order.createdDate
        ? new Date(order.createdDate).toISOString()
        : new Date().toISOString(),
      note: `Imported from BuildSmart PO ${order.orderNumber}`,
      items: matchedItems,
    });

    // Still report unmatched items as warnings
    if (unmatchedDescs.length > 0) {
      skipReasons[order.orderNumber] = [
        `Partial: ${unmatchedDescs.length} unmatched items: ${unmatchedDescs.join(", ")}`,
      ];
    }
  }

  const prismaSeedCode = generatePrismaSeedCode(siteProductOrders);

  return NextResponse.json({
    summary: {
      totalFiles: pdfFiles.length,
      queuedOrders: parsedOrders.length,
      seededOrders: siteProductOrders.length,
      skippedOrders: skippedOrderNumbers.length,
    },
    orders: siteProductOrders,
    skippedOrderNumbers,
    skipReasons,
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
          const p =
            (i.candidateSku ? skuLookup.get(i.candidateSku) : undefined) ??
            findProductByName(i.rawDescription, i.unit);
          return p ? { name: p.name, sku: p.sku } : null;
        })(),
      })),
    })),
    prismaSeedCode,
  });
}
