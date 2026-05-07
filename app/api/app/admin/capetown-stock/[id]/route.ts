import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { name, quantity, unit, notes, sizes, colors } = body;

  const existing = await prisma.capeTownStockItem.findUnique({
    where: { id },
    include: { variants: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const cleanSizes = sizes !== undefined
    ? (sizes as string[]).map((s) => s.trim()).filter(Boolean)
    : existing.sizes;
  const cleanColors = colors !== undefined
    ? (colors as string[]).map((c) => c.trim()).filter(Boolean)
    : existing.colors;

  // If sizes or colors changed, sync variants
  if (sizes !== undefined || colors !== undefined) {
    const combos = buildCombos(cleanSizes, cleanColors);
    const existingKeys = new Set(existing.variants.map((v) => variantKey(v.size, v.color)));
    const newKeys = combos.map(({ size, color }) => variantKey(size, color));

    // Create missing combos
    const toCreate = combos.filter(({ size, color }) => !existingKeys.has(variantKey(size, color)));
    // Remove variants no longer in the combo (only if qty is 0 to avoid data loss)
    const toDelete = existing.variants.filter(
      (v) => !newKeys.includes(variantKey(v.size, v.color)) && v.qty === 0,
    );

    if (toCreate.length > 0) {
      await prisma.capeTownStockVariant.createMany({
        data: toCreate.map(({ size, color }) => ({ itemId: id, size, color, qty: 0 })),
      });
    }
    if (toDelete.length > 0) {
      await prisma.capeTownStockVariant.deleteMany({
        where: { id: { in: toDelete.map((v) => v.id) } },
      });
    }
  }

  const item = await prisma.capeTownStockItem.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: String(name).trim() }),
      ...(quantity !== undefined && cleanSizes.length === 0 && cleanColors.length === 0 && {
        quantity: Math.max(0, Number(quantity)),
      }),
      ...(unit !== undefined && { unit: unit ? String(unit).trim() : null }),
      ...(notes !== undefined && { notes: notes ? String(notes).trim() : null }),
      ...(sizes !== undefined && { sizes: cleanSizes }),
      ...(colors !== undefined && { colors: cleanColors }),
    },
    include: {
      variants: { orderBy: [{ size: "asc" }, { color: "asc" }] },
      deployments: { orderBy: { deployedAt: "desc" }, take: 100 },
      orders: { orderBy: { orderedAt: "desc" }, take: 100 },
    },
  });

  return NextResponse.json({ item });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.capeTownStockItem.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}

function buildCombos(sizes: string[], colors: string[]) {
  if (sizes.length === 0 && colors.length === 0) return [];
  if (sizes.length === 0) return colors.map((color) => ({ size: null as string | null, color }));
  if (colors.length === 0) return sizes.map((size) => ({ size, color: null as string | null }));
  return sizes.flatMap((size) => colors.map((color) => ({ size, color })));
}

function variantKey(size: string | null | undefined, color: string | null | undefined) {
  return `${size ?? "__"}||${color ?? "__"}`;
}
