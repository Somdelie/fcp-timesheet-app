import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

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
  const apiCtx = await requireApiAuth(req, ["ADMIN", "OFFICE"]);
  if (apiCtx) {
    return { id: apiCtx.user.sub, role: apiCtx.user.role as string } as const;
  }

  try {
    const session = await getServerSession(authOptions);
    if (session?.user && (session.user as any).id) {
      const role = (session.user as any).role as string | undefined;
      if (role === "ADMIN" || role === "OFFICE") {
        return {
          id: (session.user as any).id as string,
          role,
        } as const;
      }
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * DELETE /api/app/admin/orders/:itemId
 * Cancel an order. If the order was APPLIED, also delete linked deductions
 * (only if the related timesheet is not PAID).
 */
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ itemId: string }> },
) {
  try {
    const admin = await getAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS },
      );
    }

    const { itemId } = await ctx.params;

    const order = await prisma.productOrder.findUnique({
      where: { id: itemId },
      include: {
        items: {
          include: {
            deductions: {
              select: {
                id: true,
                timesheet: { select: { status: true } },
              },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404, headers: CORS_HEADERS },
      );
    }

    // Already-cancelled orders: hard delete immediately
    if (order.status === "CANCELLED") {
      await prisma.productOrder.delete({ where: { id: itemId } });
      return NextResponse.json(
        { ok: true, deleted: true },
        { headers: CORS_HEADERS },
      );
    }

    // Active orders: check for paid deductions before cancelling
    const linkedDeductions = order.items.flatMap((i) => i.deductions);
    const hasPaidDeduction = linkedDeductions.some(
      (d) => d.timesheet?.status === "PAID",
    );

    if (hasPaidDeduction) {
      return NextResponse.json(
        { error: "Cannot cancel order — some deductions are on a paid timesheet" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    // Delete linked deductions then soft-cancel
    if (linkedDeductions.length > 0) {
      await prisma.deduction.deleteMany({
        where: { id: { in: linkedDeductions.map((d) => d.id) } },
      });
    }

    await prisma.productOrder.update({
      where: { id: itemId },
      data: { status: "CANCELLED" },
    });

    return NextResponse.json(
      { ok: true, cancelled: true },
      { headers: CORS_HEADERS },
    );
  } catch (e: any) {
    console.error("/api/app/admin/orders DELETE error", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
