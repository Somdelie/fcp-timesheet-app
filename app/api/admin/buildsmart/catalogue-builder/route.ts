import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { parseCostReportBuffers } from "@/lib/buildsmart-cost-parser";
import { parseUnitToken } from "@/lib/buildsmart-import-mappings";
import { parseBuildSmartProduct } from "@/lib/product-color-parser";
import {
  inferBrandHintFromDescription,
  inferSupplierNameFromDescription,
} from "@/lib/procurement/inferSupplierFromDescription";
import { prisma } from "@/lib/prisma";
import { Prisma, type ColorBaseType, type ProductUom } from "@/generated/prisma/client";

import type { ParsedMaterialLine } from "@/lib/buildsmart-cost-parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_FILES = 20;
const MAX_FILE_SIZE = 20 * 1024 * 1024;

type CatalogueLine = ParsedMaterialLine & {
  fileName: string;
};

type CatalogueCounts = {
  suppliersCreated: number;
  suppliersUpdated: number;
  materialsCreated: number;
  materialsUpdated: number;
  basesCreated: number;
  coloursCreated: number;
  sizesCreated: number;
  pricesCreated: number;
  pricesUpdated: number;
  duplicatePrices: number;
  skippedRows: number;
};

const BRAND_FALLBACK_SUPPLIERS: Record<string, string> = {
  dulux: "Dulux",
  plascon: "Plascon",
  prominent: "Prominent Paints",
  timberlife: "TimberLife",
  soudal: "Soudal",
  marmoran: "Marmoran",
  urochem: "Urochem Trading (Pty) Ltd",
  cemcrete: "Cemcrete",
  diy_consumables: "DIY Savoy Consumables",
};

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKey(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function normalizeMoney(value: unknown): string {
  const parsed = Number(
    String(value ?? "")
      .replace(/[R,\s]/gi, "")
      .trim(),
  );

  return Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00";
}

function calculateUnitPrice(line: CatalogueLine): string {
  const explicitUnitPrice = Number(normalizeMoney(line.unitPrice));
  if (Number.isFinite(explicitUnitPrice) && explicitUnitPrice > 0) {
    return explicitUnitPrice.toFixed(2);
  }

  const total = Number(normalizeMoney(line.totalAmount));
  const quantity = line.quantity && line.quantity > 0 ? line.quantity : 1;

  return Number.isFinite(total) && total > 0
    ? (total / quantity).toFixed(2)
    : "0.00";
}

function baseDisplayName(baseType: ColorBaseType): string {
  return baseType
    .toLowerCase()
    .replace(/^\w/, (char) => char.toUpperCase());
}

function createCounts(): CatalogueCounts {
  return {
    suppliersCreated: 0,
    suppliersUpdated: 0,
    materialsCreated: 0,
    materialsUpdated: 0,
    basesCreated: 0,
    coloursCreated: 0,
    sizesCreated: 0,
    pricesCreated: 0,
    pricesUpdated: 0,
    duplicatePrices: 0,
    skippedRows: 0,
  };
}

function createLineFingerprint(line: CatalogueLine): string {
  return [
    line.fileName,
    normalizeText(line.orderNumber),
    normalizeText(line.batchRef),
    line.transactionDate.toISOString().slice(0, 10),
    normalizeText(line.description).toLowerCase(),
    line.quantity ?? "",
    normalizeText(line.unit).toLowerCase(),
    normalizeMoney(line.totalAmount),
  ].join("::");
}

function deduplicateLines(lines: CatalogueLine[]) {
  const seen = new Set<string>();
  const uniqueLines: CatalogueLine[] = [];
  let duplicateCount = 0;

  for (const line of lines) {
    const key = createLineFingerprint(line);
    if (seen.has(key)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(key);
    uniqueLines.push(line);
  }

  return { lines: uniqueLines, duplicateCount };
}

async function loadSupplierNames() {
  const suppliers = await prisma.supplier.findMany({
    select: { name: true },
    orderBy: { name: "asc" },
  });

  return suppliers.map((supplier) => supplier.name);
}

async function resolveSupplierName(
  line: CatalogueLine,
  supplierNames: string[],
  sku: string | null,
) {
  const inferred = inferSupplierNameFromDescription(
    line.description,
    supplierNames,
    sku,
  );

  if (inferred) return inferred;

  const brandHint = inferBrandHintFromDescription(line.description);
  if (brandHint && BRAND_FALLBACK_SUPPLIERS[brandHint]) {
    return BRAND_FALLBACK_SUPPLIERS[brandHint];
  }

  return null;
}

async function findOrCreateSupplier(
  name: string,
  counts: CatalogueCounts,
) {
  const normalizedName = normalizeKey(name);
  const existing = await prisma.supplier.findFirst({
    where: {
      OR: [
        { name: { equals: name, mode: "insensitive" } },
        { normalizedName },
      ],
    },
    select: { id: true, isActive: true, normalizedName: true },
  });

  if (existing) {
    if (!existing.isActive || existing.normalizedName !== normalizedName) {
      await prisma.supplier.update({
        where: { id: existing.id },
        data: { isActive: true, normalizedName },
      });
      counts.suppliersUpdated += 1;
    }
    return existing.id;
  }

  const created = await prisma.supplier.create({
    data: {
      name,
      normalizedName,
      supplierType: "VENDOR",
      isActive: true,
    },
    select: { id: true },
  });

  counts.suppliersCreated += 1;
  return created.id;
}

async function findOrCreateMaterial(input: {
  name: string;
  sku: string | null;
  supplierId: string;
  counts: CatalogueCounts;
}) {
  const { name, sku, supplierId, counts } = input;
  const existing = await prisma.material.findFirst({
    where: {
      OR: [
        { name: { equals: name, mode: "insensitive" } },
        ...(sku ? [{ sku }] : []),
      ],
    },
    select: { id: true, supplierId: true, sku: true, isActive: true },
  });

  if (existing) {
    const data: {
      supplierId?: string;
      sku?: string;
      isActive?: boolean;
    } = {};

    if (!existing.supplierId) data.supplierId = supplierId;
    if (!existing.sku && sku) data.sku = sku;
    if (!existing.isActive) data.isActive = true;

    if (Object.keys(data).length > 0) {
      await prisma.material.update({
        where: { id: existing.id },
        data,
      });
      counts.materialsUpdated += 1;
    }

    return existing.id;
  }

  const created = await prisma.material.create({
    data: {
      name,
      sku,
      supplierId,
      productType: "MATERIAL",
      isActive: true,
    },
    select: { id: true },
  });

  counts.materialsCreated += 1;
  return created.id;
}

async function findOrCreateBase(input: {
  materialId: string;
  baseType: ColorBaseType;
  counts: CatalogueCounts;
}) {
  const name = baseDisplayName(input.baseType);
  const existing = await prisma.materialBase.findUnique({
    where: {
      materialId_name: {
        materialId: input.materialId,
        name,
      },
    },
    select: { id: true },
  });

  if (existing) return existing.id;

  const created = await prisma.materialBase.create({
    data: {
      materialId: input.materialId,
      name,
    },
    select: { id: true },
  });

  input.counts.basesCreated += 1;
  return created.id;
}

async function findOrCreateColour(input: {
  materialId: string;
  baseId: string;
  colorName: string | null;
  colorCode?: string | null;
  baseType: ColorBaseType;
  isTinted: boolean;
  counts: CatalogueCounts;
}) {
  const colorName = normalizeText(input.colorName);
  if (!colorName) return null;

  const existing = await prisma.materialColorVariant.findFirst({
    where: {
      materialId: input.materialId,
      colorName: { equals: colorName, mode: "insensitive" },
      OR: [{ baseId: input.baseId }, { baseId: null, baseType: input.baseType }],
    },
    select: { id: true, baseId: true },
  });

  if (existing) {
    if (!existing.baseId) {
      await prisma.materialColorVariant.update({
        where: { id: existing.id },
        data: { baseId: input.baseId },
      });
    }

    return existing.id;
  }

  const created = await prisma.materialColorVariant.create({
    data: {
      materialId: input.materialId,
      baseId: input.baseId,
      colorName,
      colorCode: input.colorCode ?? null,
      baseType: input.baseType,
      isTinted: input.isTinted,
    },
    select: { id: true },
  });

  input.counts.coloursCreated += 1;
  return created.id;
}

async function upsertMaterialPrice(input: {
  supplierId: string;
  materialId: string;
  baseId: string | null;
  unitSize: number | null;
  uom: ProductUom | null;
  price: string;
  sourcePdf: string;
  sku: string | null;
  counts: CatalogueCounts;
}) {
  const price = new Prisma.Decimal(input.price);
  const unitSize =
    input.unitSize !== null ? new Prisma.Decimal(input.unitSize) : null;

  const existing = await prisma.materialPrice.findFirst({
    where: {
      supplierId: input.supplierId,
      materialId: input.materialId,
      baseId: input.baseId,
      uom: input.uom,
      unitSize,
      isActive: true,
    },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true, price: true },
  });

  if (!existing) {
    const created = await prisma.materialPrice.create({
      data: {
        supplierId: input.supplierId,
        materialId: input.materialId,
        baseId: input.baseId,
        unitSize,
        uom: input.uom,
        price,
        sourcePdf: input.sourcePdf,
        sku: input.sku,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        startsOn: new Date(),
        isActive: true,
      },
      select: { id: true },
    });

    await prisma.materialPriceHistory.create({
      data: {
        materialPriceId: created.id,
        supplierId: input.supplierId,
        materialId: input.materialId,
        baseId: input.baseId,
        unitSize,
        uom: input.uom,
        oldPrice: null,
        newPrice: price,
        sourcePdf: input.sourcePdf,
      },
    });

    input.counts.pricesCreated += 1;
    return;
  }

  if (existing.price.equals(price)) {
    await prisma.materialPrice.update({
      where: { id: existing.id },
      data: {
        lastSeenAt: new Date(),
        sourcePdf: input.sourcePdf,
        sku: input.sku,
      },
    });
    input.counts.duplicatePrices += 1;
    return;
  }

  await prisma.materialPrice.update({
    where: { id: existing.id },
    data: {
      price,
      lastSeenAt: new Date(),
      sourcePdf: input.sourcePdf,
      sku: input.sku,
    },
  });

  await prisma.materialPriceHistory.create({
    data: {
      materialPriceId: existing.id,
      supplierId: input.supplierId,
      materialId: input.materialId,
      baseId: input.baseId,
      unitSize,
      uom: input.uom,
      oldPrice: existing.price,
      newPrice: price,
      sourcePdf: input.sourcePdf,
    },
  });

  input.counts.pricesUpdated += 1;
}

async function processCatalogueLines(lines: CatalogueLine[]) {
  const counts = createCounts();
  const warnings: string[] = [];
  const supplierNames = await loadSupplierNames();
  const sizeKeys = new Set<string>();

  for (const line of lines) {
    const parsed = parseBuildSmartProduct(line.description);
    const materialName = normalizeText(parsed.cleanName);
    const price = calculateUnitPrice(line);

    if (!materialName || Number(price) <= 0) {
      counts.skippedRows += 1;
      warnings.push(
        `[${line.fileName}] Unknown product or price: ${line.description}`,
      );
      continue;
    }

    const supplierName = await resolveSupplierName(line, supplierNames, parsed.sku);

    if (!supplierName) {
      counts.skippedRows += 1;
      warnings.push(
        `[${line.fileName}] Unknown supplier for "${line.description}"`,
      );
      continue;
    }

    const { uomAtOrder, unitSizeAtOrder } = parseUnitToken(line.unit ?? null);
    if (!uomAtOrder) {
      warnings.push(
        `[${line.fileName}] Unknown unit for "${line.description}" (${line.unit ?? "no unit"})`,
      );
    } else {
      sizeKeys.add(`${unitSizeAtOrder ?? ""}${uomAtOrder}`);
    }

    const colorName =
      parsed.colorName ?? (parsed.baseType === "WHITE" ? "White" : null);

    const supplierId = await findOrCreateSupplier(supplierName, counts);
    const materialId = await findOrCreateMaterial({
      name: materialName,
      sku: parsed.sku,
      supplierId,
      counts,
    });
    const baseId = await findOrCreateBase({
      materialId,
      baseType: parsed.baseType,
      counts,
    });
    await findOrCreateColour({
      materialId,
      baseId,
      colorName,
      colorCode: parsed.colorCode ?? null,
      baseType: parsed.baseType,
      isTinted: parsed.isTinted,
      counts,
    });

    await upsertMaterialPrice({
      supplierId,
      materialId,
      baseId,
      unitSize: unitSizeAtOrder,
      uom: uomAtOrder,
      price,
      sourcePdf: line.fileName,
      sku: parsed.sku,
      counts,
    });
  }

  counts.sizesCreated = sizeKeys.size;
  return { counts, warnings };
}

async function buildPreview(lines: CatalogueLine[]) {
  const supplierNames = await loadSupplierNames();

  return Promise.all(lines.slice(0, 500).map(async (line) => {
    const parsed = parseBuildSmartProduct(line.description);
    const { uomAtOrder, unitSizeAtOrder } = parseUnitToken(line.unit ?? null);
    const supplier = await resolveSupplierName(line, supplierNames, parsed.sku);

    return {
      fileName: line.fileName,
      supplier,
      material: normalizeText(parsed.cleanName),
      sku: parsed.sku,
      base: baseDisplayName(parsed.baseType),
      colour: parsed.colorName ?? (parsed.baseType === "WHITE" ? "White" : null),
      colourCode: parsed.colorCode ?? null,
      unitSize: unitSizeAtOrder,
      uom: uomAtOrder,
      price: calculateUnitPrice(line),
      sourceDescription: line.description,
    };
  }));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session || !["ADMIN", "OFFICE"].includes(role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const actionValue = formData.get("action");
    const action = typeof actionValue === "string" ? actionValue : "parse";

    if (action !== "parse" && action !== "import") {
      return NextResponse.json(
        { error: 'action must be either "parse" or "import"' },
        { status: 400 },
      );
    }

    const pdfEntries = formData.getAll("pdfs");
    if (pdfEntries.length === 0) {
      return NextResponse.json({ error: "No PDF files provided" }, { status: 400 });
    }
    if (pdfEntries.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Too many files. A maximum of ${MAX_FILES} PDFs is allowed.` },
        { status: 400 },
      );
    }

    const buffers: { name: string; buffer: Buffer }[] = [];
    for (const entry of pdfEntries) {
      if (!(entry instanceof File)) continue;
      if (
        entry.type &&
        entry.type !== "application/pdf" &&
        !entry.name.toLowerCase().endsWith(".pdf")
      ) {
        return NextResponse.json(
          { error: `"${entry.name}" is not a PDF file` },
          { status: 400 },
        );
      }
      if (entry.size === 0) {
        return NextResponse.json(
          { error: `"${entry.name}" is empty` },
          { status: 400 },
        );
      }
      if (entry.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `"${entry.name}" exceeds the 20 MB limit` },
          { status: 400 },
        );
      }

      buffers.push({
        name: entry.name,
        buffer: Buffer.from(await entry.arrayBuffer()),
      });
    }

    const parsedReports = await parseCostReportBuffers(buffers);
    const parseWarnings: string[] = [];
    const collectedLines: CatalogueLine[] = [];

    for (const { fileName, report } of parsedReports) {
      for (const warning of report.warnings ?? []) {
        parseWarnings.push(`[${fileName}] ${warning}`);
      }

      for (const line of report.materialLines ?? []) {
        collectedLines.push({
          ...line,
          fileName,
          description: normalizeText(line.description),
          totalAmount: normalizeMoney(line.totalAmount),
        });
      }
    }

    const deduplicated = deduplicateLines(collectedLines);
    if (deduplicated.duplicateCount > 0) {
      parseWarnings.push(
        `${deduplicated.duplicateCount} repeated catalogue line(s) were removed.`,
      );
    }

    if (action === "parse") {
      return NextResponse.json({
        action: "parse",
        totalLines: deduplicated.lines.length,
        rawLines: collectedLines.length,
        duplicateLinesRemoved: deduplicated.duplicateCount,
        parseWarnings,
        items: await buildPreview(deduplicated.lines),
      });
    }

    const result = await processCatalogueLines(deduplicated.lines);

    return NextResponse.json({
      action: "import",
      totalLines: deduplicated.lines.length,
      rawLines: collectedLines.length,
      duplicateLinesRemoved: deduplicated.duplicateCount,
      summary: result.counts,
      parseWarnings: [...parseWarnings, ...result.warnings],
    });
  } catch (error) {
    console.error("BuildSmart catalogue-builder endpoint failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to process catalogue PDFs",
      },
      { status: 500 },
    );
  }
}
