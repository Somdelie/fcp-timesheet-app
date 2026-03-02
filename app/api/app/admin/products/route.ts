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
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}

async function getAdminFromRequest(req: NextRequest) {
  // 1) Prefer API token auth (Expo/Electron/other API clients)
  const apiCtx = await requireApiAuth(req, ["ADMIN"]);
  if (apiCtx) {
    return { id: apiCtx.user.sub, role: apiCtx.user.role as string } as const;
  }

  // 2) Fallback to NextAuth session for web admin UI
  try {
    const session = await getServerSession(authOptions);
    if (session?.user && (session.user as any).id) {
      const role = (session.user as any).role as string | undefined;
      if (role === "ADMIN") {
        return {
          id: (session.user as any).id as string,
          role: role,
        } as const;
      }
    }
  } catch {
    // Ignore session errors and fall through to unauthorized
  }

  return null;
}

const CreateProductSchema = z.object({
  name: z.string().min(1).max(200),
  price: z.union([z.string(), z.number()]),
});

const UpdateProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  price: z.union([z.string(), z.number()]).optional(),
  isActive: z.boolean().optional(),
});

const DeleteProductSchema = z.object({
  id: z.string().min(1),
});

// GET /api/app/admin/products
// List active products for use in deductions, etc.
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
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const includeInactive = url.searchParams.get("includeInactive") === "true";

    const where: any = {};
    if (!includeInactive) {
      where.isActive = true;
    }

    if (q) {
      where.name = { contains: q, mode: "insensitive" };
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        price: true,
        isActive: true,
      },
    });

    const list = products.map((p) => ({
      id: p.id,
      name: p.name,
      price: (p.price as any).toString?.() ?? String(p.price ?? "0"),
      isActive: p.isActive,
    }));

    return NextResponse.json(
      {
        ok: true,
        products: list,
      },
      { headers: CORS_HEADERS },
    );
  } catch (e: any) {
    console.error("/api/app/admin/products GET error", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}

// POST /api/app/admin/products
// Create a new product (admin only)
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
    const body = CreateProductSchema.safeParse(json);

    if (!body.success) {
      return NextResponse.json(
        { error: "Invalid payload" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const data = body.data;
    const priceNum = Number(String(data.price).replace(",", "."));
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      return NextResponse.json(
        { error: "Price must be a positive number" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const created = await prisma.product.create({
      data: {
        name: data.name.trim(),
        price: priceNum as any,
        isActive: true,
      },
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
          id: created.id,
          name: created.name,
          price:
            (created.price as any).toString?.() ?? String(created.price ?? "0"),
          isActive: created.isActive,
        },
      },
      { headers: CORS_HEADERS },
    );
  } catch (e: any) {
    console.error("/api/app/admin/products POST error", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}

// PATCH /api/app/admin/products
// Update a product (name, price, isActive)
export async function PATCH(req: NextRequest) {
  try {
    const admin = await getAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS },
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

    const { id, name, price, isActive } = body.data;

    // Build update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (price !== undefined) {
      const priceNum = Number(String(price).replace(",", "."));
      if (!Number.isFinite(priceNum) || priceNum <= 0) {
        return NextResponse.json(
          { error: "Price must be a positive number" },
          { status: 400, headers: CORS_HEADERS },
        );
      }
      updateData.price = priceNum as any;
    }
    if (isActive !== undefined) updateData.isActive = isActive;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "Nothing to update" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const updated = await prisma.product.update({
      where: { id },
      data: updateData,
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
    console.error("/api/app/admin/products PATCH error", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}

// DELETE /api/app/admin/products
// Permanently delete a product
export async function DELETE(req: NextRequest) {
  try {
    const admin = await getAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS },
      );
    }

    const json = await req.json().catch(() => null as any);
    const body = DeleteProductSchema.safeParse(json);

    if (!body.success) {
      return NextResponse.json(
        { error: "Invalid payload – id is required" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    await prisma.product.delete({ where: { id: body.data.id } });

    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
  } catch (e: any) {
    console.error("/api/app/admin/products DELETE error", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
