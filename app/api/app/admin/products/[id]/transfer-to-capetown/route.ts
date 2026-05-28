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
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
    const user = session?.user as { id?: string; role?: string } | undefined;
    if (user?.id && (user.role === "ADMIN" || user.role === "OFFICE")) {
      return { id: user.id, role: user.role } as const;
    }
  } catch {}

  return null;
}

const TransferSchema = z.object({
  qty: z.number().int().min(1),
  size: z.string().trim().min(1).nullable().optional(),
  color: z.string().trim().min(1).nullable().optional(),
  notes: z.string().trim().max(500).optional().nullable(),
});

function sameVariant(
  value: { size: string | null; color: string | null },
  size: string | null,
  color: string | null,
) {
  return (value.size ?? null) === size && (value.color ?? null) === color;
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await getAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
    }

    const { id } = await params;
    const json = await req.json().catch(() => null as unknown);
    const parsed = TransferSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid transfer details" }, { status: 400, headers: CORS_HEADERS });
    }

    const qty = parsed.data.qty;
    const size = parsed.data.size || null;
    const color = parsed.data.color || null;
    const notes = parsed.data.notes || null;

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id },
        include: { variants: true },
      });

      if (!product || !product.isActive || product.category !== "PPE") {
        throw new Error("PPE product not found");
      }

      const hasVariants = product.variants.length > 0;

      if (hasVariants) {
        const sourceVariant = product.variants.find((variant) => sameVariant(variant, size, color));
        if (!sourceVariant) throw new Error("Selected JHB variant was not found");
        if (sourceVariant.qty < qty) {
          throw new Error(`Only ${sourceVariant.qty} available in JHB for this variant`);
        }

        await tx.stockItemVariant.update({
          where: { id: sourceVariant.id },
          data: { qty: { decrement: qty } },
        });
      } else {
        if (product.stockQty < qty) throw new Error(`Only ${product.stockQty} available in JHB`);
      }

      await tx.product.update({
        where: { id: product.id },
        data: { stockQty: { decrement: qty } },
      });

      let capeTownItem = await tx.capeTownStockItem.findFirst({
        where: {
          category: "PPE",
          isActive: true,
          name: { equals: product.name, mode: "insensitive" },
        },
        include: { variants: true },
      });

      if (!capeTownItem) {
        capeTownItem = await tx.capeTownStockItem.create({
          data: {
            name: product.name,
            category: "PPE",
            quantity: 0,
            unit: "pcs",
            notes: notes ? `Transferred from JHB: ${notes}` : "Transferred from JHB",
            sizes: product.sizes ?? [],
            colors: product.colors ?? [],
            variants: hasVariants
              ? {
                  create: product.variants.map((variant) => ({
                    size: variant.size,
                    color: variant.color,
                    qty: 0,
                  })),
                }
              : undefined,
          },
          include: { variants: true },
        });
      } else if (hasVariants) {
        const sizes = uniqueValues([...capeTownItem.sizes, ...(product.sizes ?? []), ...(size ? [size] : [])]);
        const colors = uniqueValues([...capeTownItem.colors, ...(product.colors ?? []), ...(color ? [color] : [])]);

        await tx.capeTownStockItem.update({
          where: { id: capeTownItem.id },
          data: { sizes, colors },
        });

        const existingTargetKeys = new Set(
          capeTownItem.variants.map((variant) => `${variant.size ?? ""}\x00${variant.color ?? ""}`),
        );
        const missingVariants = product.variants.filter(
          (variant) => !existingTargetKeys.has(`${variant.size ?? ""}\x00${variant.color ?? ""}`),
        );

        if (missingVariants.length > 0) {
          await tx.capeTownStockVariant.createMany({
            data: missingVariants.map((variant) => ({
              itemId: capeTownItem!.id,
              size: variant.size,
              color: variant.color,
              qty: 0,
            })),
            skipDuplicates: true,
          });
        }

        capeTownItem = await tx.capeTownStockItem.findUniqueOrThrow({
          where: { id: capeTownItem.id },
          include: { variants: true },
        });
      }

      if (hasVariants) {
        let targetVariant = capeTownItem.variants.find((variant) => sameVariant(variant, size, color));
        if (!targetVariant) {
          targetVariant = await tx.capeTownStockVariant.create({
            data: { itemId: capeTownItem.id, size, color, qty: 0 },
          });
        }

        await tx.capeTownStockVariant.update({
          where: { id: targetVariant.id },
          data: { qty: { increment: qty } },
        });
      }

      const item = await tx.capeTownStockItem.update({
        where: { id: capeTownItem.id },
        data: { quantity: { increment: qty } },
      });

      return { productId: product.id, capeTownItemId: item.id, qty };
    });

    return NextResponse.json({ ok: true, transfer: result }, { headers: CORS_HEADERS });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to transfer stock";
    const status = /not found/i.test(message) ? 404 : /only|variant|invalid/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status, headers: CORS_HEADERS });
  }
}
