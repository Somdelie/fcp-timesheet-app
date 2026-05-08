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
        return { id: (session.user as any).id as string, role } as const;
      }
    }
  } catch {
    // ignore
  }

  return null;
}

// Either foremanId OR adminUserId must be provided (not both, not neither)
const CreateOrderSchema = z
  .object({
    foremanId: z.string().min(1).optional(),
    adminUserId: z.string().min(1).optional(),
    items: z
      .array(
        z.object({
          productId: z.string().min(1),
          quantity: z.number().int().positive(),
          size: z.string().max(100).optional(),
          color: z.string().max(100).optional(),
          note: z.string().max(2000).optional(),
        }),
      )
      .min(1),
  })
  .refine((d) => !!(d.foremanId ?? d.adminUserId), {
    message: "Either foremanId or adminUserId is required",
  });

// POST /api/app/admin/orders
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
        { error: body.error.issues[0]?.message ?? "Invalid payload" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const data = body.data;

    // Validate the target (foreman or admin)
    if (data.foremanId) {
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
    } else if (data.adminUserId) {
      const user = await prisma.user.findUnique({
        where: { id: data.adminUserId },
        select: { id: true, role: true },
      });
      if (!user || !["ADMIN", "OFFICE"].includes(user.role)) {
        return NextResponse.json(
          { error: "Admin user not found" },
          { status: 404, headers: CORS_HEADERS },
        );
      }
    }

    const productIds = Array.from(new Set(data.items.map((i) => i.productId)));
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, price: true, isActive: true, category: true },
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
        ...(data.foremanId
          ? { foreman: { connect: { id: data.foremanId } } }
          : {}),
        ...(data.adminUserId
          ? { adminUser: { connect: { id: data.adminUserId } } }
          : {}),
        createdByUser: { connect: { id: admin.id } },
        status: "PENDING",
      },
    });

    const items = [] as {
      id: string;
      productId: string;
      quantity: number;
      unitPrice: any;
      size: string | null;
      color: string | null;
      note: string | null;
    }[];

    for (const item of data.items) {
      const p = productsById.get(item.productId)!;
      const priceNum = Number((p.price as any).toString?.() ?? p.price);
      const normalizedSize = item.size?.trim() || null;
      const normalizedColor = item.color?.trim() || null;
      const createdItem = await prisma.productOrderItem.create({
        data: {
          order: { connect: { id: order.id } },
          product: { connect: { id: item.productId } },
          quantity: item.quantity,
          unitPrice: priceNum as any,
          size: normalizedSize,
          color: normalizedColor,
          note: item.note?.trim() || undefined,
        },
        select: {
          id: true,
          productId: true,
          quantity: true,
          unitPrice: true,
          size: true,
          color: true,
          note: true,
        },
      });
      items.push(createdItem);

      if (p.category === "PPE") {
        await prisma.product.update({
          where: { id: item.productId },
          data: { stockQty: { decrement: item.quantity } },
        });
        if (normalizedSize !== null || normalizedColor !== null) {
          await prisma.stockItemVariant.updateMany({
            where: {
              productId: item.productId,
              size: normalizedSize,
              color: normalizedColor,
            },
            data: { qty: { decrement: item.quantity } },
          });
        }
      }
    }

    return NextResponse.json(
      {
        ok: true,
        order: {
          id: order.id,
          foremanId: order.foremanId,
          adminUserId: order.adminUserId,
          status: order.status,
          createdAt: order.createdAt.toISOString(),
          items: items.map((i) => ({
            id: i.id,
            productId: i.productId,
            quantity: i.quantity,
            unitPrice:
              (i.unitPrice as any).toString?.() ?? String(i.unitPrice ?? "0"),
            size: i.size ?? null,
            color: i.color ?? null,
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
    const adminUserId = (url.searchParams.get("adminUserId") ?? "").trim();
    const status = (url.searchParams.get("status") ?? "").trim();
    const category = (url.searchParams.get("category") ?? "").trim();
    const startISO = (url.searchParams.get("startISO") ?? "").trim();
    const endISO = (url.searchParams.get("endISO") ?? "").trim();

    const where: any = {};
    if (foremanId) where.foremanId = foremanId;
    if (adminUserId) where.adminUserId = adminUserId;
    if (
      status &&
      [
        "PENDING",
        "COLLECTED",
        "DEDUCTED",
        "PARTIALLY_APPLIED",
        "APPLIED",
        "CANCELLED",
      ].includes(status)
    ) {
      where.status = status as any;
    }
    if (category && ["PPE", "TOOL"].includes(category)) {
      where.items = { some: { product: { category: category as any } } };
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
        foreman: { select: { user: { select: { name: true, email: true } } } },
        adminUser: { select: { name: true, email: true } },
        items: {
          include: {
            product: { select: { name: true, category: true } },
            deductions: {
              select: { id: true, applyTo: true, quantity: true, amount: true },
            },
          },
        },
      },
    });

    const list = rows.map((o) => {
      const isAdmin = !o.foremanId && !!o.adminUserId;
      const personName = isAdmin
        ? (o.adminUser?.name ?? o.adminUser?.email ?? "Admin")
        : (o.foreman?.user?.name ?? o.foreman?.user?.email ?? "Unknown");

      return {
        id: o.id,
        foremanId: o.foremanId,
        adminUserId: o.adminUserId,
        isAdminOrder: isAdmin,
        foremanName: personName,
        status: o.status,
        createdAt: o.createdAt.toISOString(),
        items: o.items.map((i) => ({
          id: i.id,
          productId: i.productId,
          productName: i.product?.name ?? "Product",
          productCategory: i.product?.category ?? null,
          quantity: i.quantity,
          unitPrice:
            (i.unitPrice as any).toString?.() ?? String(i.unitPrice ?? "0"),
          size: i.size ?? null,
          color: i.color ?? null,
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
      };
    });

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
