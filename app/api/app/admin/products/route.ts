import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/apiAuth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}

async function getAdminFromRequest(req: NextRequest) {
  const apiCtx = await requireApiAuth(req, ["ADMIN", "OFFICE"]);
  if (apiCtx) {
    return { id: apiCtx.user.sub, role: apiCtx.user.role as string } as const;
  }
  try {
    const session = await getServerSession(authOptions);
    if (session?.user && (session.user as any).id) {
      const role = (session.user as any).role as string | undefined;
      if (role === "ADMIN" || role === "OFFICE") {
        return { id: (session.user as any).id as string, role } as const;
      }
    }
  } catch {}
  return null;
}

const StockCategorySchema = z.enum(["PPE", "TOOL"]);

const VariantStockSchema = z.array(
  z.object({
    size: z.string().nullable().optional(),
    color: z.string().nullable().optional(),
    qty: z.number().int().min(0).default(0),
  }),
);

const CreateProductSchema = z.object({
  name: z.string().min(1).max(200),
  price: z.union([z.string(), z.number()]),
  category: StockCategorySchema.optional().default("PPE"),
  sku: z.string().max(100).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  sizes: z.array(z.string()).optional().default([]),
  colors: z.array(z.string()).optional().default([]),
  stockQty: z.number().int().min(0).optional().default(0),
  thumbnailUrl: z.string().url().optional().nullable(),
  variantStocks: VariantStockSchema.optional().default([]),
});

const UpdateProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  price: z.union([z.string(), z.number()]).optional(),
  isActive: z.boolean().optional(),
  category: StockCategorySchema.optional(),
  sku: z.string().max(100).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  sizes: z.array(z.string()).optional(),
  colors: z.array(z.string()).optional(),
  stockQty: z.number().int().min(0).optional(),
  thumbnailUrl: z.string().url().optional().nullable(),
  variantStocks: VariantStockSchema.optional(),
});

const DeleteProductSchema = z.object({ id: z.string().min(1) });

const PRODUCT_SELECT = {
  id: true,
  name: true,
  sku: true,
  description: true,
  price: true,
  isActive: true,
  category: true,
  sizes: true,
  colors: true,
  stockQty: true,
  thumbnailUrl: true,
  variants: { select: { id: true, size: true, color: true, qty: true } },
} as const;

function toDto(p: any) {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku ?? null,
    description: p.description ?? null,
    price: (p.price as any).toString?.() ?? String(p.price ?? "0"),
    isActive: p.isActive,
    category: p.category,
    sizes: p.sizes ?? [],
    colors: p.colors ?? [],
    stockQty: p.stockQty ?? 0,
    thumbnailUrl: p.thumbnailUrl ?? null,
    variants: p.variants ?? [],
  };
}

// GET /api/app/admin/products
export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
    }

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const includeInactive = url.searchParams.get("includeInactive") === "true";
    const categoryParam = url.searchParams.get("category");

    const where: any = {};
    if (!includeInactive) where.isActive = true;
    if (q) where.name = { contains: q, mode: "insensitive" };
    if (categoryParam === "PPE" || categoryParam === "TOOL") where.category = categoryParam;

    const products = await prisma.product.findMany({
      where,
      orderBy: { name: "asc" },
      select: PRODUCT_SELECT,
    });

    return NextResponse.json({ ok: true, products: products.map(toDto) }, { headers: CORS_HEADERS });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500, headers: CORS_HEADERS });
  }
}

