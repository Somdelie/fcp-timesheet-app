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
  const { qty, deployedTo, notes, size, color } = body;

  if (!qty || Number(qty) <= 0) {
    return NextResponse.json({ error: "Quantity must be greater than 0" }, { status: 400 });
  }
  if (!deployedTo?.trim()) {
    return NextResponse.json({ error: "Deployed to is required" }, { status: 400 });
  }

  const stockItem = await prisma.capeTownStockItem.findUnique({
    where: { id },
    include: { variants: true },
  });
  if (!stockItem) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  const deployQty = Number(qty);
  const hasVariants = stockItem.variants.length > 0;

  if (hasVariants) {
    // Validate size/color selection
    const variant = stockItem.variants.find(
      (v) =>
        (v.size ?? null) === (size ?? null) &&
        (v.color ?? null) === (color ?? null),
    );
    if (!variant) {
      return NextResponse.json({ error: "Variant not found" }, { status: 400 });
    }
    if (deployQty > variant.qty) {
      return NextResponse.json(
        { error: `Only ${variant.qty} in stock for this variant` },
        { status: 400 },
      );
    }

    const [deployment] = await prisma.$transaction([
      prisma.capeTownDeployment.create({
        data: {
          itemId: id,
          qty: deployQty,
          size: size ?? null,
          color: color ?? null,
          deployedTo: String(deployedTo).trim(),
          notes: notes ? String(notes).trim() : null,
        },
      }),
      prisma.capeTownStockVariant.update({
        where: { id: variant.id },
        data: { qty: { decrement: deployQty } },
      }),
      prisma.capeTownStockItem.update({
        where: { id },
        data: { quantity: { decrement: deployQty } },
      }),
    ]);

    return NextResponse.json({ deployment }, { status: 201 });
  }

  // No variants — use total quantity
  if (deployQty > stockItem.quantity) {
    return NextResponse.json(
      { error: `Only ${stockItem.quantity} in stock` },
      { status: 400 },
    );
  }

  const [deployment] = await prisma.$transaction([
    prisma.capeTownDeployment.create({
      data: {
        itemId: id,
        qty: deployQty,
        deployedTo: String(deployedTo).trim(),
        notes: notes ? String(notes).trim() : null,
      },
    }),
    prisma.capeTownStockItem.update({
      where: { id },
      data: { quantity: { decrement: deployQty } },
    }),
  ]);

  return NextResponse.json({ deployment }, { status: 201 });
}
