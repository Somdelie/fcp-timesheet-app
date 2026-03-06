import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { decimalToNumber } from "@/lib/dateUtc";
import type { ProductUom } from "@/generated/prisma/client";

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

function serialise(p: any) {
  return {
    ...p,
    unitSize: p.unitSize ? decimalToNumber(p.unitSize) : null,
  };
}

/**
 * GET /api/app/admin/procurement-products
 * Query: ?q=search&categoryId=xxx&supplierId=xxx&includeInactive=true
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
    const q = (url.searchParams.get("q") ?? "").trim();
    const categoryId = url.searchParams.get("categoryId");
    const supplierId = url.searchParams.get("supplierId");
    const includeInactive = url.searchParams.get("includeInactive") === "true";

    const where: Record<string, unknown> = {};
    if (!includeInactive) where.isActive = true;
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
      ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (supplierId) where.supplierId = supplierId;

    const products = await prisma.procurementProduct.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        _count: { select: { orderItems: true, supplierPrices: true } },
      },
    });

    return NextResponse.json(
      { ok: true, data: products.map(serialise) },
      { headers: CORS },
    );
  } catch (e: any) {
    console.error("GET procurement-products error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}

/**
 * POST /api/app/admin/procurement-products
 * Body: { name, sku?, categoryId?, uom, unitSize?, description?, supplierId? }
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
    const { name, sku, categoryId, uom, unitSize, description, supplierId } =
      body as {
        name: string;
        sku?: string;
        categoryId?: string;
        uom?: ProductUom;
        unitSize?: number | string;
        description?: string;
        supplierId?: string;
      };

    if (!name?.trim())
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400, headers: CORS },
      );

    const product = await prisma.procurementProduct.create({
      data: {
        name: name.trim(),
        sku: sku?.trim() || null,
        category: categoryId ? { connect: { id: categoryId } } : undefined,
        uom: uom || null,
        unitSize: unitSize != null ? Number(unitSize) : null,
        description: description?.trim() || null,
        supplier: supplierId ? { connect: { id: supplierId } } : undefined,
      },
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(
      { ok: true, data: serialise(product) },
      { status: 201, headers: CORS },
    );
  } catch (e: any) {
    if (e?.code === "P2002" && e?.meta?.target?.includes("sku"))
      return NextResponse.json(
        { error: "A product with that SKU already exists" },
        { status: 409, headers: CORS },
      );
    console.error("POST procurement-products error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}
