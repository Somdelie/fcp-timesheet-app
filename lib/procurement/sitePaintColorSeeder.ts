import { prisma } from "@/lib/prisma";
import { parsePdfBuffer } from "@/lib/buildsmart-parser";
import { normalizeSupplierName } from "@/lib/buildsmart-import-mappings";
import { normalizeSkuKey } from "@/lib/procurement/buildsmartProductCodes";
import { extractColorAndBase } from "@/lib/procurement/colorPdfImporter";
import type { ColorBaseType, Prisma } from "@/generated/prisma/client";

type Db = typeof prisma | Prisma.TransactionClient;

type PdfInput = {
  fileName: string;
  buffer: Buffer;
};

export type SitePaintColorSeedStatus =
  | "READY"
  | "CREATED"
  | "UPDATED"
  | "DUPLICATE"
  | "SKIPPED";

export type SitePaintColorSeedRow = {
  sourceFile: string;
  orderReference: string | null;
  siteCode: string | null;
  siteId: string | null;
  siteName: string | null;
  productId: string | null;
  productName: string | null;
  supplierId: string | null;
  supplierName: string | null;
  sourceOrderId: string | null;
  sourceOrderItemId: string | null;
  rawDescription: string;
  colorName: string;
  colorCode: string | null;
  baseType: ColorBaseType;
  isTinted: boolean;
  status: SitePaintColorSeedStatus;
  reason?: string;
  sitePaintColorId?: string;
};

type BuildRowsOptions = {
  write: boolean;
};

const EXCLUDED_SITE_COLOR_TERMS = [
  "container",
  "on account",
  "skim coat",
  "skim coats",
  "primer",
  "priming",
  "undercoat",
  "under coat",
  "bonding liquid",
  "preparation",
  "prep",
];

