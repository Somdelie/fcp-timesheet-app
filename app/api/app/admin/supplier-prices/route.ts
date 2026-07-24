import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { decimalToNumber } from "@/lib/dateUtc";
import { resolveCatalogueProduct } from "@/lib/procurement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function OPTIONS() {
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

function serialiseSupplierProductPrice(p: any) {
  const master = p.product?.masterCatalogueProduct ?? null;

  return {
    ...p,
    productId: p.productId,
    masterCatalogueProductId:
      p.product?.masterCatalogueProductId ?? master?.id ?? null,
    catalogueSource: master ? "MASTER" : "LEGACY",
    price: decimalToNumber(p.price),
    unitSize: p.unitSize ? decimalToNumber(p.unitSize) : null,
    product: {
      ...p.product,
      name: master?.name ?? p.product.name,
      sku: master?.sku ?? p.product.sku,
      uom: master?.uom ?? p.product.uom,
      unitSize:
        master?.unitSize != null
          ? decimalToNumber(master.unitSize)
          : p.product.unitSize
            ? decimalToNumber(p.product.unitSize)
            : null,
      masterCatalogueProductId:
        p.product.masterCatalogueProductId ?? master?.id ?? null,
      catalogueSource: master ? "MASTER" : "LEGACY",
      masterCatalogueProduct: undefined,
    },
  };
}

function serialiseMaterialPrice(p: any) {
  return {
    ...p,
    productId: p.materialId,
    masterCatalogueProductId: null,
    catalogueSource: "MATERIAL",
    price: decimalToNumber(p.price),
    unitSize: p.unitSize ? decimalToNumber(p.unitSize) : null,
    product: {
      id: p.material.id,
      name: p.material.name,
      sku: p.material.sku,
      uom: p.uom,
      unitSize: p.unitSize ? decimalToNumber(p.unitSize) : null,
      masterCatalogueProductId: null,
      catalogueSource: "MATERIAL",
    },
  };
}

/**
 * GET /api/app/admin/supplier-prices
 * Query: ?productId=xxx&supplierId=xxx&includeInactive=true
 *
 * productId may be a ProcurementProduct id, MasterCatalogueProduct id,
 * or legacy Material id.
 */
export async function GET(req: Request) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS },
      );

    const url = new URL(req.url);
    const requestedProductId = url.searchParams.get("productId");
    const supplierId = url.searchParams.get("supplierId");
    const includeInactive = url.searchParams.get("includeInactive") === "true";

    let legacyProductId: string | null = null;
    let materialId: string | null = null;

    if (requestedProductId) {
      const legacy = await prisma.procurementProduct.findUnique({
        where: { id: requestedProductId },
        select: { id: true },
      });

      if (legacy) {
        legacyProductId = legacy.id;
      } else {
        const master = await prisma.masterCatalogueProduct.findUnique({
          where: { id: requestedProductId },
          select: {
            legacyProcurementProduct: {
              select: { id: true },
            },
          },
        });

        if (master) {
          legacyProductId = master.legacyProcurementProduct?.id ?? "__none__";
        } else {
          materialId = requestedProductId;
        }
      }
    }

    const where: Record<string, unknown> = {};
    const materialWhere: Record<string, unknown> = {};

    if (!includeInactive) {
      where.isActive = true;
      materialWhere.isActive = true;
    }

    if (requestedProductId) {
      where.productId = legacyProductId ?? "__none__";
      materialWhere.materialId = materialId ?? "__none__";
    }

    if (supplierId) {
      where.supplierId = supplierId;
      materialWhere.supplierId = supplierId;
    }

    const [productPrices, materialPrices] = await Promise.all([
      prisma.supplierProductPrice.findMany({
        where,
        orderBy: { startsOn: "desc" },
        include: {
          supplier: { select: { id: true, name: true } },
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
      }),
      prisma.materialPrice.findMany({
        where: materialWhere,
        orderBy: { startsOn: "desc" },
        include: {
          supplier: { select: { id: true, name: true } },
          material: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
        },
      }),
    ]);

    const data = [
      ...productPrices.map(serialiseSupplierProductPrice),
      ...materialPrices.map(serialiseMaterialPrice),
    ].sort(
      (a, b) => new Date(b.startsOn).getTime() - new Date(a.startsOn).getTime(),
    );

    return NextResponse.json({ ok: true, data }, { headers: CORS });
  } catch (e: any) {
    console.error("GET supplier-prices error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}

/**
 * POST /api/app/admin/supplier-prices
 * Body: { supplierId, productId, price, startsOn?, endsOn?, uom?, unitSize? }
 *
 * productId may be a ProcurementProduct id, MasterCatalogueProduct id,
 * or legacy Material id.
 */
export async function POST(req: Request) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS },
      );

    const body = await req.json();
    const { supplierId, productId, price, startsOn, endsOn, uom, unitSize } =
      body as {
        supplierId: string;
        productId: string;
        price: number | string;
        startsOn?: string;
        endsOn?: string;
        uom?: string;
        unitSize?: number | string | null;
      };

    if (!supplierId || !productId)
      return NextResponse.json(
        { error: "supplierId and productId are required" },
        { status: 400, headers: CORS },
      );

    if (price == null || Number(price) < 0)
      return NextResponse.json(
        { error: "price must be a non-negative number" },
        { status: 400, headers: CORS },
      );

    const resolved = await resolveCatalogueProduct(productId);

    if (resolved) {
      const record = await prisma.supplierProductPrice.create({
        data: {
          supplier: { connect: { id: supplierId } },
          product: { connect: { id: resolved.legacyProductId } },
          price: Number(price),
          uom: (uom as any) || null,
          unitSize:
            unitSize != null && unitSize !== "" ? Number(unitSize) : null,
          startsOn: startsOn ? new Date(startsOn) : new Date(),
          endsOn: endsOn ? new Date(endsOn) : null,
        },
        include: {
          supplier: { select: { id: true, name: true } },
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
      });

      return NextResponse.json(
        {
          ok: true,
          data: serialiseSupplierProductPrice(record),
        },
        { status: 201, headers: CORS },
      );
    }

    const material = await prisma.material.findUnique({
      where: { id: productId },
      select: { id: true },
    });

    if (!material) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404, headers: CORS },
      );
    }

    const record = await prisma.materialPrice.create({
      data: {
        supplier: { connect: { id: supplierId } },
        material: { connect: { id: productId } },
        price: Number(price),
        uom: (uom as any) || null,
        unitSize: unitSize != null && unitSize !== "" ? Number(unitSize) : null,
        startsOn: startsOn ? new Date(startsOn) : new Date(),
        endsOn: endsOn ? new Date(endsOn) : null,
      },
      include: {
        supplier: { select: { id: true, name: true } },
        material: { select: { id: true, name: true, sku: true } },
      },
    });

    return NextResponse.json(
      {
        ok: true,
        data: serialiseMaterialPrice(record),
      },
      { status: 201, headers: CORS },
    );
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json(
        {
          error:
            "A compatibility product already exists for this master catalogue product. Please retry.",
        },
        { status: 409, headers: CORS },
      );
    }

    console.error("POST supplier-prices error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}
