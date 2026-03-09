import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
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
      return { id: p.sub, role: p.role as string };
  }
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (
    session?.user &&
    (role === "ADMIN" || role === "OFFICE" || role === "SUPERVISOR")
  )
    return { id: (session.user as any).id as string, role };
  return null;
}

/**
 * GET /api/app/admin/sites/[id]/materials
 * List all materials assigned to a site.
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

    const materials = await prisma.siteMaterial.findMany({
      where: { siteId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        siteId: true,
        productId: true,
        quantity: true,
        note: true,
        createdAt: true,
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            uom: true,
            unitSize: true,
            category: { select: { id: true, name: true } },
          },
        },
      },
    });

    return NextResponse.json(
      {
        materials: materials.map((m) => ({
          id: m.id,
          siteId: m.siteId,
          productId: m.productId,
          quantity: m.quantity,
          note: m.note,
          createdAt: m.createdAt.toISOString(),
          product: {
            id: m.product.id,
            name: m.product.name,
            sku: m.product.sku,
            uom: m.product.uom,
            unitSize: m.product.unitSize ? Number(m.product.unitSize) : null,
            category: m.product.category,
          },
        })),
      },
      { headers: CORS },
    );
  } catch (err) {
    console.error("GET /sites/[id]/materials error:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}

/**
 * POST /api/app/admin/sites/[id]/materials
 * Add material(s) to a site. Body: { productIds: string[] }
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
    if (auth.role !== "ADMIN" && auth.role !== "SUPERVISOR")
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: CORS },
      );

    const { id: siteId } = await ctx.params;
    const body = await req.json();
    const productIds: string[] = body.productIds;

    if (!Array.isArray(productIds) || productIds.length === 0)
      return NextResponse.json(
        { error: "productIds is required" },
        { status: 400, headers: CORS },
      );

    // Filter out already-added products
    const existing = await prisma.siteMaterial.findMany({
      where: { siteId, productId: { in: productIds } },
      select: { productId: true },
    });
    const existingIds = new Set(existing.map((e) => e.productId));
    const newIds = productIds.filter((pid) => !existingIds.has(pid));

    if (newIds.length === 0)
      return NextResponse.json(
        { error: "All selected products are already added." },
        { status: 409, headers: CORS },
      );

    await prisma.siteMaterial.createMany({
      data: newIds.map((productId) => ({ siteId, productId })),
    });

    return NextResponse.json(
      { ok: true, added: newIds.length },
      { headers: CORS },
    );
  } catch (err) {
    console.error("POST /sites/[id]/materials error:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}

/**
 * PATCH /api/app/admin/sites/[id]/materials
 * Update a material's quantity/note. Body: { materialId: string, quantity?: number|null, note?: string|null }
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
    if (auth.role !== "ADMIN" && auth.role !== "SUPERVISOR")
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: CORS },
      );

    const body = await req.json();
    const materialId = body.materialId;

    if (!materialId)
      return NextResponse.json(
        { error: "materialId is required" },
        { status: 400, headers: CORS },
      );

    const data: Record<string, unknown> = {};
    if ("quantity" in body) data.quantity = body.quantity;
    if ("note" in body) data.note = body.note ? String(body.note).trim() : null;

    await prisma.siteMaterial.update({
      where: { id: materialId },
      data,
    });

    return NextResponse.json({ ok: true }, { headers: CORS });
  } catch (err) {
    console.error("PATCH /sites/[id]/materials error:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}

/**
 * DELETE /api/app/admin/sites/[id]/materials
 * Remove a material from a site. Body: { materialId: string }
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
    if (auth.role !== "ADMIN" && auth.role !== "SUPERVISOR")
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: CORS },
      );

    const body = await req.json();
    const materialId = body.materialId;

    if (!materialId)
      return NextResponse.json(
        { error: "materialId is required" },
        { status: 400, headers: CORS },
      );

    await prisma.siteMaterial.delete({ where: { id: materialId } });

    return NextResponse.json({ ok: true }, { headers: CORS });
  } catch (err) {
    console.error("DELETE /sites/[id]/materials error:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}
