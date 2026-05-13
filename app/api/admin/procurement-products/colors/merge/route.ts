import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canMergeColorVariants } from "@/lib/product-color-parser";

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
 * POST /api/admin/procurement-products/colors/merge
 * Body: { variantIds: string[], targetId: string }
 *
 * Safety rules:
 *   - All variants must belong to the same product
 *   - All variants must have the same baseType
 *   - Deep vs Pastel / White vs Clear / etc. are refused
 *   - Supplier prices are re-pointed to targetId before the others are deleted
 */
export async function POST(req: Request) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { variantIds, targetId } = body as {
    variantIds: string[];
    targetId: string;
  };

  if (!Array.isArray(variantIds) || variantIds.length < 2) {
    return NextResponse.json(
      { error: "At least 2 variantIds required" },
      { status: 400 },
    );
  }

  if (!targetId || !variantIds.includes(targetId)) {
    return NextResponse.json(
      { error: "targetId must be one of the variantIds" },
      { status: 400 },
    );
  }

  const variants = await prisma.productColorVariant.findMany({
    where: { id: { in: variantIds } },
    select: {
      id: true,
      productId: true,
      colorName: true,
      baseType: true,
    },
  });

  if (variants.length !== variantIds.length) {
    return NextResponse.json(
      { error: "One or more color variants not found" },
      { status: 404 },
    );
  }

  // All must belong to the same product
  const productIds = new Set(variants.map((v) => v.productId));
  if (productIds.size > 1) {
    return NextResponse.json(
      { error: "Cannot merge color variants from different products" },
      { status: 400 },
    );
  }

  // All must have the same baseType (Deep ≠ Pastel, White ≠ Clear, etc.)
  const baseTypes = new Set(variants.map((v) => v.baseType));
  if (baseTypes.size > 1) {
    return NextResponse.json(
      {
        error:
          "Cannot merge color variants with different base types (e.g. Deep vs Pastel)",
      },
      { status: 400 },
    );
  }

  const target = variants.find((v) => v.id === targetId)!;
  const toMerge = variants.filter((v) => v.id !== targetId);

  // Verify normalized color names match for each pair
  for (const v of toMerge) {
    if (!canMergeColorVariants(target, v)) {
      return NextResponse.json(
        {
          error: `Cannot safely merge "${target.colorName}" (${target.baseType}) with "${v.colorName}" (${v.baseType}) — names differ after normalization`,
        },
        { status: 400 },
      );
    }
  }

  const mergeIds = toMerge.map((v) => v.id);

  await prisma.$transaction(async (tx) => {
    // Re-point all supplier prices to the target variant
    await tx.supplierProductPrice.updateMany({
      where: { colorVariantId: { in: mergeIds } },
      data: { colorVariantId: targetId },
    });

    // Delete the now-empty source variants
    await tx.productColorVariant.deleteMany({
      where: { id: { in: mergeIds } },
    });
  });

  return NextResponse.json({
    ok: true,
    targetId,
    mergedCount: mergeIds.length,
  });
}
