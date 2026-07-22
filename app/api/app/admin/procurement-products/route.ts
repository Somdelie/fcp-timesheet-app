import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { decimalToNumber } from "@/lib/dateUtc";
import { canonicalPlantName } from "@/lib/procurement/plantName";
import type { ProductUom, ProductType } from "@/generated/prisma/client";

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

function normalizeCatalogueName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function serialise(p: any) {
  const master = p.masterCatalogueProduct ?? null;

  return {
    ...p,

    // Keep the legacy ProcurementProduct id as the public id during Stage 1.
    // Existing order, stock, PPE, plant and price endpoints still depend on it.
    id: p.id,

    // MasterCatalogueProduct is authoritative whenever the compatibility link
    // exists. Unlinked legacy rows still work until they are reviewed.
    name: master?.name ?? p.name,
    sku: master?.sku ?? p.sku,
    description: master?.description ?? p.description,
    thumbnailUrl: master?.thumbnailUrl ?? p.thumbnailUrl,
    category: master?.categoryRef ?? p.category ?? null,
    supplier: master?.supplier ?? p.supplier ?? null,
    productType: master?.productType ?? p.productType,
    isReturnable: master?.isReturnable ?? p.isReturnable,
    isDeductible: master?.isDeductible ?? p.isDeductible,
    deductionSplits: master?.deductionSplits ?? p.deductionSplits,
    colors: master?.colors ?? p.colors ?? [],
    sizes: master?.sizes ?? p.sizes ?? [],
    stockQty: master?.stockQty ?? p.stockQty ?? 0,
    isActive: master?.isActive ?? p.isActive,

    masterCatalogueProductId: p.masterCatalogueProductId ?? master?.id ?? null,
    catalogueSource: master ? "MASTER" : "LEGACY",

    unitSize:
      master?.unitSize != null
        ? decimalToNumber(master.unitSize)
        : p.unitSize
          ? decimalToNumber(p.unitSize)
          : null,
    uom: master?.uom ?? p.uom ?? null,

    supplierPrices: p.supplierPrices?.map((sp: any) => ({
      ...sp,
      price: decimalToNumber(sp.price),
      unitSize: sp.unitSize ? decimalToNumber(sp.unitSize) : null,
    })),

    // Do not expose the nested compatibility object in the JSON response.
    masterCatalogueProduct: undefined,
  };
}

async function findDuplicatePlantName(name: string, excludeId?: string) {
  const canonicalName = canonicalPlantName(name);
  if (!canonicalName) return null;

  const plants = await prisma.procurementProduct.findMany({
    where: {
      productType: "PLANT",
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, name: true },
  });

  return (
    plants.find((plant) => canonicalPlantName(plant.name) === canonicalName) ??
    null
  );
}

function mergePlantProducts(
  products: any[],
  deployedQtyMap: Map<string, number>,
) {
  const groups = new Map<string, any[]>();

  for (const product of products) {
    const key = canonicalPlantName(product.name) || product.id;
    groups.set(key, [...(groups.get(key) ?? []), product]);
  }

  return Array.from(groups.values()).map((group) => {
    const sorted = [...group].sort((a, b) => {
      const nameCompare = String(a.name).localeCompare(String(b.name));
      if (nameCompare !== 0) return nameCompare;
      return String(a.id).localeCompare(String(b.id));
    });
    const primary = sorted[0];
    const totalStock = group.reduce(
      (sum, item) => sum + (Number(item.stockQty) || 0),
      0,
    );
    const totalDeployed = group.reduce(
      (sum, item) => sum + (deployedQtyMap.get(item.id) ?? 0),
      0,
    );
    const orderItems = group.reduce(
      (sum, item) => sum + (Number(item._count?.orderItems) || 0),
      0,
    );
    const plantAssignments = group.reduce(
      (sum, item) => sum + (Number(item._count?.plantAssignments) || 0),
      0,
    );

    return {
      ...primary,
      duplicateCount: group.length,
      duplicateIds: group.map((item) => item.id),
      name: primary.name,
      sku: primary.sku ?? group.find((item) => item.sku)?.sku ?? null,
      description:
        primary.description ??
        group.find((item) => item.description)?.description ??
        null,
      thumbnailUrl:
        primary.thumbnailUrl ??
        group.find((item) => item.thumbnailUrl)?.thumbnailUrl ??
        null,
      isReturnable: group.some((item) => item.isReturnable),
      colors: Array.from(
        new Set(group.flatMap((item) => item.colors ?? []).filter(Boolean)),
      ),
      sizes: Array.from(
        new Set(group.flatMap((item) => item.sizes ?? []).filter(Boolean)),
      ),
      stockQty: totalStock,
      deployedQty: totalDeployed,
      _count: {
        ...(primary._count ?? {}),
        orderItems,
        plantAssignments,
      },
    };
  });
}

