import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAuth() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (session?.user && (role === "ADMIN" || role === "OFFICE")) {
    return {
      id: (session.user as any).id as string,
      role: role as "ADMIN" | "OFFICE",
    };
  }
  return null;
}

/**
 * GET /api/admin/procurement-products/colors/dedup
 * Returns deduplicated colors (unique by colorName + baseType) and the list
 * of products that include each color.
 */
export async function GET() {
  const auth = await getAuth();
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch all variants with product lightweight info and supplier
  const variants = await prisma.productColorVariant.findMany({
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          category: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
          supplierPrices: {
            where: { isActive: true },
            select: {
              supplier: { select: { id: true, name: true } },
            },
            take: 1,
          },
        },
      },
    },
    orderBy: [{ colorName: "asc" }, { baseType: "asc" }],
  });

  // Deduplicate by colorName + baseType
  const map = new Map<string, any>();
  for (const v of variants) {
    const key = `${v.colorName.trim().toLowerCase()}||${v.baseType}`;
    const entry = map.get(key);

    // Determine supplier name (prefer active supplier price, then product.supplier)
    const supplierFromPrice = v.product.supplierPrices?.[0]?.supplier;
    const supplier = supplierFromPrice ?? v.product.supplier ?? null;

    if (!entry) {
      map.set(key, {
        colorName: v.colorName,
        baseType: v.baseType,
        colorCode: v.colorCode ?? null,
        isTinted: !!v.isTinted,
        supplier: supplier,
        products: [
          {
            id: v.product.id,
            name: v.product.name,
            sku: v.product.sku ?? null,
            category: v.product.category ?? null,
          },
        ],
      });
    } else {
      // push product if not already present
      const exists = entry.products.some((p: any) => p.id === v.product.id);
      if (!exists)
        entry.products.push({
          id: v.product.id,
          name: v.product.name,
          sku: v.product.sku ?? null,
          category: v.product.category ?? null,
        });
      // fill colorCode if missing
      if (!entry.colorCode && v.colorCode) entry.colorCode = v.colorCode;
      if (!entry.isTinted && v.isTinted) entry.isTinted = true;
      // update supplier if current entry is null and new one is present
      if (!entry.supplier && supplier) entry.supplier = supplier;
    }
  }

  const deduped = Array.from(map.values()).map((c) => ({
    ...c,
    productCount: c.products.length,
  }));

  return NextResponse.json(deduped);
}
