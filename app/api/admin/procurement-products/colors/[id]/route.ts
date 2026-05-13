import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ColorBaseType } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAuth() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (session?.user && (role === "ADMIN" || role === "OFFICE")) {
    return { id: (session.user as any).id as string, role: role as "ADMIN" | "OFFICE" };
  }
  return null;
}

/**
 * PUT /api/admin/procurement-products/colors/[id]
 * Body: { colorName?, colorCode?, baseType?, isTinted? }
 */
export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json();
  const { colorName, colorCode, baseType, isTinted } = body as {
    colorName?: string;
    colorCode?: string;
    baseType?: ColorBaseType;
    isTinted?: boolean;
  };

  try {
    const variant = await prisma.productColorVariant.update({
      where: { id },
      data: {
        ...(colorName !== undefined ? { colorName: colorName.trim() } : {}),
        ...(colorCode !== undefined ? { colorCode: colorCode?.trim() || null } : {}),
        ...(baseType !== undefined ? { baseType } : {}),
        ...(isTinted !== undefined ? { isTinted } : {}),
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            category: { select: { id: true, name: true } },
          },
        },
        supplierPrices: {
          where: { isActive: true },
          select: {
            id: true,
            price: true,
            uom: true,
            unitSize: true,
            supplier: { select: { id: true, name: true } },
          },
        },
      },
    });

    return NextResponse.json({
      ...variant,
      supplierPrices: variant.supplierPrices.map((sp) => ({
        ...sp,
        price: Number(sp.price),
        unitSize: sp.unitSize != null ? Number(sp.unitSize) : null,
      })),
    });
  } catch (e: any) {
    if (e?.code === "P2025") {
      return NextResponse.json({ error: "Color variant not found" }, { status: 404 });
    }
    if (e?.code === "P2002") {
      return NextResponse.json(
        { error: "A color variant with this product, name, and base type already exists" },
        { status: 409 },
      );
    }
    console.error("PUT /colors/[id] error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/procurement-products/colors/[id]
 * Removes the color variant. Supplier prices linked to it have their
 * colorVariantId set to null (via onDelete: SetNull in schema).
 */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  try {
    await prisma.productColorVariant.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.code === "P2025") {
      return NextResponse.json({ error: "Color variant not found" }, { status: 404 });
    }
    console.error("DELETE /colors/[id] error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