// POST /api/app/admin/products
export async function POST(req: NextRequest) {
  try {
    const admin = await getAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
    }

    const json = await req.json().catch(() => null as any);
    const body = CreateProductSchema.safeParse(json);
    if (!body.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400, headers: CORS_HEADERS });
    }

    const d = body.data;
    const priceNum = Number(String(d.price).replace(",", "."));
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      return NextResponse.json({ error: "Price must be a positive number" }, { status: 400, headers: CORS_HEADERS });
    }

    const created = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: d.name.trim(),
          normalizedName: d.name.trim().toLowerCase(),
          sku: d.sku?.trim() || null,
          description: d.description?.trim() || null,
          price: priceNum as any,
          isActive: true,
          category: d.category,
          sizes: d.sizes,
          colors: d.colors,
          stockQty: d.variantStocks.length > 0
            ? d.variantStocks.reduce((s, v) => s + (v.qty ?? 0), 0)
            : d.stockQty,
          thumbnailUrl: d.thumbnailUrl || null,
        },
        select: PRODUCT_SELECT,
      });

      if (d.variantStocks.length > 0) {
        await tx.stockItemVariant.createMany({
          data: d.variantStocks.map((v) => ({
            productId: product.id,
            size: v.size || null,
            color: v.color || null,
            qty: v.qty ?? 0,
          })),
          skipDuplicates: true,
        });
        return tx.product.findUniqueOrThrow({ where: { id: product.id }, select: PRODUCT_SELECT });
      }

      return product;
    });

    return NextResponse.json({ ok: true, product: toDto(created) }, { headers: CORS_HEADERS });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500, headers: CORS_HEADERS });
  }
}

// PATCH /api/app/admin/products
export async function PATCH(req: NextRequest) {
  try {
    const admin = await getAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
    }

    const json = await req.json().catch(() => null as any);
    const body = UpdateProductSchema.safeParse(json);
    if (!body.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400, headers: CORS_HEADERS });
    }

    const { id, variantStocks, ...rest } = body.data;
    const updateData: any = {};

    if (rest.name !== undefined) {
      updateData.name = rest.name.trim();
      updateData.normalizedName = rest.name.trim().toLowerCase();
    }
    if (rest.price !== undefined) {
      const n = Number(String(rest.price).replace(",", "."));
      if (!Number.isFinite(n) || n <= 0) {
        return NextResponse.json({ error: "Price must be a positive number" }, { status: 400, headers: CORS_HEADERS });
      }
      updateData.price = n as any;
    }
    if (rest.isActive !== undefined) updateData.isActive = rest.isActive;
    if (rest.category !== undefined) updateData.category = rest.category;
    if (rest.sku !== undefined) updateData.sku = rest.sku?.trim() || null;
    if (rest.description !== undefined) updateData.description = rest.description?.trim() || null;
    if (rest.sizes !== undefined) updateData.sizes = rest.sizes;
    if (rest.colors !== undefined) updateData.colors = rest.colors;
    if (rest.thumbnailUrl !== undefined) updateData.thumbnailUrl = rest.thumbnailUrl || null;
    if (rest.stockQty !== undefined) updateData.stockQty = rest.stockQty;

    const updated = await prisma.$transaction(async (tx) => {
      if (variantStocks !== undefined) {
        await tx.stockItemVariant.deleteMany({ where: { productId: id } });
        if (variantStocks.length > 0) {
          await tx.stockItemVariant.createMany({
            data: variantStocks.map((v) => ({
              productId: id,
              size: v.size || null,
              color: v.color || null,
              qty: v.qty ?? 0,
            })),
            skipDuplicates: true,
          });
          updateData.stockQty = variantStocks.reduce((s, v) => s + (v.qty ?? 0), 0);
        }
      }

      return tx.product.update({ where: { id }, data: updateData, select: PRODUCT_SELECT });
    });

    return NextResponse.json({ ok: true, product: toDto(updated) }, { headers: CORS_HEADERS });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500, headers: CORS_HEADERS });
  }
}

// DELETE /api/app/admin/products
export async function DELETE(req: NextRequest) {
  try {
    const admin = await getAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
    }

    const json = await req.json().catch(() => null as any);
    const body = DeleteProductSchema.safeParse(json);
    if (!body.success) {
      return NextResponse.json({ error: "Invalid payload – id is required" }, { status: 400, headers: CORS_HEADERS });
    }

    await prisma.product.delete({ where: { id: body.data.id } });
    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500, headers: CORS_HEADERS });
  }
}
