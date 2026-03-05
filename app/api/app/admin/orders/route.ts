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
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}

async function getAdminFromRequest(req: NextRequest) {
  const apiCtx = await requireApiAuth(req, ["ADMIN", "OFFICE"]);
  if (apiCtx) {
    return { id: apiCtx.user.sub, role: apiCtx.user.role as string } as const;
  }

  try {
    const session = await getServerSession(authOptions);
    if (session?.user && (session.user as any).id) {
      const role = (session.user as any).role as string | undefined;
      if (role === "ADMIN" || role === "OFFICE") {
        return {
          id: (session.user as any).id as string,
          role: role,
        } as const;
      }
    }
  } catch {
    // ignore
  }

  return null;
}

const CreateOrderSchema = z.object({
  foremanId: z.string().min(1),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
        note: z.string().max(2000).optional(),
      }),
    )
    .min(1),
});

// POST /api/app/admin/orders
// Create a new product order for a foreman
export async function POST(req: NextRequest) {
  try {
    const admin = await getAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS },
      );
    }

    const json = await req.json().catch(() => null as any);
    const body = CreateOrderSchema.safeParse(json);
    if (!body.success) {
      return NextResponse.json(
        { error: "Invalid payload" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const data = body.data;

    const foreman = await prisma.foreman.findUnique({
      where: { id: data.foremanId },
      select: { id: true },
    });
    if (!foreman) {
      return NextResponse.json(
        { error: "Foreman not found" },
        { status: 404, headers: CORS_HEADERS },
      );
    }

    const productIds = Array.from(new Set(data.items.map((i) => i.productId)));
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, price: true, isActive: true },
    });

    if (products.length !== productIds.length) {
      return NextResponse.json(
        { error: "One or more products not found" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const productsById = new Map(products.map((p) => [p.id, p] as const));

    const order = await prisma.productOrder.create({
      data: {
        foreman: { connect: { id: data.foremanId } },
        createdByUser: { connect: { id: admin.id } },
        status: "PENDING",
      },
    });

    const items = [] as {
      id: string;
      productId: string;
      quantity: number;
      unitPrice: any;
      note: string | null;
    }[];

    for (const item of data.items) {
      const p = productsById.get(item.productId)!;
      const priceNum = Number((p.price as any).toString?.() ?? p.price);
      const createdItem = await prisma.productOrderItem.create({
        data: {
          order: { connect: { id: order.id } },
          product: { connect: { id: item.productId } },
          quantity: item.quantity,
          unitPrice: priceNum as any,
          note: item.note?.trim() || undefined,
        },
        select: {
          id: true,
          productId: true,
          quantity: true,
          unitPrice: true,
          note: true,
        },
      });
      items.push(createdItem);
    }

    // Orders stay PENDING until deductions are created from the timesheet
    // deduction workflow

    return NextResponse.json(
      {
        ok: true,
        order: {
          id: order.id,
          foremanId: order.foremanId,
          status: order.status,
          createdAt: order.createdAt.toISOString(),
          items: items.map((i) => ({
            id: i.id,
            productId: i.productId,
            quantity: i.quantity,
            unitPrice:
              (i.unitPrice as any).toString?.() ?? String(i.unitPrice ?? "0"),
            note: i.note ?? null,
          })),
        },
      },
      { headers: CORS_HEADERS },
    );
  } catch (e: any) {
    console.error("/api/app/admin/orders POST error", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}

// GET /api/app/admin/orders
// List orders by foreman/status/date range
export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS },
      );
    }

    const url = new URL(req.url);
    const foremanId = (url.searchParams.get("foremanId") ?? "").trim();
    const status = (url.searchParams.get("status") ?? "").trim();
    const startISO = (url.searchParams.get("startISO") ?? "").trim();
    const endISO = (url.searchParams.get("endISO") ?? "").trim();

    const where: any = {};
    if (foremanId) where.foremanId = foremanId;
    if (
      status &&
      ["PENDING", "PARTIALLY_APPLIED", "APPLIED", "CANCELLED"].includes(status)
    ) {
      where.status = status as any;
    }

    if (startISO || endISO) {
      const createdAt: any = {};
      if (startISO) {
        const d = new Date(`${startISO}T00:00:00.000Z`);
        if (!Number.isNaN(d.getTime())) createdAt.gte = d;
      }
      if (endISO) {
        const d = new Date(`${endISO}T23:59:59.999Z`);
        if (!Number.isNaN(d.getTime())) createdAt.lte = d;
      }
      if (Object.keys(createdAt).length > 0) where.createdAt = createdAt;
    }

    const rows = await prisma.productOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        foreman: {
          select: { user: { select: { name: true, email: true } } },
        },
        items: {
          include: {
            product: { select: { name: true } },
            deductions: {
              select: {
                id: true,
                applyTo: true,
                quantity: true,
                amount: true,
              },
            },
          },
        },
      },
    });

    const list = rows.map((o) => ({
      id: o.id,
      foremanId: o.foremanId,
      foremanName: o.foreman?.user?.name ?? o.foreman?.user?.email ?? "Unknown",
      status: o.status,
      createdAt: o.createdAt.toISOString(),
      items: o.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        productName: i.product?.name ?? "Product",
        quantity: i.quantity,
        unitPrice:
          (i.unitPrice as any).toString?.() ?? String(i.unitPrice ?? "0"),
        note: i.note ?? null,
        deductions: i.deductions.map((d) => ({
          id: d.id,
          applyTo: d.applyTo,
          quantity: d.quantity,
          amount: d.amount
            ? ((d.amount as any).toString?.() ?? String(d.amount ?? "0"))
            : null,
        })),
      })),
    }));

    return NextResponse.json(
      { ok: true, orders: list },
      { headers: CORS_HEADERS },
    );
  } catch (e: any) {
    console.error("/api/app/admin/orders GET error", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
