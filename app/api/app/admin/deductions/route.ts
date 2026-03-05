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
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

const CreateDeductionSchema = z.object({
  employeeId: z.string().min(1),
  foremanId: z.string().min(1),
  type: z.enum(["CASH", "PRODUCT"]),
  applyTo: z.enum(["CURRENT", "NEXT"]).optional().default("CURRENT"),
  // PRODUCT (manual)
  productId: z.string().min(1).optional(),
  quantity: z.number().int().positive().optional(),
  // PRODUCT (from order) — creates deductions for all items in the order
  orderId: z.string().min(1).optional(),
  // Split order deduction across fortnights (1 = full this fortnight, 2 = half now + half next)
  splitFortnights: z.number().int().min(1).max(2).optional().default(1),
  // CASH or manual amount override
  amount: z.union([z.string(), z.number()]).optional(),
  note: z.string().max(2000).optional(),
});

function parseMoneyToDecimalString(v: unknown) {
  const s = String(v ?? "")
    .trim()
    .replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n.toFixed(2);
}

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
    const body = CreateDeductionSchema.safeParse(json);

    if (!body.success) {
      return NextResponse.json(
        { error: "Invalid payload" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const data = body.data;

    // Ensure employee & foreman exist (lightweight safety checks)
    const [employee, foreman] = await Promise.all([
      prisma.employee.findUnique({
        where: { id: data.employeeId },
        select: { id: true, firstName: true, lastName: true },
      }),
      prisma.foreman.findUnique({
        where: { id: data.foremanId },
        select: { id: true },
      }),
    ]);

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404, headers: CORS_HEADERS },
      );
    }
    if (!foreman) {
      return NextResponse.json(
        { error: "Foreman not found" },
        { status: 404, headers: CORS_HEADERS },
      );
    }

    let amountDecimal: string | null = null;
    let productId: string | null = null;
    let quantity: number | null = null;

    if (data.type === "PRODUCT" && data.orderId) {
      // ── ORDER-BASED DEDUCTION ──────────────────────────────────
      // Create one deduction per order item and mark the order APPLIED
      const order = await prisma.productOrder.findUnique({
        where: { id: data.orderId },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, price: true } },
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
      if (order.foremanId !== data.foremanId) {
        return NextResponse.json(
          { error: "Order does not belong to this foreman" },
          { status: 400, headers: CORS_HEADERS },
        );
      }
      if (order.status !== "PENDING") {
        return NextResponse.json(
          { error: "Order has already been applied or cancelled" },
          { status: 400, headers: CORS_HEADERS },
        );
      }

      const splitFortnights = data.splitFortnights ?? 1;
      const createdDeductions = [];
      for (const item of order.items) {
        const priceNum = Number(
          (item.unitPrice as any).toString?.() ?? item.unitPrice,
        );
        const fullAmount = priceNum * item.quantity;

        if (splitFortnights === 2) {
          // Split: half CURRENT, half NEXT
          const half1 = Math.floor(fullAmount * 100) / 200; // first half (floor)
          const half2 = fullAmount - half1; // remainder gets any rounding cent
          const money1 = parseMoneyToDecimalString(half1);
          const money2 = parseMoneyToDecimalString(half2);
          const noteBase =
            data.note?.trim() ||
            `Order #${order.id.slice(-6)} – ${item.product?.name ?? "product"}`;

          for (const [applyTo, money] of [
            ["CURRENT", money1],
            ["NEXT", money2],
          ] as const) {
            const d = await prisma.deduction.create({
              data: {
                type: "PRODUCT",
                applyTo,
                employee: { connect: { id: data.employeeId } },
                foreman: { connect: { id: data.foremanId } },
                createdByUser: { connect: { id: admin.id } },
                product: { connect: { id: item.productId } },
                quantity: item.quantity,
                amount: money as any,
                orderItem: { connect: { id: item.id } },
                note: `${noteBase} (${applyTo === "CURRENT" ? "1/2" : "2/2"})`,
              },
              select: {
                id: true,
                type: true,
                applyTo: true,
                employeeId: true,
                foremanId: true,
                productId: true,
                quantity: true,
                amount: true,
                note: true,
                createdAt: true,
              },
            });
            createdDeductions.push(d);
          }
        } else {
          // Full deduction in chose fortnight
          const money = parseMoneyToDecimalString(fullAmount);
          const d = await prisma.deduction.create({
            data: {
              type: "PRODUCT",
              applyTo: data.applyTo ?? "CURRENT",
              employee: { connect: { id: data.employeeId } },
              foreman: { connect: { id: data.foremanId } },
              createdByUser: { connect: { id: admin.id } },
              product: { connect: { id: item.productId } },
              quantity: item.quantity,
              amount: money as any,
              orderItem: { connect: { id: item.id } },
              note:
                data.note?.trim() ||
                `Order #${order.id.slice(-6)} – ${item.product?.name ?? "product"}`,
            },
            select: {
              id: true,
              type: true,
              applyTo: true,
              employeeId: true,
              foremanId: true,
              productId: true,
              quantity: true,
              amount: true,
              note: true,
              createdAt: true,
            },
          });
          createdDeductions.push(d);
        }
      }

      // Mark order as applied
      await prisma.productOrder.update({
        where: { id: order.id },
        data: { status: "APPLIED" },
      });

      return NextResponse.json(
        {
          ok: true,
          deductions: createdDeductions.map((d) => ({
            ...d,
            amount: d.amount?.toString?.() ?? String(d.amount ?? "0"),
          })),
          orderApplied: order.id,
        },
        { headers: CORS_HEADERS },
      );
    } else if (data.type === "PRODUCT") {
      // ── MANUAL PRODUCT DEDUCTION ───────────────────────────────
      if (!data.productId || !data.quantity) {
        return NextResponse.json(
          { error: "productId and quantity are required for PRODUCT" },
          { status: 400, headers: CORS_HEADERS },
        );
      }

      const product = await prisma.product.findUnique({
        where: { id: data.productId },
        select: { id: true, price: true, isActive: true },
      });

      if (!product || !product.isActive) {
        return NextResponse.json(
          { error: "Product not found or inactive" },
          { status: 400, headers: CORS_HEADERS },
        );
      }

      const priceNum = Number(
        (product.price as any).toString?.() ?? product.price,
      );
      const qty = data.quantity;
      const rawTotal = priceNum * qty;
      const money = parseMoneyToDecimalString(rawTotal);
      if (!money) {
        return NextResponse.json(
          { error: "Invalid derived amount for product deduction" },
          { status: 400, headers: CORS_HEADERS },
        );
      }

      amountDecimal = money;
      productId = product.id;
      quantity = qty;
    } else {
      const money = parseMoneyToDecimalString(data.amount);
      if (!money) {
        return NextResponse.json(
          { error: "amount is required and must be > 0 for CASH" },
          { status: 400, headers: CORS_HEADERS },
        );
      }
      amountDecimal = money;
    }

    const created = await prisma.deduction.create({
      data: {
        type: data.type,
        applyTo: data.applyTo ?? "CURRENT",
        employee: { connect: { id: data.employeeId } },
        foreman: { connect: { id: data.foremanId } },
        createdByUser: { connect: { id: admin.id } },
        product: productId ? { connect: { id: productId } } : undefined,
        quantity: quantity ?? undefined,
        amount: amountDecimal as any,
        note: data.note?.trim() || undefined,
      },
      select: {
        id: true,
        type: true,
        applyTo: true,
        employeeId: true,
        foremanId: true,
        createdByUserId: true,
        productId: true,
        quantity: true,
        amount: true,
        note: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        deduction: {
          ...created,
          amount: created.amount?.toString?.() ?? String(created.amount ?? "0"),
        },
      },
      { headers: CORS_HEADERS },
    );
  } catch (e: any) {
    console.error("/api/app/admin/deductions POST error", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}

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
    const employeeId = (url.searchParams.get("employeeId") ?? "").trim();
    const foremanId = (url.searchParams.get("foremanId") ?? "").trim();
    const type = (url.searchParams.get("type") ?? "").trim();
    const applyTo = (url.searchParams.get("applyTo") ?? "").trim();
    const startISO = (url.searchParams.get("startISO") ?? "").trim();
    const endISO = (url.searchParams.get("endISO") ?? "").trim();

    const where: any = {};

    if (employeeId) where.employeeId = employeeId;
    if (foremanId) where.foremanId = foremanId;
    if (type === "CASH" || type === "PRODUCT") where.type = type;
    if (applyTo === "CURRENT" || applyTo === "NEXT") where.applyTo = applyTo;

    if (startISO || endISO) {
      const createdAt: any = {};
      if (startISO) {
        const d = new Date(`${startISO}T00:00:00.000Z`);
        if (!Number.isNaN(d.getTime())) createdAt.gte = d;
      }
      if (endISO) {
        const d = new Date(`${endISO}T23:59:59.999Z`);
        if (!Number.isNaN(d.getTime())) createdAt.lte = d;
      }
      if (Object.keys(createdAt).length > 0) {
        where.createdAt = createdAt;
      }
    }

    const rows = await prisma.deduction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        foreman: {
          select: {
            id: true,
            user: { select: { name: true } },
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            price: true,
          },
        },
        createdByUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const list = rows.map((r) => ({
      id: r.id,
      type: r.type,
      applyTo: r.applyTo,
      employee: {
        id: r.employee.id,
        name: `${r.employee.firstName} ${r.employee.lastName}`.trim(),
      },
      foreman: {
        id: r.foreman.id,
        name: r.foreman.user?.name ?? "Foreman",
      },
      product: r.product
        ? {
            id: r.product.id,
            name: r.product.name,
            price:
              (r.product.price as any).toString?.() ??
              String(r.product.price ?? "0"),
          }
        : null,
      quantity: r.quantity,
      amount: r.amount?.toString?.() ?? String(r.amount ?? "0"),
      note: r.note ?? null,
      createdAt: r.createdAt.toISOString(),
      createdBy: r.createdByUser
        ? {
            id: r.createdByUser.id,
            name: r.createdByUser.name ?? r.createdByUser.email ?? "User",
          }
        : null,
    }));

    return NextResponse.json(
      {
        ok: true,
        deductions: list,
      },
      { headers: CORS_HEADERS },
    );
  } catch (e: any) {
    console.error("/api/app/admin/deductions GET error", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
