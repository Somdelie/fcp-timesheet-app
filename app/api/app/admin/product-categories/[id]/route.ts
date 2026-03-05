import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";

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
 * PATCH /api/app/admin/product-categories/[id]
 * Body: { name }
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
    const { name } = body as { name?: string };

    if (!name || !name.trim())
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400, headers: CORS },
      );

    const updated = await prisma.productCategory.update({
      where: { id },
      data: { name: name.trim() },
    });

    return NextResponse.json({ ok: true, data: updated }, { headers: CORS });
  } catch (e: any) {
    if (e?.code === "P2025")
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404, headers: CORS },
      );
    console.error("PATCH product-category error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}

/**
 * DELETE /api/app/admin/product-categories/[id]
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

    await prisma.productCategory.delete({ where: { id } });

    return NextResponse.json({ ok: true }, { headers: CORS });
  } catch (e: any) {
    if (e?.code === "P2025")
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404, headers: CORS },
      );
    console.error("DELETE product-category error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}
