import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  clearSupplierLookupCache,
  resolveSupplierForProduct,
} from "@/lib/procurement/resolveBuildSmartSupplier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUILDSMART_HISTORICAL_NOTE = "Seeded from BuildSmart historical cost report";

/**
 * POST /api/admin/buildsmart/backfill-suppliers
 * Body: { dryRun?: boolean }
 *
 * Links suppliers to products and orders created by the historical cost
 * report importer that were missing supplierId.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session || !["ADMIN", "OFFICE"].includes(role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { dryRun?: boolean };
  const dryRun = body.dryRun !== false;

  clearSupplierLookupCache();

  const products = await prisma.procurementProduct.findMany({
    where: {
      supplierId: null,
      orderItems: {
        some: { order: { note: { contains: BUILDSMART_HISTORICAL_NOTE } } },
      },
    },
    select: {
      id: true,
      name: true,
      sku: true,
      orderItems: {
        where: { order: { note: { contains: BUILDSMART_HISTORICAL_NOTE } } },
        select: { order: { select: { reference: true } } },
        take: 1,
      },
    },
  });

  let productsUpdated = 0;
  let unresolved = 0;
  const samples: { name: string; supplier: string; source: string }[] = [];

  for (const product of products) {
    const resolution = await resolveSupplierForProduct({
      productId: product.id,
      description: product.name,
      sku: product.sku,
      orderReference: product.orderItems[0]?.order.reference ?? null,
    });

    if (!resolution.supplierId || !resolution.supplierName) {
      unresolved++;
      continue;
    }

    if (!dryRun) {
      await prisma.procurementProduct.update({
        where: { id: product.id },
        data: { supplierId: resolution.supplierId },
      });
    }

    productsUpdated++;
    if (samples.length < 20) {
      samples.push({
        name: product.name,
        supplier: resolution.supplierName,
        source: resolution.source,
      });
    }
  }

  const orders = await prisma.siteProductOrder.findMany({
    where: {
      supplierId: null,
      note: { contains: BUILDSMART_HISTORICAL_NOTE },
    },
    select: {
      id: true,
      reference: true,
      items: {
        select: {
          product: {
            select: { supplierId: true, supplier: { select: { name: true } } },
          },
        },
      },
    },
  });

  let ordersUpdated = 0;

  for (const order of orders) {
    let supplierId: string | null = null;

    if (order.reference) {
      const refResolution = await resolveSupplierForProduct({
        description: "",
        orderReference: order.reference,
      });
      supplierId = refResolution.supplierId;
    }

    if (!supplierId) {
      const counts = new Map<string, string>();
      for (const item of order.items) {
        if (item.product.supplierId) counts.set(item.product.supplierId, item.product.supplier?.name ?? "");
      }
      supplierId = counts.keys().next().value ?? null;
    }

    if (!supplierId) continue;

    if (!dryRun) {
      await prisma.siteProductOrder.update({
        where: { id: order.id },
        data: { supplierId },
      });
    }
    ordersUpdated++;
  }

  return NextResponse.json({
    dryRun,
    productsChecked: products.length,
    productsUpdated,
    unresolved,
    ordersChecked: orders.length,
    ordersUpdated,
    samples,
  });
}
