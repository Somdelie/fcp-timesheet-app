import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { qty, supplier, notes, size, color } = body;

  if (!qty || Number(qty) <= 0) {
    return NextResponse.json({ error: "Quantity must be greater than 0" }, { status: 400 });
  }

  const exists = await prisma.capeTownStockItem.findUnique({
    where: { id },
    include: { variants: true },
  });
  if (!exists) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  // If item has variants, validate the combination exists
  if (exists.variants.length > 0) {
    const variant = exists.variants.find(
      (v) =>
        (v.size ?? null) === (size ?? null) &&
        (v.color ?? null) === (color ?? null),
    );
    if (!variant) {
      return NextResponse.json({ error: "Variant not found" }, { status: 400 });
    }
  }

  const order = await prisma.capeTownStockOrder.create({
    data: {
      itemId: id,
      qty: Number(qty),
      size: size ?? null,
      color: color ?? null,
      supplier: supplier ? String(supplier).trim() : null,
      notes: notes ? String(notes).trim() : null,
      status: "PENDING",
    },
  });

  return NextResponse.json({ order }, { status: 201 });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: itemId } = await params;
  const body = await req.json();
  const { orderId, status } = body;

  if (!orderId || !status) {
    return NextResponse.json({ error: "orderId and status are required" }, { status: 400 });
  }

  const validStatuses = ["PENDING", "ORDERED", "RECEIVED", "CANCELLED"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const existingOrder = await prisma.capeTownStockOrder.findFirst({
    where: { id: orderId, itemId },
  });
  if (!existingOrder) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // Marking RECEIVED: add qty to the correct variant (or total)
  if (status === "RECEIVED" && existingOrder.status !== "RECEIVED") {
    const stockItem = await prisma.capeTownStockItem.findUnique({
      where: { id: itemId },
      include: { variants: true },
    });

    if (stockItem && stockItem.variants.length > 0) {
      const variant = stockItem.variants.find(
        (v) =>
          (v.size ?? null) === (existingOrder.size ?? null) &&
          (v.color ?? null) === (existingOrder.color ?? null),
      );
      if (variant) {
        await prisma.$transaction([
          prisma.capeTownStockOrder.update({ where: { id: orderId }, data: { status } }),
          prisma.capeTownStockVariant.update({
            where: { id: variant.id },
            data: { qty: { increment: existingOrder.qty } },
          }),
          prisma.capeTownStockItem.update({
            where: { id: itemId },
            data: { quantity: { increment: existingOrder.qty } },
          }),
        ]);
        const order = await prisma.capeTownStockOrder.findUnique({ where: { id: orderId } });
        return NextResponse.json({ order });
      }
    } else {
      await prisma.$transaction([
        prisma.capeTownStockOrder.update({ where: { id: orderId }, data: { status } }),
        prisma.capeTownStockItem.update({
          where: { id: itemId },
          data: { quantity: { increment: existingOrder.qty } },
        }),
      ]);
      const order = await prisma.capeTownStockOrder.findUnique({ where: { id: orderId } });
      return NextResponse.json({ order });
    }
  }

  const order = await prisma.capeTownStockOrder.update({
    where: { id: orderId },
    data: { status },
  });

  return NextResponse.json({ order });
}
