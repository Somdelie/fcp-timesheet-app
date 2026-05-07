import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { decimalToNumber } from "@/lib/dateUtc";
import type { ProductUom, ProductType } from "@/generated/prisma/client";

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
        supplierPrices: {
          where: { isActive: true },
          include: { supplier: { select: { id: true, name: true } } },
          orderBy: { startsOn: "desc" },
        },
        variantStocks: { select: { id: true, size: true, color: true, qty: true } },
        _count: { select: { orderItems: true } },
      },
    });

    if (!product)
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404, headers: CORS },
      );

    const data = {
      ...product,
      unitSize: product.unitSize ? decimalToNumber(product.unitSize) : null,
      supplierPrices: product.supplierPrices.map((sp) => ({
        ...sp,
        price: decimalToNumber(sp.price),
      })),
    };

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
      variantStocks?: { size?: string | null; color?: string | null; qty?: number }[];
    };

    const variantStocksInput = (body as any).variantStocks as
      | { size?: string | null; color?: string | null; qty?: number }[]
      | undefined;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name.trim();
    if (sku !== undefined) data.sku = sku?.trim() || null;
    if (categoryId !== undefined)
      data.category = categoryId
        ? { connect: { id: categoryId } }
        : { disconnect: true };
    if (uom !== undefined) data.uom = uom;
    if (unitSize !== undefined)
      data.unitSize = unitSize != null ? Number(unitSize) : null;
    if (description !== undefined)
      data.description = description?.trim() || null;
    if (supplierId !== undefined)
      data.supplier = supplierId
        ? { connect: { id: supplierId } }
        : { disconnect: true };
    if (isActive !== undefined) data.isActive = isActive;
    if (thumbnailUrl !== undefined)
      data.thumbnailUrl = thumbnailUrl?.trim() || null;
    if (productType !== undefined) data.productType = productType;
    if (isReturnable !== undefined) data.isReturnable = isReturnable;
    if ((body as any).isDeductible !== undefined) data.isDeductible = (body as any).isDeductible;
    if ((body as any).deductionSplits !== undefined) data.deductionSplits = Number((body as any).deductionSplits) || 1;
    if (colors !== undefined) data.colors = colors;
    if ((body as any).sizes !== undefined) data.sizes = (body as any).sizes;

    if (variantStocksInput !== undefined) {
      data.stockQty = variantStocksInput.reduce(
        (s, v) => s + (Number(v.qty) || 0),
        0,
      );
    } else if (stockQty !== undefined) {
      data.stockQty = Number(stockQty);
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (variantStocksInput !== undefined) {
        await tx.productVariantStock.deleteMany({ where: { productId: id } });
      }
      const product = await tx.procurementProduct.update({
        where: { id },
        data,
        include: {
          category: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
          variantStocks: { select: { id: true, size: true, color: true, qty: true } },
        },
      });
      if (variantStocksInput?.length) {
        await tx.productVariantStock.createMany({
          data: variantStocksInput.map((v) => ({
            productId: id,
            size: v.size || null,
            color: v.color || null,
            qty: Math.max(0, Number(v.qty) || 0),
          })),
        });
        product.variantStocks = await tx.productVariantStock.findMany({
          where: { productId: id },
          select: { id: true, size: true, color: true, qty: true },
        });
      }
      return product;
    }, { maxWait: 10000, timeout: 30000 });

    const result = {
      ...updated,
      unitSize: updated.unitSize ? decimalToNumber(updated.unitSize) : null,
    };

    return NextResponse.json({ ok: true, data: result }, { headers: CORS });
  } catch (e: any) {
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

    await prisma.procurementProduct.delete({ where: { id } });

    return NextResponse.json({ ok: true }, { headers: CORS });
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
