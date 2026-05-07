import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { PpeOrderStatus } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAuth(req: Request) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (session?.user && (role === "ADMIN" || role === "OFFICE" || role === "SUPERVISOR"))
    return { id: (session.user as any).id as string, role };
  return null;
}

const itemInclude = {
  product: {
    select: {
      id: true,
      name: true,
      thumbnailUrl: true,
      colors: true,
      isDeductible: true,
      deductionSplits: true,
      supplierPrices: {
        where: { isActive: true },
        select: { price: true, supplierId: true },
        take: 1,
      },
    },
  },
};

const orderInclude = {
  foreman: { include: { user: { select: { id: true, name: true } } } },
  site: { select: { id: true, name: true, code: true } },
  createdByUser: { select: { id: true, name: true } },
  items: { include: itemInclude },
};

/** GET /api/app/admin/ppe-orders?foremanId=&siteId=&status= */
export async function GET(req: Request) {
  try {
    const auth = await getAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const foremanId = url.searchParams.get("foremanId");
    const siteId = url.searchParams.get("siteId");
    const status = url.searchParams.get("status") as PpeOrderStatus | null;

    const where: Record<string, unknown> = {};
    if (foremanId) where.foremanId = foremanId;
    if (siteId) where.siteId = siteId;
    if (status) where.status = status;

    const rows = await prisma.foremanPpeOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: orderInclude,
    });

    return NextResponse.json({ ok: true, data: rows });
  } catch (e: any) {
    console.error("GET ppe-orders error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/** POST /api/app/admin/ppe-orders */
export async function POST(req: Request) {
  try {
    const auth = await getAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { foremanId, siteId, note, items } = body as {
      foremanId: string;
      siteId?: string;
      note?: string;
      items: { productId: string; quantity: number; size?: string; color?: string; note?: string }[];
    };

    if (!foremanId) return NextResponse.json({ error: "foremanId is required" }, { status: 400 });
    if (!items?.length) return NextResponse.json({ error: "At least one item is required" }, { status: 400 });

    const order = await prisma.foremanPpeOrder.create({
      data: {
        foremanId,
        siteId: siteId || null,
        note: note?.trim() || null,
        createdByUserId: auth.id,
        status: "PENDING",
        items: {
          create: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            size: i.size?.trim() || null,
            color: i.color?.trim() || null,
            note: i.note?.trim() || null,
          })),
        },
      },
      include: orderInclude,
    });

    return NextResponse.json({ ok: true, data: order }, { status: 201 });
  } catch (e: any) {
    console.error("POST ppe-orders error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