/**
 * GET /api/app/admin/procurement-products
 * Query: ?q=search&categoryId=xxx&supplierId=xxx&includeInactive=true
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
    const q = (url.searchParams.get("q") ?? "").trim();
    const categoryId = url.searchParams.get("categoryId");
    const supplierId = url.searchParams.get("supplierId");
    const productType = url.searchParams.get(
      "productType",
    ) as ProductType | null;
    const productTypeRaw = url.searchParams.get("productType");
    const includeInactive = url.searchParams.get("includeInactive") === "true";
    const debugConsole = url.searchParams.get("debugConsole") === "true";

    const rawLimit = url.searchParams.get("limit");
    const rawPage = url.searchParams.get("page");

    const MAX_LIMIT = 1000;
    const DEFAULT_LIMIT = 1000;

    let limit = Number(rawLimit ?? DEFAULT_LIMIT);
    if (!Number.isFinite(limit) || limit <= 0) limit = DEFAULT_LIMIT;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;

    let page = Number(rawPage ?? 1);
    if (!Number.isFinite(page) || page < 1) page = 1;

    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (!includeInactive) where.isActive = true;
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
      ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (supplierId) where.supplierId = supplierId;
    if (productType) where.productType = productType;

    const materialsOnly =
      url.searchParams.get("materialsOnly") === "true" ||
      productTypeRaw === "MATERIAL";

    if (materialsOnly) {
      const matWhere: any = {};
      if (!includeInactive) matWhere.isActive = true;
      if (q) {
        matWhere.OR = [
          { name: { contains: q, mode: "insensitive" } },
          { sku: { contains: q, mode: "insensitive" } },
        ];
      }
      if (supplierId) matWhere.supplierId = supplierId;
      if (categoryId) matWhere.categoryId = categoryId;

      // Phase 0 (hybrid cutover): union the authoritative `Material` rows with
      // the legacy `ProcurementProduct` MATERIAL catalogue so the Paints &
      // Preparations page shows the full catalogue while the data migration is
      // in progress. Once the backfill runs, this union can collapse to
      // reading `Material` alone.
      const ppWhere: any = { productType: "MATERIAL" };
      if (!includeInactive) ppWhere.isActive = true;
      if (q) {
        ppWhere.OR = [
          { name: { contains: q, mode: "insensitive" } },
          { sku: { contains: q, mode: "insensitive" } },
        ];
      }
      if (supplierId) ppWhere.supplierId = supplierId;
      if (categoryId) ppWhere.categoryId = categoryId;

      const [materials, ppMaterials] = await Promise.all([
        prisma.material.findMany({
          where: matWhere,
          orderBy: { name: "asc" },
          include: {
            supplier: { select: { id: true, name: true } },
            prices: {
              where: { isActive: true },
              select: {
                id: true,
                price: true,
                uom: true,
                unitSize: true,
                supplierId: true,
                supplier: { select: { id: true, name: true } },
              },
            },
          },
        }),
        prisma.procurementProduct.findMany({
          where: ppWhere,
          orderBy: { name: "asc" },
          include: {
            category: { select: { id: true, name: true } },
            supplier: { select: { id: true, name: true } },
            masterCatalogueProduct: {
              include: {
                categoryRef: { select: { id: true, name: true } },
                supplier: { select: { id: true, name: true } },
              },
            },
            supplierPrices: {
              where: { isActive: true },
              select: {
                id: true,
                price: true,
                uom: true,
                unitSize: true,
                supplierId: true,
                supplier: { select: { id: true, name: true } },
              },
            },
            variantStocks: {
              select: { id: true, size: true, color: true, qty: true },
            },
            _count: {
              select: { orderItems: true, supplierPrices: true },
            },
          },
        }),
      ]);

      const mapMaterial = (m: any) => {
        const sizes = (m.prices ?? [])
          .map((p: any) =>
            p.unitSize != null && p.uom ? `${p.unitSize}${p.uom}` : null,
          )
          .filter(Boolean) as string[];
        return {
          id: m.id,
          name: m.name,
          sku: m.sku ?? null,
          description: m.description ?? null,
          thumbnailUrl: null,
          isActive: m.isActive,
          productType: "MATERIAL",
          isReturnable: m.isReturnable,
          isDeductible: m.isDeductible ?? true,
          deductionSplits: m.deductionSplits ?? 1,
          colors: m.colors ?? [],
          sizes: Array.from(new Set(sizes)),
          stockQty: 0,
          variantStocks: [],
          category: null,
          supplier: m.supplier ?? null,
          supplierPrices: (m.prices ?? []).map((sp: any) => ({
            id: sp.id,
            price: decimalToNumber(sp.price),
            uom: sp.uom,
            unitSize: sp.unitSize ? decimalToNumber(sp.unitSize) : null,
            supplierId: sp.supplierId,
            supplier: sp.supplier,
            isActive: true,
          })),
          _count: { orderItems: 0, supplierPrices: (m.prices ?? []).length },
        };
      };

      // Dedupe key: prefer real SKU, else fall back to normalized name. The
      // authoritative Material row wins over its legacy ProcurementProduct twin.
      const keyOf = (p: any) => {
        const sku = String(p.sku ?? "")
          .trim()
          .toLowerCase();
        if (sku) return `sku:${sku}`;
        return `name:${String(p.name ?? "")
          .trim()
          .toLowerCase()}`;
      };

      const seen = new Set<string>();
      const combined: any[] = [];
      for (const m of materials.map(mapMaterial)) {
        seen.add(keyOf(m));
        combined.push(m);
      }
      for (const p of ppMaterials) {
        const mappedPp = { ...serialise(p), productType: "MATERIAL" };
        if (seen.has(keyOf(mappedPp))) continue;
        seen.add(keyOf(mappedPp));
        combined.push(mappedPp);
      }

      combined.sort((a, b) => String(a.name).localeCompare(String(b.name)));

      return NextResponse.json(
        {
          ok: true,
          data: combined.map((p) => ({ ...serialise(p), deployedQty: 0 })),
          page: 1,
          limit: combined.length,
          total: combined.length,
          hasMore: false,
        },
        { headers: CORS },
      );
    }

    // fetch procurementProduct rows
    const [ppTotal, ppProducts] = await Promise.all([
      prisma.procurementProduct.count({ where }),
      prisma.procurementProduct.findMany({
        where,
        orderBy: { name: "asc" },
        skip,
        take: limit,
        include: {
          category: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
          masterCatalogueProduct: {
            include: {
              categoryRef: { select: { id: true, name: true } },
              supplier: { select: { id: true, name: true } },
            },
          },
          supplierPrices: {
            where: { isActive: true },
            select: {
              id: true,
              price: true,
              uom: true,
              unitSize: true,
              supplierId: true,
              supplier: { select: { id: true, name: true } },
            },
          },
          variantStocks: {
            select: { id: true, size: true, color: true, qty: true },
          },
          _count: {
            select: {
              orderItems: true,
              supplierPrices: true,
              plantAssignments: true,
            },
          },
        },
      }),
    ]);

    // If requesting MATERIALs, also fetch from the Material table and merge
    let products: any[] = ppProducts;
    let total = ppTotal;

    if (!productType || productTypeRaw === "MATERIAL") {
      // build material where clause similar to procurementProduct
      const matWhere: any = {};
      if (!includeInactive) matWhere.isActive = true;
      if (q) {
        matWhere.OR = [
          { name: { contains: q, mode: "insensitive" } },
          { sku: { contains: q, mode: "insensitive" } },
        ];
      }
      if (supplierId) matWhere.supplierId = supplierId;

      const materials = await prisma.material.findMany({
        where: matWhere,
        include: {
          supplier: { select: { id: true, name: true } },
          prices: {
            where: { isActive: true },
            select: {
              id: true,
              price: true,
              uom: true,
              unitSize: true,
              supplierId: true,
              supplier: { select: { id: true, name: true } },
            },
          },
        },
      });

      // map materials to procurement product shape
      const mapped = materials.map((m: any) => {
        const sizes = (m.prices ?? [])
          .map((p: any) => {
            if (p.unitSize != null && p.uom) return `${p.unitSize}${p.uom}`;
            return null;
          })
          .filter(Boolean) as string[];
        return {
          id: m.id,
          name: m.name,
          sku: m.sku ?? null,
          description: null,
          thumbnailUrl: null,
          isActive: m.isActive,
          productType: "MATERIAL",
          isReturnable: m.isReturnable,
          isDeductible: true,
          deductionSplits: 1,
          colors: m.colors ?? [],
          sizes: Array.from(new Set(sizes)),
          stockQty: m.stockQty ?? 0,
          variantStocks: [],
          category: null,
          supplier: m.supplier ?? null,
          supplierPrices: (m.prices ?? []).map((sp: any) => ({
            id: sp.id,
            price: decimalToNumber(sp.price),
            uom: sp.uom,
            unitSize: sp.unitSize ? decimalToNumber(sp.unitSize) : null,
            supplierId: sp.supplierId,
            supplier: sp.supplier,
            isActive: true,
          })),
          _count: { orderItems: 0, supplierPrices: (m.prices ?? []).length },
        };
      });

      // merge and sort by name
      products = [...products, ...mapped].sort((a, b) =>
        String(a.name).localeCompare(String(b.name)),
      );
      total = products.length;

      // apply pagination slice
      const paged = products.slice(skip, skip + limit);
      products = paged;
    }

    const hasMore = skip + products.length < total;

    if (debugConsole && (!productType || productTypeRaw === "MATERIAL")) {
      console.log(
        "SERVER DEBUG: procurement-material-products",
        JSON.stringify(
          products.map((p) => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            supplier: p.supplier,
            supplierPrices: p.supplierPrices?.map((sp: any) => ({
              id: sp.id,
              price: decimalToNumber(sp.price),
              uom: sp.uom,
              unitSize: sp.unitSize ? decimalToNumber(sp.unitSize) : null,
              supplier: sp.supplier,
            })),
          })),
          null,
          2,
        ),
      );
    }

    // For plant items, compute the total deployed quantity per product
    let deployedQtyMap = new Map<string, number>();
    if (productType === "PLANT" && products.length > 0) {
      const productIds = products.map((p) => p.id);
      const deployedSums = await prisma.sitePlantAssignment.groupBy({
        by: ["productId"],
        where: {
          productId: { in: productIds },
          status: { in: ["DEPLOYED", "REPAIR"] },
        },
        _sum: { quantity: true },
      });
      deployedQtyMap = new Map(
        deployedSums.map((d) => [d.productId, d._sum.quantity ?? 0]),
      );
    }

    if (productType === "PLANT") {
      products = mergePlantProducts(products, deployedQtyMap).sort((a, b) =>
        String(a.name).localeCompare(String(b.name)),
      );
      total = products.length;
    }

    return NextResponse.json(
      {
        ok: true,
        data: products.map((p) => ({
          ...serialise(p),
          deployedQty:
            productType === "PLANT"
              ? (p.deployedQty ?? 0)
              : (deployedQtyMap.get(p.id) ?? 0),
        })),
        page,
        limit,
        total,
        hasMore,
      },
      { headers: CORS },
    );
  } catch (e: any) {
    console.error("GET procurement-products error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}

/**
 * POST /api/app/admin/procurement-products
 * Body: { name, sku?, categoryId?, uom, unitSize?, description?, supplierId?, thumbnailUrl? }
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
    const {
      name,
      sku,
      categoryId,
      uom,
      unitSize,
      description,
      supplierId,
      thumbnailUrl,
      productType,
      isReturnable,
      colors,
      stockQty,
    } = body as {
      name: string;
      sku?: string;
      categoryId?: string;
      uom?: ProductUom;
      unitSize?: number | string;
      description?: string;
      supplierId?: string;
      thumbnailUrl?: string;
      productType?: ProductType;
      isReturnable?: boolean;
      colors?: string[];
      sizes?: string[];
      stockQty?: number;
      variantStocks?: {
        size?: string | null;
        color?: string | null;
        qty?: number;
      }[];
    };

    const variantStocksInput = (body as any).variantStocks as
      | { size?: string | null; color?: string | null; qty?: number }[]
      | undefined;

    if (!name?.trim())
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400, headers: CORS },
      );

    if ((productType ?? "MATERIAL") === "PLANT") {
      const duplicate = await findDuplicatePlantName(name);
      if (duplicate) {
        return NextResponse.json(
          { error: `A plant item named "${duplicate.name}" already exists` },
          { status: 409, headers: CORS },
        );
      }
    }

    const computedStockQty = variantStocksInput?.length
      ? variantStocksInput.reduce((s, v) => s + (Number(v.qty) || 0), 0)
      : stockQty != null
        ? Number(stockQty)
        : 0;

    const cleanName = name.trim();
    const normalizedName = normalizeCatalogueName(cleanName);

    const product = await prisma.$transaction(async (tx) => {
      let masterCatalogueProductId: string | null = null;

      if (supplierId) {
        const category = categoryId
          ? await tx.productCategory.findUnique({
              where: { id: categoryId },
              select: { name: true },
            })
          : null;

        const existingMaster = await tx.masterCatalogueProduct.findUnique({
          where: {
            supplierId_normalizedName: {
              supplierId,
              normalizedName,
            },
          },
          include: {
            legacyProcurementProduct: {
              select: { id: true },
            },
          },
        });

        if (existingMaster?.legacyProcurementProduct) {
          throw Object.assign(
            new Error(
              `A catalogue product named "${existingMaster.name}" already exists for this supplier`,
            ),
            { code: "CATALOGUE_DUPLICATE" },
          );
        }

        const master = existingMaster
          ? await tx.masterCatalogueProduct.update({
              where: { id: existingMaster.id },
              data: {
                name: cleanName,
                description: description?.trim() || null,
                category: category?.name ?? "Uncategorised",
                categoryId: categoryId || null,
                sku: sku?.trim() || null,
                thumbnailUrl: thumbnailUrl?.trim() || null,
                productType: productType ?? "MATERIAL",
                isReturnable: isReturnable ?? false,
                colors: colors ?? [],
                sizes: (body as any).sizes ?? [],
                stockQty: computedStockQty,
                uom: uom || null,
                unitSize: unitSize != null ? Number(unitSize) : null,
                isDeductible: (body as any).isDeductible ?? true,
                deductionSplits: Number((body as any).deductionSplits) || 1,
                isActive: true,
              },
            })
          : await tx.masterCatalogueProduct.create({
              data: {
                supplierId,
                name: cleanName,
                normalizedName,
                description: description?.trim() || null,
                category: category?.name ?? "Uncategorised",
                categoryId: categoryId || null,
                sku: sku?.trim() || null,
                thumbnailUrl: thumbnailUrl?.trim() || null,
                productType: productType ?? "MATERIAL",
                isReturnable: isReturnable ?? false,
                colors: colors ?? [],
                sizes: (body as any).sizes ?? [],
                stockQty: computedStockQty,
                uom: uom || null,
                unitSize: unitSize != null ? Number(unitSize) : null,
                isDeductible: (body as any).isDeductible ?? true,
                deductionSplits: Number((body as any).deductionSplits) || 1,
              },
            });

        masterCatalogueProductId = master.id;
      }

      return tx.procurementProduct.create({
        data: {
          name: cleanName,
          normalizedName,
          sku: sku?.trim() || null,
          category: categoryId ? { connect: { id: categoryId } } : undefined,
          uom: uom || null,
          unitSize: unitSize != null ? Number(unitSize) : null,
          description: description?.trim() || null,
          supplier: supplierId ? { connect: { id: supplierId } } : undefined,
          thumbnailUrl: thumbnailUrl?.trim() || null,
          productType: productType ?? "MATERIAL",
          isReturnable: isReturnable ?? false,
          isDeductible: (body as any).isDeductible ?? true,
          deductionSplits: Number((body as any).deductionSplits) || 1,
          colors: colors ?? [],
          sizes: (body as any).sizes ?? [],
          stockQty: computedStockQty,
          masterCatalogueProduct: masterCatalogueProductId
            ? { connect: { id: masterCatalogueProductId } }
            : undefined,
          ...(variantStocksInput?.length
            ? {
                variantStocks: {
                  createMany: {
                    data: variantStocksInput.map((v) => ({
                      size: v.size || null,
                      color: v.color || null,
                      qty: Math.max(0, Number(v.qty) || 0),
                    })),
                  },
                },
              }
            : {}),
        },
        include: {
          category: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
          masterCatalogueProduct: {
            include: {
              categoryRef: { select: { id: true, name: true } },
              supplier: { select: { id: true, name: true } },
            },
          },
          variantStocks: {
            select: { id: true, size: true, color: true, qty: true },
          },
        },
      });
    });

    return NextResponse.json(
      { ok: true, data: serialise(product) },
      { status: 201, headers: CORS },
    );
  } catch (e: any) {
    if (e?.code === "CATALOGUE_DUPLICATE") {
      return NextResponse.json(
        { error: e.message },
        { status: 409, headers: CORS },
      );
    }
    if (e?.code === "P2002") {
      const target = e?.meta?.target ?? e?.meta?.modelName ?? "";
      const field = Array.isArray(target)
        ? target.join(", ")
        : String(target).includes("sku")
          ? "sku"
          : String(target);
      return NextResponse.json(
        { error: `A product with that ${field || "value"} already exists` },
        { status: 409, headers: CORS },
      );
    }
    console.error("POST procurement-products error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}
