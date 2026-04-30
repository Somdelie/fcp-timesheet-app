import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { category, item, quantity, condition, holderId, location, notes } = body;

  if (!category || !item || quantity == null || !condition) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const created = await prisma.equipmentItem.create({
    data: {
      category: String(category).trim(),
      item: String(item).trim(),
      quantity: Number(quantity),
      condition: String(condition),
      holderId: holderId ?? null,
      location: location ? String(location).trim() : null,
      notes: notes ? String(notes).trim() : null,
    },
    include: { holder: true },
  });

  return NextResponse.json({ item: created }, { status: 201 });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await prisma.equipmentItem.findMany({
    include: { holder: true },
    orderBy: [{ category: "asc" }, { item: "asc" }],
  });

  const holders = await prisma.equipmentHolder.findMany({
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ items, holders });
}
