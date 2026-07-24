import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { decimalToNumber } from "@/lib/dateUtc";
import {
  ensureSiteMaterialsForProducts,
  resolveUnitPrice,
  recalcOrderTotal,
  resolveCatalogueProduct,
} from "@/lib/procurement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
      return { id: p.sub, role: p.role as "ADMIN" | "OFFICE" | "SUPERVISOR" };
  }

  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (
    session?.user &&
    (role === "ADMIN" || role === "OFFICE" || role === "SUPERVISOR")
  )
    return {
      id: (session.user as any).id as string,
      role: role as "ADMIN" | "OFFICE" | "SUPERVISOR",
    };

  return null;
}

export async function GET(req: Request) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS },
      );

    const url = new URL(req.url);
    const siteId = url.searchParams.get("siteId");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const where: Record<string, unknown> = {};
    if (siteId) where.siteId = siteId;
    if (from || to) {
      const createdAt: Record<string, unknown> = {};
      if (from) createdAt.gte = new Date(`${from}T00:00:00.000Z`);
      if (to) createdAt.lt = new Date(`${to}T23:59:59.999Z`);
      where.createdAt = createdAt;
    }

    const orders = await prisma.siteProductOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        site: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        createdByUser: { select: { id: true, name: true } },
        items: {
          include: {
            product: {
              include: {
                masterCatalogueProduct: {
                  select: {
                    id: true,
                    name: true,
                    sku: true,
                    uom: true,
                    unitSize: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const data = orders.map((o) => ({
      id: o.id,
      siteId: o.siteId,
      siteName: o.site.name,
      supplierId: o.supplierId,
      supplierName: o.supplier?.name ?? null,
      createdBy: o.createdByUser?.name ?? null,
      reference: o.reference,
      note: o.note,
      totalCost: o.totalCost ? decimalToNumber(o.totalCost) : null,
      createdAt: o.createdAt.toISOString(),
      items: o.items.map((i) => {
        const master = i.product.masterCatalogueProduct;
        return {
          id: i.id,
          productId: i.productId,
          masterCatalogueProductId: master?.id ?? null,
          productName: master?.name ?? i.product.name,
          sku: master?.sku ?? i.product.sku,
          quantity: i.quantity,
          unitPriceAtOrder: decimalToNumber(i.unitPriceAtOrder),
          uomAtOrder: i.uomAtOrder,
          unitSizeAtOrder: i.unitSizeAtOrder
            ? decimalToNumber(i.unitSizeAtOrder)
            : null,
          note: i.note,
        };
      }),
    }));

    return NextResponse.json({ ok: true, data }, { headers: CORS });
  } catch (e: any) {
    console.error("GET material-orders error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS },
      );

    const user = await prisma.user.findUnique({
      where: { id: auth.id },
      select: { id: true },
    });
    if (!user)
      return NextResponse.json(
        { error: "User not found for current auth" },
        { status: 401, headers: CORS },
      );

    const body = await req.json();
    const { siteId, supplierId, reference, note, items } = body as {
      siteId: string;
      supplierId?: string;
      reference?: string;
      note?: string;
      items: {
        productId: string;
        quantity: number;
        unitPrice?: number | string | null;
        uom?: string;
        unitSize?: number | string | null;
        note?: string;
      }[];
    };

    if (!siteId)
      return NextResponse.json(
        { error: "siteId is required" },
        { status: 400, headers: CORS },
      );

    if (!Array.isArray(items) || items.length === 0)
      return NextResponse.json(
        { error: "At least one item is required" },
        { status: 400, headers: CORS },
      );

    const site = await prisma.site.findUnique({
      where: { id: siteId },
      select: { id: true },
    });
    if (!site)
      return NextResponse.json(
        { error: "Site not found" },
        { status: 404, headers: CORS },
      );

    const validItems = items.filter(
      (item) => item.productId && item.quantity && item.quantity >= 1,
    );

    if (validItems.length === 0)
      return NextResponse.json(
        { error: "No valid order items were supplied" },
        { status: 400, headers: CORS },
      );

    const resolvedItems: {
      item: (typeof validItems)[number];
      resolved: NonNullable<
        Awaited<ReturnType<typeof resolveCatalogueProduct>>
      >;
    }[] = [];

    for (const item of validItems) {
      const resolved = await resolveCatalogueProduct(item.productId);
      if (!resolved)
        return NextResponse.json(
          { error: `Product not found: ${item.productId}` },
          { status: 404, headers: CORS },
        );
      resolvedItems.push({ item, resolved });
    }

    const order = await prisma.siteProductOrder.create({
      data: {
        site: { connect: { id: siteId } },
        supplier: supplierId ? { connect: { id: supplierId } } : undefined,
        createdByUser: { connect: { id: user.id } },
        reference: reference || null,
        note: note || null,
      },
    });

    for (const { item, resolved } of resolvedItems) {
      const itemUom = (item.uom as any) || resolved.uom || null;
      const itemUnitSize =
        item.unitSize != null && item.unitSize !== ""
          ? Number(item.unitSize)
          : resolved.unitSize
            ? Number(resolved.unitSize)
            : null;

      const resolvedPrice = await resolveUnitPrice({
        manualPrice: item.unitPrice,
        supplierId: supplierId ?? null,
        productId: resolved.legacyProductId,
        uom: itemUom ?? undefined,
        unitSize: itemUnitSize ?? undefined,
      });

      await prisma.siteProductOrderItem.create({
        data: {
          order: { connect: { id: order.id } },
          product: { connect: { id: resolved.legacyProductId } },
          quantity: item.quantity,
          unitPriceAtOrder: resolvedPrice,
          uomAtOrder: itemUom,
          unitSizeAtOrder: itemUnitSize,
          note: item.note || null,
        },
      });
    }

    const orderedProductIds = Array.from(
      new Set(resolvedItems.map(({ resolved }) => resolved.legacyProductId)),
    );

    await ensureSiteMaterialsForProducts(prisma, {
      siteId,
      productIds: orderedProductIds,
    });

    const newTotal = await recalcOrderTotal(order.id);

    return NextResponse.json(
      {
        ok: true,
        data: {
          id: order.id,
          totalCost: decimalToNumber(newTotal),
        },
      },
      { status: 201, headers: CORS },
    );
  } catch (e: any) {
    if (e?.code === "P2002")
      return NextResponse.json(
        {
          error:
            "A compatibility product already exists for this master catalogue product. Please retry the order.",
        },
        { status: 409, headers: CORS },
      );

    console.error("POST material-orders error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}
