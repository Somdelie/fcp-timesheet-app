import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { decimalToNumber } from "@/lib/dateUtc";
import { canonicalPlantName } from "@/lib/procurement/plantName";
import type {
  ProductUom,
  ProductType,
  PlantCondition,
} from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

async function getAuth(req: Request) {
  const h = req.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : null;
  if (token) {
    const p = await verifyApiToken(token);
    if (p && (p.role === "ADMIN" || p.role === "OFFICE"))
      return { id: p.sub, role: p.role as "ADMIN" | "OFFICE" };
  }
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (session?.user && (role === "ADMIN" || role === "OFFICE"))
    return {
      id: (session.user as any).id as string,
      role: role as "ADMIN" | "OFFICE",
    };
  return null;
}

function normalizeCatalogueName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function serialiseCatalogueProduct(product: any) {
  const master = product.masterCatalogueProduct ?? null;
  return {
    ...product,
    id: product.id,
    name: master?.name ?? product.name,
    sku: master?.sku ?? product.sku,
    description: master?.description ?? product.description,
    thumbnailUrl: master?.thumbnailUrl ?? product.thumbnailUrl,
    isActive: master?.isActive ?? product.isActive,
    productType: master?.productType ?? product.productType,
    isReturnable: master?.isReturnable ?? product.isReturnable,
    isDeductible: master?.isDeductible ?? product.isDeductible,
    deductionSplits: master?.deductionSplits ?? product.deductionSplits,
    colors: master?.colors ?? product.colors ?? [],
    sizes: master?.sizes ?? product.sizes ?? [],
    stockQty: master?.stockQty ?? product.stockQty ?? 0,
    category: master?.categoryRef ?? product.category ?? null,
    supplier: master?.supplier ?? product.supplier ?? null,
    uom: master?.uom ?? product.uom ?? null,
    unitSize:
      master?.unitSize != null
        ? decimalToNumber(master.unitSize)
        : product.unitSize
          ? decimalToNumber(product.unitSize)
          : null,
    masterCatalogueProductId:
      product.masterCatalogueProductId ?? master?.id ?? null,
    catalogueSource: master ? "MASTER" : "LEGACY",
    supplierPrices: (product.supplierPrices ?? []).map((sp: any) => ({
      ...sp,
      price: decimalToNumber(sp.price),
      unitSize: sp.unitSize ? decimalToNumber(sp.unitSize) : null,
    })),
    masterCatalogueProduct: undefined,
  };
}

async function findDuplicatePlantName(name: string, excludeId: string) {
  const canonicalName = canonicalPlantName(name);
  if (!canonicalName) return null;

  const plants = await prisma.procurementProduct.findMany({
    where: {
      productType: "PLANT",
      id: { not: excludeId },
    },
    select: { id: true, name: true },
  });

  return (
    plants.find((plant) => canonicalPlantName(plant.name) === canonicalName) ??
    null
  );
}

