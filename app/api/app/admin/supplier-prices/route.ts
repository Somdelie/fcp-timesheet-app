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

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

async function getAuth(req: Request) {
  const h = req.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : null;
  if (token) {
    const p = await verifyApiToken(token);
    if (p && (p.role === "ADMIN" || p.role === "OFFICE"))
      return { id: p.sub, role: p.role as "ADMIN" | "OFFICE" };
  }
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (session?.user && (role === "ADMIN" || role === "OFFICE"))
    return {
      id: (session.user as any).id as string,
      role: role as "ADMIN" | "OFFICE",
    };
  return null;
}

/**
 * GET /api/app/admin/supplier-prices
 * Query: ?productId=xxx&supplierId=xxx&includeInactive=true
 * Returns all supplier prices, filterable by product or supplier.
 */
export async function GET(req: Request) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS },
      );

    const url = new URL(req.url);
    const productId = url.searchParams.get("productId");
    const supplierId = url.searchParams.get("supplierId");
    const includeInactive = url.searchParams.get("includeInactive") === "true";

    const where: Record<string, unknown> = {};
    if (!includeInactive) where.isActive = true;
    if (productId) where.productId = productId;
    if (supplierId) where.supplierId = supplierId;

    const prices = await prisma.supplierProductPrice.findMany({
      where,
      orderBy: { startsOn: "desc" },
      include: {
        supplier: { select: { id: true, name: true } },
        product: {
          select: { id: true, name: true, uom: true, unitSize: true },
        },
      },
    });

    const data = prices.map((p) => ({
      ...p,
      price: decimalToNumber(p.price),
      unitSize: p.unitSize ? decimalToNumber(p.unitSize) : null,
      product: {
        ...p.product,
        unitSize: p.product.unitSize
          ? decimalToNumber(p.product.unitSize)
          : null,
      },
    }));

    return NextResponse.json({ ok: true, data }, { headers: CORS });
  } catch (e: any) {
    console.error("GET supplier-prices error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}

/**
 * POST /api/app/admin/supplier-prices
 * Body: { supplierId, productId, price, startsOn?, endsOn? }
 */
export async function POST(req: Request) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS },
      );

    const body = await req.json();
    const { supplierId, productId, price, startsOn, endsOn, uom, unitSize } =
      body as {
        supplierId: string;
        productId: string;
        price: number | string;
        startsOn?: string;
        endsOn?: string;
        uom?: string;
        unitSize?: number | string | null;
      };

    if (!supplierId || !productId)
      return NextResponse.json(
        { error: "supplierId and productId are required" },
        { status: 400, headers: CORS },
      );
    if (price == null || Number(price) < 0)
      return NextResponse.json(
        { error: "price must be a non-negative number" },
        { status: 400, headers: CORS },
      );

    const record = await prisma.supplierProductPrice.create({
      data: {
        supplier: { connect: { id: supplierId } },
        product: { connect: { id: productId } },
        price: Number(price),
        uom: (uom as any) || null,
        unitSize: unitSize != null && unitSize !== "" ? Number(unitSize) : null,
        startsOn: startsOn ? new Date(startsOn) : new Date(),
        endsOn: endsOn ? new Date(endsOn) : null,
      },
      include: {
        supplier: { select: { id: true, name: true } },
        product: {
          select: { id: true, name: true, uom: true, unitSize: true },
        },
      },
    });

    return NextResponse.json(
      {
        ok: true,
        data: {
          ...record,
          price: decimalToNumber(record.price),
          unitSize: record.unitSize ? decimalToNumber(record.unitSize) : null,
          product: {
            ...record.product,
            unitSize: record.product.unitSize
              ? decimalToNumber(record.product.unitSize)
              : null,
          },
        },
      },
      { status: 201, headers: CORS },
    );
  } catch (e: any) {
    console.error("POST supplier-prices error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}
