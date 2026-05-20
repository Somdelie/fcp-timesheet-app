import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";

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
 * GET /api/app/admin/suppliers
 * Query: ?q=search&includeInactive=true
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
    const includeInactive = url.searchParams.get("includeInactive") === "true";

    const rawLimit = url.searchParams.get("limit");
    const rawPage = url.searchParams.get("page");

    const MAX_LIMIT = 500;
    const DEFAULT_LIMIT = 100;

    let limit = Number(rawLimit ?? DEFAULT_LIMIT);
    if (!Number.isFinite(limit) || limit <= 0) limit = DEFAULT_LIMIT;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;

    let page = Number(rawPage ?? 1);
    if (!Number.isFinite(page) || page < 1) page = 1;

    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (!includeInactive) where.isActive = true;
    if (q) where.name = { contains: q, mode: "insensitive" };

    const [total, suppliers] = await Promise.all([
      prisma.supplier.count({ where }),
      prisma.supplier.findMany({
        where,
        orderBy: { name: "asc" },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          address: true,
          isActive: true,
          createdAt: true,
          parentSupplierId: true,
          parentSupplier: {
            select: { id: true, name: true },
          },
          _count: { select: { products: true, orders: true } },
        },
      }),
    ]);

    const hasMore = skip + suppliers.length < total;

    return NextResponse.json(
      { ok: true, data: suppliers, page, limit, total, hasMore },
      { headers: CORS },
    );
  } catch (e: any) {
    console.error("GET suppliers error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}

/**
 * POST /api/app/admin/suppliers
 * Body: { name, phone?, email?, address?, parentSupplierId? }
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
    const { name, phone, email, address, parentSupplierId } = body as {
      name: string;
      phone?: string;
      email?: string;
      address?: string;
      parentSupplierId?: string | null;
    };

    if (!name || !name.trim())
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400, headers: CORS },
      );

    const supplier = await prisma.supplier.create({
      data: {
        name: name.trim(),
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        parentSupplierId: parentSupplierId || null,
      },
    });

    return NextResponse.json(
      { ok: true, data: supplier },
      { status: 201, headers: CORS },
    );
  } catch (e: any) {
    if (e?.code === "P2002")
      return NextResponse.json(
        { error: "A supplier with that name already exists" },
        { status: 409, headers: CORS },
      );
    console.error("POST suppliers error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}
