import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/apiAuth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "DELETE, OPTIONS",
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
    // ignore
  }

  return null;
}

/**
 * DELETE /api/app/admin/deductions/:id
 * Remove a deduction. Only allowed if the linked timesheet is not PAID.
 * If the deduction was from an order, revert the order to PENDING.
 */
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await getAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS },
      );
    }

    const { id } = await ctx.params;

    const deduction = await prisma.deduction.findUnique({
      where: { id },
      select: {
        id: true,
        orderItemId: true,
        timesheet: { select: { status: true } },
        orderItem: { select: { orderId: true } },
      },
    });

    if (!deduction) {
      return NextResponse.json(
        { error: "Deduction not found" },
        { status: 404, headers: CORS_HEADERS },
      );
    }

    // Block deletion if timesheet is PAID
    if (deduction.timesheet?.status === "PAID") {
      return NextResponse.json(
        { error: "Cannot delete deduction — timesheet is already paid" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    // If deduction was from an order item, check if we should revert order to PENDING
    const orderId = deduction.orderItem?.orderId ?? null;

    await prisma.deduction.delete({ where: { id } });

    // If this deduction came from an order, check remaining deductions for that order
    if (orderId) {
      const remainingDeductions = await prisma.deduction.count({
        where: {
          orderItem: { orderId },
        },
      });

      // If no more deductions exist for this order, revert to PENDING
      if (remainingDeductions === 0) {
        await prisma.productOrder.update({
          where: { id: orderId },
          data: { status: "PENDING" },
        });
      } else {
        // Some items still have deductions — mark as PARTIALLY_APPLIED
        await prisma.productOrder.update({
          where: { id: orderId },
          data: { status: "PARTIALLY_APPLIED" },
        });
      }
    }

    return NextResponse.json(
      { ok: true, deleted: true },
      { headers: CORS_HEADERS },
    );
  } catch (e: any) {
    console.error("/api/app/admin/deductions DELETE error", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
