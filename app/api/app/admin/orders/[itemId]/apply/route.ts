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
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
          role: role,
        } as const;
      }
    }
  } catch {
    // ignore
  }

  return null;
}

const ApplyOrderItemSchema = z.object({
  employeeId: z.string().min(1),
  // Splits allow flexible deduction across CURRENT / NEXT periods.
  splits: z
    .array(
      z.object({
        applyTo: z.enum(["CURRENT", "NEXT"]),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
});

// POST /api/app/admin/orders/[itemId]/apply
// Create one or more PRODUCT deductions from an order item, possibly
// splitting quantity across CURRENT/NEXT fortnights.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
  try {
    const { itemId } = await params;
    const admin = await getAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS },
      );
    }

    const json = await req.json().catch(() => null as any);
    const body = ApplyOrderItemSchema.safeParse(json);
    if (!body.success) {
      return NextResponse.json(
        { error: "Invalid payload" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const data = body.data;

    const item = await prisma.productOrderItem.findUnique({
      where: { id: itemId },
      include: {
        order: true,
        deductions: {
          select: { quantity: true, type: true },
        },
      },
    });

    if (!item || !item.order) {
      return NextResponse.json(
        { error: "Order item not found" },
        { status: 404, headers: CORS_HEADERS },
      );
    }

    if (item.order.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Order is cancelled" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const totalQty = item.quantity;
    const usedQty = item.deductions
      .filter((d) => d.type === "PRODUCT")
      .reduce((sum, d) => sum + (d.quantity ?? 0), 0);
    const remainingQty = totalQty - usedQty;

    if (remainingQty <= 0) {
      return NextResponse.json(
        { error: "Order item is already fully applied" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const splitTotal = data.splits.reduce((sum, s) => sum + s.quantity, 0);
    if (splitTotal > remainingQty) {
      return NextResponse.json(
        { error: "Split quantity exceeds remaining item quantity" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create deductions for each split
      const created = [] as any[];

      for (const split of data.splits) {
        const d = await tx.deduction.create({
          data: {
            type: "PRODUCT",
            applyTo: split.applyTo,
            employee: { connect: { id: data.employeeId } },
            foreman: { connect: { id: item.order!.foremanId } },
            createdByUser: { connect: { id: admin.id } },
            product: { connect: { id: item.productId } },
            quantity: split.quantity,
            amount: null,
            orderItem: { connect: { id: item.id } },
          },
          select: {
            id: true,
            type: true,
            applyTo: true,
            employeeId: true,
            foremanId: true,
            productId: true,
            quantity: true,
            createdAt: true,
          },
        });
        created.push(d);
      }

      // Recompute remaining quantity for this item and order status
      const refreshed = await tx.productOrder.findUnique({
        where: { id: item.orderId },
        include: {
          items: {
            include: {
              deductions: { select: { quantity: true, type: true } },
            },
          },
        },
      });

      if (!refreshed) return { created, status: item.order.status };

      let anyUsed = false;
      let anyRemaining = false;

      for (const it of refreshed.items) {
        const used = it.deductions
          .filter((d) => d.type === "PRODUCT")
          .reduce((sum, d) => sum + (d.quantity ?? 0), 0);
        const remaining = it.quantity - used;
        if (used > 0) anyUsed = true;
        if (remaining > 0) anyRemaining = true;
      }

      let newStatus = refreshed.status;
      if (!anyUsed) newStatus = "PENDING";
      else if (anyRemaining) newStatus = "PARTIALLY_APPLIED";
      else newStatus = "APPLIED";

      if (newStatus !== refreshed.status) {
        await tx.productOrder.update({
          where: { id: refreshed.id },
          data: { status: newStatus },
        });
      }

      return { created, status: newStatus };
    });

    return NextResponse.json(
      {
        ok: true,
        status: result.status,
        deductions: result.created,
      },
      { headers: CORS_HEADERS },
    );
  } catch (e: any) {
    console.error("/api/app/admin/orders/[itemId]/apply POST error", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
