import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PATCH, DELETE, OPTIONS",
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
 * GET /api/app/admin/suppliers/[id]
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

    const { id } = await ctx.params;

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        products: {
          where: { isActive: true },
          select: { id: true, name: true, uom: true, unitSize: true },
          orderBy: { name: "asc" },
        },
        supplierProductPrices: {
          where: { isActive: true },
          include: {
            product: {
              select: { id: true, name: true, uom: true, unitSize: true },
            },
          },
          orderBy: { startsOn: "desc" },
        },
        _count: { select: { orders: true } },
      },
    });

    if (!supplier)
      return NextResponse.json(
        { error: "Supplier not found" },
        { status: 404, headers: CORS },
      );

    return NextResponse.json({ ok: true, data: supplier }, { headers: CORS });
  } catch (e: any) {
    console.error("GET supplier error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}

/**
 * PATCH /api/app/admin/suppliers/[id]
 * Body: { name?, phone?, email?, address?, isActive? }
 */
export async function PATCH(
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

    const { id } = await ctx.params;
    const body = await req.json();
    const { name, phone, email, address, isActive } = body as {
      name?: string;
      phone?: string | null;
      email?: string | null;
      address?: string | null;
      isActive?: boolean;
    };

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name.trim();
    if (phone !== undefined) data.phone = phone?.trim() || null;
    if (email !== undefined) data.email = email?.trim() || null;
    if (address !== undefined) data.address = address?.trim() || null;
    if (isActive !== undefined) data.isActive = isActive;

    const updated = await prisma.supplier.update({ where: { id }, data });

    return NextResponse.json({ ok: true, data: updated }, { headers: CORS });
  } catch (e: any) {
    if (e?.code === "P2025")
      return NextResponse.json(
        { error: "Supplier not found" },
        { status: 404, headers: CORS },
      );
    if (e?.code === "P2002")
      return NextResponse.json(
        { error: "A supplier with that name already exists" },
        { status: 409, headers: CORS },
      );
    console.error("PATCH supplier error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}

/**
 * DELETE /api/app/admin/suppliers/[id]
 */
export async function DELETE(
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

    const { id } = await ctx.params;

    await prisma.supplier.delete({ where: { id } });

    return NextResponse.json({ ok: true }, { headers: CORS });
  } catch (e: any) {
    if (e?.code === "P2025")
      return NextResponse.json(
        { error: "Supplier not found" },
        { status: 404, headers: CORS },
      );
    console.error("DELETE supplier error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}