function normalizedText(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function colorLabel(row: {
  colorName: string;
  colorCode: string | null;
  baseType: ColorBaseType;
}) {
  const code = row.colorCode ? ` ${row.colorCode}` : "";
  const base = row.baseType === "NEUTRAL" ? "" : ` (${row.baseType})`;
  return `${row.colorName}${code}${base}`;
}

async function findSupplierFromVendor(vendorName: string | null) {
  if (!vendorName) return null;
  const normalized = normalizeSupplierName(vendorName);
  return prisma.supplier.findFirst({
    where: {
      OR: [
        { name: { equals: normalized, mode: "insensitive" } },
        { name: { equals: vendorName.trim(), mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true },
  });
}

async function findProductFromSku(candidateSku: string | null) {
  if (!candidateSku) return null;
  const products = await prisma.procurementProduct.findMany({
    where: { sku: { not: null } },
    select: { id: true, name: true, sku: true },
  });
  const key = normalizeSkuKey(candidateSku);
  return products.find((p) => normalizeSkuKey(p.sku) === key) ?? null;
}

async function ensureColorVariant(
  db: Db,
  input: {
  productId: string | null;
  colorName: string;
  colorCode: string | null;
  baseType: ColorBaseType;
  isTinted: boolean;
  },
) {
  if (!input.productId) return null;

  const existing = await db.productColorVariant.findFirst({
    where: {
      productId: input.productId,
      colorName: { equals: input.colorName, mode: "insensitive" },
      baseType: input.baseType,
    },
    select: { id: true, colorCode: true, isTinted: true },
  });

  if (existing) {
    if (
      (input.colorCode && !existing.colorCode) ||
      (input.isTinted && !existing.isTinted)
    ) {
      await db.productColorVariant.update({
        where: { id: existing.id },
        data: {
          colorCode: existing.colorCode ?? input.colorCode,
          isTinted: existing.isTinted || input.isTinted,
        },
      });
    }
    return existing.id;
  }

  const created = await db.productColorVariant.create({
    data: {
      productId: input.productId,
      colorName: input.colorName,
      colorCode: input.colorCode,
      baseType: input.baseType,
      isTinted: input.isTinted,
    },
    select: { id: true },
  });
  return created.id;
}

async function findExistingSiteColor(db: Db, row: SitePaintColorSeedRow) {
  const or = [];
  if (row.sourceOrderItemId) {
    or.push({ sourceOrderItemId: row.sourceOrderItemId });
  }
  or.push({
    siteId: row.siteId!,
    productId: row.productId,
    colorName: { equals: row.colorName, mode: "insensitive" as const },
    baseType: row.baseType,
  });

  return db.sitePaintColor.findFirst({
    where: { OR: or },
    select: {
      id: true,
      productId: true,
      colorVariantId: true,
      supplierId: true,
      sourceOrderId: true,
      sourceOrderItemId: true,
      colorCode: true,
      rawDescription: true,
    },
  });
}

async function writeSiteColor(db: Db, row: SitePaintColorSeedRow) {
  if (!row.siteId) {
    return {
      ...row,
      status: "SKIPPED" as const,
      reason: "No site found for PDF contract/order",
    };
  }

  const colorVariantId = await ensureColorVariant(db, {
    productId: row.productId,
    colorName: row.colorName,
    colorCode: row.colorCode,
    baseType: row.baseType,
    isTinted: row.isTinted,
  });

  const existing = await findExistingSiteColor(db, row);
  const data = {
    siteId: row.siteId,
    productId: row.productId,
    colorVariantId,
    supplierId: row.supplierId,
    sourceOrderId: row.sourceOrderId,
    sourceOrderItemId: row.sourceOrderItemId,
    orderReference: row.orderReference,
    sourceFile: row.sourceFile,
    rawDescription: row.rawDescription,
    productSnapshot: row.productName,
    supplierSnapshot: row.supplierName,
    colorName: row.colorName,
    colorCode: row.colorCode,
    baseType: row.baseType,
    isTinted: row.isTinted,
  };

  if (existing) {
    const needsUpdate =
      (!existing.productId && row.productId) ||
      (!existing.colorVariantId && colorVariantId) ||
      (!existing.supplierId && row.supplierId) ||
      (!existing.sourceOrderId && row.sourceOrderId) ||
      (!existing.sourceOrderItemId && row.sourceOrderItemId) ||
      (!existing.colorCode && row.colorCode) ||
      (!existing.rawDescription && row.rawDescription);

    if (needsUpdate) {
      const updated = await db.sitePaintColor.update({
        where: { id: existing.id },
        data,
        select: { id: true },
      });
      return { ...row, status: "UPDATED" as const, sitePaintColorId: updated.id };
    }

    return {
      ...row,
      status: "DUPLICATE" as const,
      sitePaintColorId: existing.id,
    };
  }

  const created = await db.sitePaintColor.create({
    data,
    select: { id: true },
  });

  return { ...row, status: "CREATED" as const, sitePaintColorId: created.id };
}

export async function ensureSitePaintColorFromOrderItem(
  db: Db,
  input: {
    siteId: string;
    productId: string;
    rawDescription: string | null;
    supplierId?: string | null;
    supplierName?: string | null;
    sourceOrderId?: string | null;
    sourceOrderItemId?: string | null;
    orderReference?: string | null;
    sourceFile?: string | null;
  },
) {
  const [site, product, supplier] = await Promise.all([
    db.site.findUnique({
      where: { id: input.siteId },
      select: { id: true, code: true, name: true },
    }),
    db.procurementProduct.findUnique({
      where: { id: input.productId },
      select: { id: true, name: true },
    }),
    input.supplierId
      ? db.supplier.findUnique({
          where: { id: input.supplierId },
          select: { id: true, name: true },
        })
      : Promise.resolve(null),
  ]);

  if (!site) return { ok: false as const, error: "Site not found." };

  const rawDescription = input.rawDescription?.trim() || product?.name;
  if (!rawDescription) return { ok: true as const, seeded: false };
  const normalizedRaw = rawDescription.toLowerCase();
  if (EXCLUDED_SITE_COLOR_TERMS.some((term) => normalizedRaw.includes(term))) {
    return { ok: true as const, seeded: false };
  }

  const extracted = extractColorAndBase(rawDescription);
  if (!extracted.colorName) return { ok: true as const, seeded: false };

  const row: SitePaintColorSeedRow = {
    sourceFile: input.sourceFile ?? "site product order",
    orderReference: input.orderReference ?? null,
    siteCode: site.code,
    siteId: site.id,
    siteName: site.name,
    productId: product?.id ?? input.productId,
    productName: product?.name ?? null,
    supplierId: supplier?.id ?? input.supplierId ?? null,
    supplierName: supplier?.name ?? input.supplierName ?? null,
    sourceOrderId: input.sourceOrderId ?? null,
    sourceOrderItemId: input.sourceOrderItemId ?? null,
    rawDescription,
    colorName: extracted.colorName,
    colorCode: extracted.colorCode,
    baseType: extracted.baseType,
    isTinted: extracted.isTinted,
    status: "READY",
  };

  const written = await writeSiteColor(db, row);
  return {
    ok: true as const,
    seeded:
      written.status === "CREATED" ||
      written.status === "UPDATED" ||
      written.status === "DUPLICATE",
    row: written,
  };
}

export async function seedSitePaintColorsFromOrderPdfs(
  pdfs: PdfInput[],
  options: BuildRowsOptions,
): Promise<{
  rows: SitePaintColorSeedRow[];
  parseFailures: { fileName: string; reason: string }[];
}> {
  const rows: SitePaintColorSeedRow[] = [];
  const parseFailures: { fileName: string; reason: string }[] = [];

  for (const pdf of pdfs) {
    const parsed = await parsePdfBuffer(pdf.buffer);
    if (!parsed) {
      parseFailures.push({
        fileName: pdf.fileName,
        reason: "Could not parse BuildSmart order PDF",
      });
      continue;
    }

    const site = parsed.siteCode
      ? await prisma.site.findUnique({
          where: { code: parsed.siteCode },
          select: { id: true, name: true, code: true },
        })
      : null;

    const existingOrder = parsed.orderNumber
      ? await prisma.siteProductOrder.findFirst({
          where: { reference: parsed.orderNumber },
          select: {
            id: true,
            siteId: true,
            site: { select: { id: true, name: true, code: true } },
            supplierId: true,
            supplier: { select: { id: true, name: true } },
            items: {
              select: {
                id: true,
                note: true,
                productId: true,
                product: { select: { id: true, name: true, sku: true } },
              },
            },
          },
        })
      : null;

    const supplier =
      existingOrder?.supplier ??
      (await findSupplierFromVendor(parsed.vendorName));
    const resolvedSite = existingOrder?.site ?? site;

    for (const item of parsed.items) {
      const extracted = extractColorAndBase(item.rawDescription);
      if (!extracted.colorName && !extracted.colorCode) continue;
      if (!extracted.colorName) continue;

      const rawKey = normalizedText(item.rawDescription);
      const sourceItem =
        existingOrder?.items.find((orderItem) => normalizedText(orderItem.note) === rawKey) ??
        null;
      const skuProduct = sourceItem
        ? null
        : await findProductFromSku(item.candidateSku);
      const product = sourceItem?.product ?? skuProduct;

      const baseRow: SitePaintColorSeedRow = {
        sourceFile: pdf.fileName,
        orderReference: parsed.orderNumber,
        siteCode: resolvedSite?.code ?? parsed.siteCode,
        siteId: resolvedSite?.id ?? null,
        siteName: resolvedSite?.name ?? parsed.siteName,
        productId: product?.id ?? null,
        productName: product?.name ?? null,
        supplierId: supplier?.id ?? null,
        supplierName: supplier?.name ?? parsed.vendorName,
        sourceOrderId: existingOrder?.id ?? null,
        sourceOrderItemId: sourceItem?.id ?? null,
        rawDescription: item.rawDescription,
        colorName: extracted.colorName,
        colorCode: extracted.colorCode,
        baseType: extracted.baseType,
        isTinted: extracted.isTinted,
        status: "READY",
      };

      if (!baseRow.siteId) {
        rows.push({
          ...baseRow,
          status: "SKIPPED",
          reason: "No matching site found",
        });
        continue;
      }

      if (options.write) {
        rows.push(await writeSiteColor(prisma, baseRow));
      } else {
        const existing = await findExistingSiteColor(prisma, baseRow);
        rows.push({
          ...baseRow,
          status: existing ? "DUPLICATE" : "READY",
          reason: existing ? "Already seeded for this site" : colorLabel(baseRow),
          sitePaintColorId: existing?.id,
        });
      }
    }
  }

  return { rows, parseFailures };
}
