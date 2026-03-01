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
  "Access-Control-Allow-Methods": "GET, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}

async function getAdminFromRequest(req: NextRequest) {
  const apiCtx = await requireApiAuth(req, ["ADMIN"]);
  if (apiCtx) {
    return { id: apiCtx.user.sub, role: apiCtx.user.role as string } as const;
  }

  try {
    const session = await getServerSession(authOptions);
    if (session?.user && (session.user as any).id) {
      const role = (session.user as any).role as string | undefined;
      if (role === "ADMIN") {
        return {
          id: (session.user as any).id as string,
          role,
        } as const;
      }
    }
  } catch {
    // fall through
  }

  return null;
}

const UpdateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  price: z.union([z.string(), z.number()]).optional(),
  isActive: z.boolean().optional(),
});

// PATCH /api/app/admin/products/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await getAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS },
      );
    }

    const { id } = await params;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404, headers: CORS_HEADERS },
      );
    }

    const json = await req.json().catch(() => null as any);
    const body = UpdateProductSchema.safeParse(json);

    if (!body.success) {
      return NextResponse.json(
        { error: "Invalid payload" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const data: any = {};
    if (body.data.name !== undefined) {
      data.name = body.data.name.trim();
    }
    if (body.data.price !== undefined) {
      const priceNum = Number(String(body.data.price).replace(",", "."));
      if (!Number.isFinite(priceNum) || priceNum <= 0) {
        return NextResponse.json(
          { error: "Price must be a positive number" },
          { status: 400, headers: CORS_HEADERS },
        );
      }
      data.price = priceNum as any;
    }
    if (body.data.isActive !== undefined) {
      data.isActive = body.data.isActive;
    }

    const updated = await prisma.product.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        price: true,
        isActive: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        product: {
          id: updated.id,
          name: updated.name,
          price:
            (updated.price as any).toString?.() ?? String(updated.price ?? "0"),
          isActive: updated.isActive,
        },
      },
      { headers: CORS_HEADERS },
    );
  } catch (e: any) {
    console.error("/api/app/admin/products/[id] PATCH error", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}

// DELETE /api/app/admin/products/[id]
// Soft-delete: marks as inactive
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await getAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS },
      );
    }

    const { id } = await params;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404, headers: CORS_HEADERS },
      );
    }

    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
  } catch (e: any) {
    console.error("/api/app/admin/products/[id] DELETE error", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
