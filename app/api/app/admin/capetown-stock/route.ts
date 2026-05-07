import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await prisma.capeTownStockItem.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: {
      variants: { orderBy: [{ size: "asc" }, { color: "asc" }] },
      deployments: { orderBy: { deployedAt: "desc" }, take: 100 },
      orders: { orderBy: { orderedAt: "desc" }, take: 100 },
    },
  });

  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, category, quantity, unit, notes, sizes = [], colors = [] } = body;

  if (!name?.trim() || !category) {
    return NextResponse.json({ error: "Name and category are required" }, { status: 400 });
  }
  if (!["PPE", "TOOL"].includes(category)) {
    return NextResponse.json({ error: "Category must be PPE or TOOL" }, { status: 400 });
  }

  const cleanSizes = (sizes as string[]).map((s) => s.trim()).filter(Boolean);
  const cleanColors = (colors as string[]).map((c) => c.trim()).filter(Boolean);
  const hasVariants = cleanSizes.length > 0 || cleanColors.length > 0;

  // Build all size × color combinations
  const variantCombos = buildCombos(cleanSizes, cleanColors);

  const item = await prisma.capeTownStockItem.create({
    data: {
      name: String(name).trim(),
      category,
      quantity: hasVariants ? 0 : Math.max(0, Number(quantity) || 0),
      unit: unit ? String(unit).trim() : null,
      notes: notes ? String(notes).trim() : null,
      sizes: cleanSizes,
      colors: cleanColors,
      variants: hasVariants
        ? { create: variantCombos.map(({ size, color }) => ({ size, color, qty: 0 })) }
        : undefined,
    },
    include: {
      variants: { orderBy: [{ size: "asc" }, { color: "asc" }] },
      deployments: true,
      orders: true,
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}

// Build all size × color combinations. If one dimension is empty, use null for that axis.
function buildCombos(sizes: string[], colors: string[]) {
  if (sizes.length === 0 && colors.length === 0) return [];
  if (sizes.length === 0) return colors.map((color) => ({ size: null, color }));
  if (colors.length === 0) return sizes.map((size) => ({ size, color: null }));
  return sizes.flatMap((size) => colors.map((color) => ({ size, color })));
}
