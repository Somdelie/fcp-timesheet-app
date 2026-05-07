import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAuth(req: Request) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (session?.user && role === "ADMIN")
    return { id: (session.user as any).id as string, role };
  return null;
}

/**
 * POST /api/app/admin/ppe-orders/[id]/deductions
 * Body: { employeeId, foremanId, splitOverride?: 1|2, applyTo?: "CURRENT"|"NEXT" }
 *
 * Creates CASH deductions for each deductible item in the PPE order, then
 * marks the order as ISSUED.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await ctx.params;
    const body = await req.json();
    const {
      employeeId,
      foremanId,
      splitOverride,
      applyTo = "CURRENT",
    } = body as {
      employeeId: string;
      foremanId: string;
      splitOverride?: 1 | 2;
      applyTo?: "CURRENT" | "NEXT";
    };

    if (!employeeId) return NextResponse.json({ error: "employeeId is required" }, { status: 400 });
    if (!foremanId) return NextResponse.json({ error: "foremanId is required" }, { status: 400 });

    const order = await prisma.foremanPpeOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                isDeductible: true,
                deductionSplits: true,
                supplierPrices: {
                  where: { isActive: true },
                  select: { price: true, supplierId: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.status === "CANCELLED") {
      return NextResponse.json({ error: "Cannot create deductions for a cancelled order" }, { status: 400 });
    }

    const [employee, foreman] = await Promise.all([
      prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } }),
      prisma.foreman.findUnique({ where: { id: foremanId }, select: { id: true } }),
    ]);
    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    if (!foreman) return NextResponse.json({ error: "Foreman not found" }, { status: 404 });

    const created: any[] = [];
    const shortId = id.slice(-6).toUpperCase();

    for (const item of order.items) {
      const product = item.product as any;
      if (!product.isDeductible) continue;

      const priceEntry = product.supplierPrices?.[0];
      if (!priceEntry) continue;

      const unitPrice = Number((priceEntry.price as any).toString?.() ?? priceEntry.price);
      if (!unitPrice || unitPrice <= 0) continue;

      const fullAmount = unitPrice * item.quantity;
      const splits: 1 | 2 = splitOverride ?? (product.deductionSplits === 2 ? 2 : 1);

      const variantLabel = [item.size, item.color].filter(Boolean).join("/");
      const noteBase = `PPE Order #${shortId} — ${product.name}${variantLabel ? ` (${variantLabel})` : ""}`;

      if (splits === 2) {
        const half1 = Math.floor(fullAmount * 100) / 200;
        const half2 = fullAmount - half1;

        for (const [fort, amt] of [["CURRENT", half1], ["NEXT", half2]] as const) {
          const d = await prisma.deduction.create({
            data: {
              type: "CASH",
              applyTo: fort,
              employee: { connect: { id: employeeId } },
              foreman: { connect: { id: foremanId } },
              createdByUser: { connect: { id: auth.id } },
              amount: amt.toFixed(2) as any,
              note: `${noteBase} (${fort === "CURRENT" ? "1/2" : "2/2"})`,
            },
            select: { id: true, type: true, applyTo: true, amount: true, note: true, createdAt: true },
          });
          created.push({ ...d, amount: d.amount?.toString?.() ?? String(d.amount ?? "0") });
        }
      } else {
        const d = await prisma.deduction.create({
          data: {
            type: "CASH",
            applyTo,
            employee: { connect: { id: employeeId } },
            foreman: { connect: { id: foremanId } },
            createdByUser: { connect: { id: auth.id } },
            amount: fullAmount.toFixed(2) as any,
            note: noteBase,
          },
          select: { id: true, type: true, applyTo: true, amount: true, note: true, createdAt: true },
        });
        created.push({ ...d, amount: d.amount?.toString?.() ?? String(d.amount ?? "0") });
      }
    }

    // Mark order as FULFILLED
    await prisma.foremanPpeOrder.update({
      where: { id },
      data: { status: "FULFILLED" },
    });

    return NextResponse.json({ ok: true, deductions: created, orderIssued: id }, { status: 201 });
  } catch (e: any) {
    console.error("POST ppe-orders/[id]/deductions error:", e);
    return NextResponse.json({ error: e?.message ?? "Internal error" }, { status: 500 });
  }
}
