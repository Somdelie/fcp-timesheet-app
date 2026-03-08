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
  "Access-Control-Allow-Methods": "PUT, DELETE, OPTIONS",
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
 * PUT /api/app/admin/overtime-prices/[id]
 * Update an overtime price
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS },
      );

    const { id } = await params;
    const body = await req.json();
    const { label, rate, isActive } = body as {
      label?: string;
      rate?: number;
      isActive?: boolean;
    };

    const existing = await prisma.overtimePrice.findUnique({ where: { id } });
    if (!existing)
      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers: CORS },
      );

    const data: Record<string, unknown> = {};
    if (label !== undefined) data.label = String(label).trim();
    if (rate !== undefined) data.rate = Number(rate);
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    const updated = await prisma.overtimePrice.update({
      where: { id },
      data,
    });

    return NextResponse.json(
      {
        ok: true,
        data: {
          id: updated.id,
          label: updated.label,
          rate: decimalToNumber(updated.rate),
          isActive: updated.isActive,
          createdAt: updated.createdAt.toISOString(),
        },
      },
      { headers: CORS },
    );
  } catch (e: any) {
    console.error("PUT overtime-prices error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}

/**
 * DELETE /api/app/admin/overtime-prices/[id]
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS },
      );

    const { id } = await params;

    const existing = await prisma.overtimePrice.findUnique({ where: { id } });
    if (!existing)
      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers: CORS },
      );

    // Check if there are any overtime entries using this price
    const entryCount = await prisma.overtimeEntry.count({
      where: { overtimePriceId: id },
    });
    if (entryCount > 0) {
      // Soft-delete instead
      await prisma.overtimePrice.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json(
        {
          ok: true,
          message:
            "Price has linked overtime entries — deactivated instead of deleted",
        },
        { headers: CORS },
      );
    }

    await prisma.overtimePrice.delete({ where: { id } });

    return NextResponse.json({ ok: true }, { headers: CORS });
  } catch (e: any) {
    console.error("DELETE overtime-prices error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}
