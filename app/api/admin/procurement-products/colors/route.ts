import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ColorBaseType } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAuth(req?: Request) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (session?.user && (role === "ADMIN" || role === "OFFICE")) {
    return { id: (session.user as any).id as string, role: role as "ADMIN" | "OFFICE" };
  }
  return null;
}

function serialiseVariant(v: any) {
  return {
    ...v,
    supplierPrices: v.supplierPrices?.map((sp: any) => ({
      ...sp,
      price: Number(sp.price),
      unitSize: sp.unitSize != null ? Number(sp.unitSize) : null,
    })),
  };
}

/**
 * GET /api/admin/procurement-products/colors
 * Returns all ProductColorVariant records with product + active supplier prices.
 */
export async function GET() {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const variants = await prisma.productColorVariant.findMany({
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
    orderBy: [{ product: { name: "asc" } }, { colorName: "asc" }],
  });

  return NextResponse.json(variants.map(serialiseVariant));
}

/**
 * POST /api/admin/procurement-products/colors
 * Body: { productId, colorName, colorCode?, baseType?, isTinted? }
 */
export async function POST(req: Request) {
  const auth = await getAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { productId, colorName, colorCode, baseType, isTinted } = body as {
    productId: string;
    colorName: string;
    colorCode?: string;
    baseType?: ColorBaseType;
    isTinted?: boolean;
  };

  if (!productId?.trim() || !colorName?.trim()) {
    return NextResponse.json(
      { error: "productId and colorName are required" },
      { status: 400 },
    );
  }

  try {
    const variant = await prisma.productColorVariant.create({
      data: {
        productId,
        colorName: colorName.trim(),
        colorCode: colorCode?.trim() || null,
        baseType: baseType ?? "DEEP",
        isTinted: isTinted ?? false,
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

    return NextResponse.json(serialiseVariant(variant), { status: 201 });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json(
        { error: "A color variant with this product, name, and base type already exists" },
        { status: 409 },
      );
    }
    console.error("POST /colors error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
