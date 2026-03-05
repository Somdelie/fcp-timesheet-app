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
  "Access-Control-Allow-Methods": "PATCH, DELETE, OPTIONS",
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
 * PATCH /api/app/admin/supplier-prices/[id]
 * Body: { price?, startsOn?, endsOn?, isActive? }
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
    const { price, startsOn, endsOn, isActive, uom, unitSize } = body as {
      price?: number | string;
      startsOn?: string;
      endsOn?: string | null;
      isActive?: boolean;
      uom?: string | null;
      unitSize?: number | string | null;
    };

    const data: Record<string, unknown> = {};
    if (price !== undefined) data.price = Number(price);
    if (startsOn !== undefined) data.startsOn = new Date(startsOn);
    if (endsOn !== undefined) data.endsOn = endsOn ? new Date(endsOn) : null;
    if (isActive !== undefined) data.isActive = isActive;
    if (uom !== undefined) data.uom = uom || null;
    if (unitSize !== undefined)
      data.unitSize =
        unitSize != null && unitSize !== "" ? Number(unitSize) : null;

    const updated = await prisma.supplierProductPrice.update({
      where: { id },
      data,
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
          ...updated,
          price: decimalToNumber(updated.price),
          unitSize: updated.unitSize ? decimalToNumber(updated.unitSize) : null,
          product: {
            ...updated.product,
            unitSize: updated.product.unitSize
              ? decimalToNumber(updated.product.unitSize)
              : null,
          },
        },
      },
      { headers: CORS },
    );
  } catch (e: any) {
    if (e?.code === "P2025")
      return NextResponse.json(
        { error: "Price record not found" },
        { status: 404, headers: CORS },
      );
    console.error("PATCH supplier-price error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}

/**
 * DELETE /api/app/admin/supplier-prices/[id]
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

    await prisma.supplierProductPrice.delete({ where: { id } });

    return NextResponse.json({ ok: true }, { headers: CORS });
  } catch (e: any) {
    if (e?.code === "P2025")
      return NextResponse.json(
        { error: "Price record not found" },
        { status: 404, headers: CORS },
      );
    console.error("DELETE supplier-price error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}