/**
 * GET /api/app/admin/procurement-products/[id]
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS },
      );

    const { id } = await ctx.params;

    const product = await prisma.procurementProduct.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        masterCatalogueProduct: {
          include: {
            categoryRef: { select: { id: true, name: true } },
            supplier: { select: { id: true, name: true } },
          },
        },
        supplierPrices: {
          where: { isActive: true },
          include: { supplier: { select: { id: true, name: true } } },
          orderBy: { startsOn: "desc" },
        },
        variantStocks: {
          select: { id: true, size: true, color: true, condition: true, qty: true },
        },
        _count: { select: { orderItems: true } },
      },
    });

    if (!product)
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404, headers: CORS },
      );

    const data = serialiseCatalogueProduct(product);

    return NextResponse.json({ ok: true, data }, { headers: CORS });
  } catch (e: any) {
    console.error("GET procurement-product error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}

/**
 * PATCH /api/app/admin/procurement-products/[id]
 * Body: { name?, sku?, categoryId?, uom?, unitSize?, description?, supplierId?, isActive?, thumbnailUrl? }
 *
 * This endpoint works with both Material and ProcurementProduct records.
 * It will first try Material, then fall back to ProcurementProduct.
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS },
      );

    const { id } = await ctx.params;
    const body = await req.json();
    const {
      name,
      sku,
      categoryId,
      uom,
      unitSize,
      description,
      supplierId,
      isActive,
      thumbnailUrl,
      productType,
      isReturnable,
      colors,
      stockQty,
    } = body as {
      name?: string;
      sku?: string | null;
      categoryId?: string | null;
      uom?: ProductUom;
      unitSize?: number | string | null;
      description?: string | null;
      supplierId?: string | null;
      isActive?: boolean;
      thumbnailUrl?: string | null;
      productType?: ProductType;
      isReturnable?: boolean;
      colors?: string[];
      sizes?: string[];
      stockQty?: number;
      variantStocks?: {
        size?: string | null;
        color?: string | null;
        condition?: PlantCondition | null;
        qty?: number;
      }[];
    };

    // Try to update Material first
    const existingMaterial = await prisma.material.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, name: true } },
        prices: {
          where: { isActive: true },
          include: { supplier: { select: { id: true, name: true } } },
          orderBy: { startsOn: "desc" },
        },
      },
    });

    if (existingMaterial) {
      const data: Record<string, unknown> = {};
      if (name !== undefined) data.name = name.trim();
      if (sku !== undefined) data.sku = sku?.trim() || null;
      if (categoryId !== undefined)
        data.category = categoryId
          ? { connect: { id: categoryId } }
          : { disconnect: true };
      if (description !== undefined)
        data.description = description?.trim() || null;
      if (supplierId !== undefined)
        data.supplier = supplierId
          ? { connect: { id: supplierId } }
          : { disconnect: true };
      if (isActive !== undefined) data.isActive = isActive;
      if (isReturnable !== undefined) data.isReturnable = isReturnable;
      if (colors !== undefined) data.colors = colors;

      const updated = await prisma.material.update({
        where: { id },
        data,
        include: {
          supplier: { select: { id: true, name: true } },
          prices: {
            where: { isActive: true },
            include: { supplier: { select: { id: true, name: true } } },
            orderBy: { startsOn: "desc" },
          },
        },
      });

      const sizes = (updated.prices ?? [])
        .map((p: any) => {
          if (p.unitSize != null && p.uom) return `${p.unitSize}${p.uom}`;
          return null;
        })
        .filter(Boolean) as string[];

      const result = {
        id: updated.id,
        name: updated.name,
        sku: updated.sku,
        description: updated.description,
        thumbnailUrl: null,
        isActive: updated.isActive,
        productType: "MATERIAL" as ProductType,
        isReturnable: updated.isReturnable,
        isDeductible: true,
        deductionSplits: 1,
        colors: updated.colors ?? [],
        sizes: Array.from(new Set(sizes)),
        stockQty: 0,
        variantStocks: [],
        category: null,
        supplier: updated.supplier,
        supplierPrices: (updated.prices ?? []).map((sp: any) => ({
          id: sp.id,
          price: decimalToNumber(sp.price),
          uom: sp.uom,
          unitSize: sp.unitSize ? decimalToNumber(sp.unitSize) : null,
          supplierId: sp.supplierId,
          supplier: sp.supplier,
          isActive: true,
        })),
        _count: {
          orderItems: 0,
          supplierPrices: (updated.prices ?? []).length,
        },
      };

      return NextResponse.json({ ok: true, data: result }, { headers: CORS });
    }

    // Fall back to ProcurementProduct
    const variantStocksInput = (body as any).variantStocks as
      | {
          size?: string | null;
          color?: string | null;
          condition?: PlantCondition | null;
          qty?: number;
        }[]
      | undefined;

    const ppData: Record<string, unknown> = {};
    if (name !== undefined) ppData.name = name.trim();
    if (sku !== undefined) ppData.sku = sku?.trim() || null;
    if (categoryId !== undefined)
      ppData.category = categoryId
        ? { connect: { id: categoryId } }
        : { disconnect: true };
    if (uom !== undefined) ppData.uom = uom;
    if (unitSize !== undefined)
      ppData.unitSize = unitSize != null ? Number(unitSize) : null;
    if (description !== undefined)
      ppData.description = description?.trim() || null;
    if (supplierId !== undefined)
      ppData.supplier = supplierId
        ? { connect: { id: supplierId } }
        : { disconnect: true };
    if (isActive !== undefined) ppData.isActive = isActive;
    if (thumbnailUrl !== undefined)
      ppData.thumbnailUrl = thumbnailUrl?.trim() || null;
    if (productType !== undefined) ppData.productType = productType;
    if (isReturnable !== undefined) ppData.isReturnable = isReturnable;
    if ((body as any).isDeductible !== undefined)
      ppData.isDeductible = (body as any).isDeductible;
    if ((body as any).deductionSplits !== undefined)
      ppData.deductionSplits = Number((body as any).deductionSplits) || 1;
    if (colors !== undefined) ppData.colors = colors;
    if ((body as any).sizes !== undefined) ppData.sizes = (body as any).sizes;

    if (name !== undefined) {
      const existingProduct = await prisma.procurementProduct.findUnique({
        where: { id },
        select: { productType: true },
      });
      if ((productType ?? existingProduct?.productType) === "PLANT") {
        const duplicate = await findDuplicatePlantName(name, id);
        if (duplicate) {
          return NextResponse.json(
            { error: `A plant item named "${duplicate.name}" already exists` },
            { status: 409, headers: CORS },
          );
        }
      }
    }

    if (variantStocksInput !== undefined) {
      ppData.stockQty = variantStocksInput.reduce(
        (s, v) => s + (Number(v.qty) || 0),
        0,
      );
    } else if (stockQty !== undefined) {
      ppData.stockQty = Number(stockQty);
    }

    const ppUpdated = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.procurementProduct.findUnique({
          where: { id },
          include: { masterCatalogueProduct: true },
        });
        if (!existing)
          throw Object.assign(new Error("Product not found"), {
            code: "P2025",
          });

        const nextSupplierId =
          supplierId !== undefined ? supplierId : existing.supplierId;
        const nextName = name !== undefined ? name.trim() : existing.name;
        const nextNormalizedName = normalizeCatalogueName(nextName);

        if (nextSupplierId) {
          const category = categoryId
            ? await tx.productCategory.findUnique({
                where: { id: categoryId },
                select: { name: true },
              })
            : null;

          const duplicate = await tx.masterCatalogueProduct.findUnique({
            where: {
              supplierId_normalizedName: {
                supplierId: nextSupplierId,
                normalizedName: nextNormalizedName,
              },
            },
            include: { legacyProcurementProduct: { select: { id: true } } },
          });

          if (
            duplicate &&
            duplicate.id !== existing.masterCatalogueProductId &&
            duplicate.legacyProcurementProduct
          ) {
            throw Object.assign(
              new Error(
                `A catalogue product named "${duplicate.name}" already exists for this supplier`,
              ),
              { code: "CATALOGUE_DUPLICATE" },
            );
          }

          const masterData: Record<string, unknown> = {
            supplier: { connect: { id: nextSupplierId } },
            name: nextName,
            normalizedName: nextNormalizedName,
            sku: sku !== undefined ? sku?.trim() || null : existing.sku,
            description:
              description !== undefined
                ? description?.trim() || null
                : existing.description,
            thumbnailUrl:
              thumbnailUrl !== undefined
                ? thumbnailUrl?.trim() || null
                : existing.thumbnailUrl,
            categoryId:
              categoryId !== undefined
                ? categoryId || null
                : existing.categoryId,
            category: category?.name ?? "Uncategorised",
            uom: uom !== undefined ? uom : existing.uom,
            unitSize:
              unitSize !== undefined
                ? unitSize != null
                  ? Number(unitSize)
                  : null
                : existing.unitSize,
            productType: productType ?? existing.productType,
            isReturnable: isReturnable ?? existing.isReturnable,
            isDeductible: (body as any).isDeductible ?? existing.isDeductible,
            deductionSplits:
              (body as any).deductionSplits !== undefined
                ? Number((body as any).deductionSplits) || 1
                : existing.deductionSplits,
            colors: colors ?? existing.colors,
            sizes: (body as any).sizes ?? existing.sizes,
            stockQty:
              variantStocksInput !== undefined
                ? variantStocksInput.reduce(
                    (sum, v) => sum + (Number(v.qty) || 0),
                    0,
                  )
                : stockQty !== undefined
                  ? Number(stockQty)
                  : existing.stockQty,
            isActive: isActive ?? existing.isActive,
          };

          if (existing.masterCatalogueProductId) {
            await tx.masterCatalogueProduct.update({
              where: { id: existing.masterCatalogueProductId },
              data: masterData,
            });
          } else {
            const master =
              duplicate ??
              (await tx.masterCatalogueProduct.create({
                data: masterData as any,
              }));
            ppData.masterCatalogueProduct = { connect: { id: master.id } };
          }
        }

        if (variantStocksInput !== undefined) {
          await tx.productVariantStock.deleteMany({ where: { productId: id } });
        }

        const product = await tx.procurementProduct.update({
          where: { id },
          data: ppData,
          include: {
            category: { select: { id: true, name: true } },
            supplier: { select: { id: true, name: true } },
            masterCatalogueProduct: {
              include: {
                categoryRef: { select: { id: true, name: true } },
                supplier: { select: { id: true, name: true } },
              },
            },
            supplierPrices: {
              where: { isActive: true },
              include: { supplier: { select: { id: true, name: true } } },
              orderBy: { startsOn: "desc" },
            },
            variantStocks: {
              select: { id: true, size: true, color: true, condition: true, qty: true },
            },
            _count: { select: { orderItems: true } },
          },
        });

        if (variantStocksInput?.length) {
          await tx.productVariantStock.createMany({
            data: variantStocksInput.map((v) => ({
              productId: id,
              size: v.size || null,
              color: v.color || null,
              condition: v.condition ?? "OLD",
              qty: Math.max(0, Number(v.qty) || 0),
            })),
          });
          product.variantStocks = await tx.productVariantStock.findMany({
            where: { productId: id },
            select: { id: true, size: true, color: true, condition: true, qty: true },
          });
        }
        return product;
      },
      { maxWait: 10000, timeout: 30000 },
    );

    const ppResult = serialiseCatalogueProduct(ppUpdated);

    return NextResponse.json({ ok: true, data: ppResult }, { headers: CORS });
  } catch (e: any) {
    if (e?.code === "CATALOGUE_DUPLICATE")
      return NextResponse.json(
        { error: e.message },
        { status: 409, headers: CORS },
      );
    if (e?.code === "P2025")
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404, headers: CORS },
      );
    if (e?.code === "P2002" && e?.meta?.target?.includes("sku"))
      return NextResponse.json(
        { error: "A product with that SKU already exists" },
        { status: 409, headers: CORS },
      );
    console.error("PATCH procurement-product error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}

/**
 * DELETE /api/app/admin/procurement-products/[id]
 * Deletes from Material or ProcurementProduct (tries Material first, then falls back to ProcurementProduct).
 */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS },
      );

    const { id } = await ctx.params;

    try {
      await prisma.$transaction(async (tx) => {
        const product = await tx.procurementProduct.findUnique({
          where: { id },
          select: { masterCatalogueProductId: true },
        });
        if (!product)
          throw Object.assign(new Error("Product not found"), {
            code: "P2025",
          });
        await tx.procurementProduct.delete({ where: { id } });
        if (product.masterCatalogueProductId) {
          await tx.masterCatalogueProduct.delete({
            where: { id: product.masterCatalogueProductId },
          });
        }
      });
      return NextResponse.json({ ok: true }, { headers: CORS });
    } catch (e: any) {
      // If not found in ProcurementProduct, try Material
      if (e?.code === "P2025") {
        try {
          await prisma.material.delete({ where: { id } });
          return NextResponse.json({ ok: true }, { headers: CORS });
        } catch (e2: any) {
          if (e2?.code === "P2025")
            return NextResponse.json(
              { error: "Product not found" },
              { status: 404, headers: CORS },
            );
          throw e2;
        }
      }
      throw e;
    }
  } catch (e: any) {
    if (e?.code === "P2025")
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404, headers: CORS },
      );
    if (e?.code === "P2003")
      return NextResponse.json(
        { error: "Cannot delete: product is used in existing orders" },
        { status: 409, headers: CORS },
      );
    console.error("DELETE procurement-product error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}
