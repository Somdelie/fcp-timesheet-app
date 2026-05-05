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
  "Access-Control-Allow-Methods": "GET, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}

async function getAdminFromRequest(req: NextRequest) {
  const apiCtx = await requireApiAuth(req, ["ADMIN", "OFFICE"]);
  if (apiCtx) return { id: apiCtx.user.sub, role: apiCtx.user.role as string } as const;
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

const UpdateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  price: z.union([z.string(), z.number()]).optional(),
  isActive: z.boolean().optional(),
  category: z.enum(["PPE", "TOOL"]).optional(),
  sku: z.string().max(100).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  sizes: z.array(z.string()).optional(),
  colors: z.array(z.string()).optional(),
  stockQty: z.number().int().min(0).optional(),
  thumbnailUrl: z.string().optional().nullable(),
  variantStocks: z.array(z.object({
    size: z.string().nullable().optional(),
    color: z.string().nullable().optional(),
    qty: z.number().int().min(0).default(0),
  })).optional(),
});

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

// PATCH /api/app/admin/products/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await getAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
    }

    const { id } = await params;
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404, headers: CORS_HEADERS });
    }

    const json = await req.json().catch(() => null as any);
    const body = UpdateProductSchema.safeParse(json);
    if (!body.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400, headers: CORS_HEADERS });
    }

    const { variantStocks, ...rest } = body.data;
    const data: any = {};

    if (rest.name !== undefined) {
      data.name = rest.name.trim();
      data.normalizedName = rest.name.trim().toLowerCase();
    }
    if (rest.price !== undefined) {
      const n = Number(String(rest.price).replace(",", "."));
      if (!Number.isFinite(n) || n <= 0) {
        return NextResponse.json({ error: "Price must be a positive number" }, { status: 400, headers: CORS_HEADERS });
      }
      data.price = n as any;
    }
    if (rest.isActive !== undefined) data.isActive = rest.isActive;
    if (rest.category !== undefined) data.category = rest.category;
    if (rest.sku !== undefined) data.sku = rest.sku?.trim() || null;
    if (rest.description !== undefined) data.description = rest.description?.trim() || null;
    if (rest.sizes !== undefined) data.sizes = rest.sizes;
    if (rest.colors !== undefined) data.colors = rest.colors;
    if (rest.thumbnailUrl !== undefined) data.thumbnailUrl = rest.thumbnailUrl || null;
    if (rest.stockQty !== undefined) data.stockQty = rest.stockQty;

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
          data.stockQty = variantStocks.reduce((s, v) => s + (v.qty ?? 0), 0);
        }
      }
      return tx.product.update({ where: { id }, data, select: PRODUCT_SELECT });
    });

    return NextResponse.json({ ok: true, product: toDto(updated) }, { headers: CORS_HEADERS });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500, headers: CORS_HEADERS });
  }
}

// DELETE /api/app/admin/products/[id] — soft delete (marks inactive)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await getAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
    }

    const { id } = await params;
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404, headers: CORS_HEADERS });
    }

    await prisma.product.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500, headers: CORS_HEADERS });
  }
}
