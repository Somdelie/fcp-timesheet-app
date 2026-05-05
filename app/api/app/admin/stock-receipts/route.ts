import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ConfirmItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  note: z.string().optional(),
});

const ConfirmReceiptSchema = z.object({
  reference: z.string().min(1),
  vendorName: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(ConfirmItemSchema).min(1),
});

export async function GET() {
  await requireAuth({ roles: ["ADMIN"] });

  const receipts = await prisma.stockReceipt.findMany({
    orderBy: { receivedAt: "desc" },
    include: {
      items: {
        include: { product: { select: { id: true, name: true, category: true } } },
      },
    },
  });

  return NextResponse.json(receipts);
}

export async function POST(req: NextRequest) {
  await requireAuth({ roles: ["ADMIN"] });

  const body = await req.json().catch(() => null);
  const parsed = ConfirmReceiptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { reference, vendorName, notes, items } = parsed.data;

  const productIds = items.map((i) => i.productId);
  const existingProducts = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true },
  });
  const existingIds = new Set(existingProducts.map((p) => p.id));
  const missing = productIds.filter((id) => !existingIds.has(id));
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Unknown product IDs: ${missing.join(", ")}` },
      { status: 400 },
    );
  }

  const receipt = await prisma.$transaction(async (tx) => {
    const rec = await tx.stockReceipt.create({
      data: {
        reference,
        vendorName: vendorName ?? null,
        notes: notes ?? null,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            note: item.note ?? null,
          })),
        },
      },
      include: {
        items: { include: { product: { select: { id: true, name: true } } } },
      },
    });

    for (const item of items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stockQty: { increment: item.quantity } },
      });
    }

    return rec;
  });

  return NextResponse.json(receipt, { status: 201 });
}
