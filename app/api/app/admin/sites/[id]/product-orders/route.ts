import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { decimalToNumber } from "@/lib/dateUtc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

async function getAuth(req: Request) {
  const h = req.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : null;
  if (token) {
    const p = await verifyApiToken(token);
    if (
      p &&
      (p.role === "ADMIN" || p.role === "OFFICE" || p.role === "SUPERVISOR")
    )
      return { id: p.sub, role: p.role as "ADMIN" | "OFFICE" | "SUPERVISOR" };
  }
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (
    session?.user &&
    (role === "ADMIN" || role === "OFFICE" || role === "SUPERVISOR")
  )
    return {
      id: (session.user as any).id as string,
      role: role as "ADMIN" | "OFFICE" | "SUPERVISOR",
    };
  return null;
}

/**
 * GET /api/app/admin/sites/[id]/product-orders
 * List product orders for a site, with optional date filtering.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS },
      );

    const { id: siteId } = await ctx.params;
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const where: Record<string, unknown> = { siteId };
    if (from || to) {
      const createdAt: Record<string, unknown> = {};
      if (from) createdAt.gte = new Date(`${from}T00:00:00.000Z`);
      if (to) createdAt.lt = new Date(`${to}T23:59:59.999Z`);
      where.createdAt = createdAt;
    }

    const orders = await prisma.siteProductOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        supplier: { select: { id: true, name: true } },
        createdByUser: { select: { id: true, name: true } },
        items: {
          include: {
            product: {
              select: { id: true, name: true, uom: true, unitSize: true },
            },
          },
        },
      },
    });

    const data = orders.map((o) => ({
      ...o,
      totalCost: o.totalCost ? decimalToNumber(o.totalCost) : null,
      items: o.items.map((i) => ({
        ...i,
        unitPriceAtOrder: decimalToNumber(i.unitPriceAtOrder),
        unitSizeAtOrder: i.unitSizeAtOrder
          ? decimalToNumber(i.unitSizeAtOrder)
          : null,
        product: {
          ...i.product,
          unitSize: i.product.unitSize
            ? decimalToNumber(i.product.unitSize)
            : null,
        },
      })),
    }));

    return NextResponse.json({ ok: true, data }, { headers: CORS });
  } catch (e: any) {
    console.error("GET product-orders error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}

/**
 * POST /api/app/admin/sites/[id]/product-orders
 * Create a new product order for the site (header only – items added separately).
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS },
      );

    const { id: siteId } = await ctx.params;
    const body = await req.json();
    const { supplierId, reference, note } = body as {
      supplierId?: string;
      reference?: string;
      note?: string;
    };

    const order = await prisma.siteProductOrder.create({
      data: {
        site: { connect: { id: siteId } },
        supplier: supplierId ? { connect: { id: supplierId } } : undefined,
        createdByUser: { connect: { id: auth.id } },
        reference: reference || null,
        note: note || null,
      },
    });

    return NextResponse.json(
      { ok: true, data: order },
      { status: 201, headers: CORS },
    );
  } catch (e: any) {
    console.error("POST product-orders error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}
