import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { revalidatePath } from "next/cache";

import type {
  CatalogueActionResult,
  UpdateMasterPricesInput,
  UpdateMasterProductInput,
} from "@/components/products/MasterCatalogueProductActions";

import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import {
  MasterCatalogueTable,
  MasterCatalogueTableProduct,
} from "@/components/products/ProductsCatTable";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    supplierId?: string;
  }>;
};

function normalizeQuery(value: string | undefined) {
  return String(value ?? "").trim();
}

function normalizeProductName(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

async function updateMasterProductAction(
  input: UpdateMasterProductInput,
): Promise<CatalogueActionResult> {
  "use server";

  const id = String(input.id ?? "").trim();
  const name = String(input.name ?? "")
    .trim()
    .replace(/\s+/g, " ");
  const category = String(input.category ?? "")
    .trim()
    .replace(/\s+/g, " ");
  const description = String(input.description ?? "").trim();
  const usage =
    input.usage === "INT" || input.usage === "EXT" ? input.usage : "INT_EXT";

  if (!id || !name || !category) {
    return { success: false, error: "Product name and category are required." };
  }

  try {
    await prisma.masterCatalogueProduct.update({
      where: { id },
      data: {
        name,
        normalizedName: normalizeProductName(name),
        category,
        usage,
        description: description || null,
      },
    });
    revalidatePath("/admin/master-catalogue");
    return { success: true };
  } catch {
    return {
      success: false,
      error: "The product could not be updated. Check that its name is unique.",
    };
  }
}

async function updateMasterPricesAction(
  input: UpdateMasterPricesInput,
): Promise<CatalogueActionResult> {
  "use server";

  const productId = String(input.productId ?? "").trim();
  const priceRows = Array.isArray(input.prices) ? input.prices : [];
  if (!productId || priceRows.length === 0) {
    return { success: false, error: "No price rows were supplied." };
  }

  const updates = priceRows.map((row) => ({
    id: String(row.id ?? "").trim(),
    price: Number(row.price),
  }));

  if (
    updates.some(
      (row) => !row.id || !Number.isFinite(row.price) || row.price < 0,
    )
  ) {
    return { success: false, error: "Every price must be zero or more." };
  }

  try {
    const ownedRows = await prisma.masterProductPrice.findMany({
      where: {
        productId,
        id: { in: updates.map((row) => row.id) },
      },
      select: { id: true },
    });

    if (ownedRows.length !== updates.length) {
      return { success: false, error: "One or more price rows are invalid." };
    }

    await prisma.$transaction(
      updates.map((row) =>
        prisma.masterProductPrice.update({
          where: { id: row.id },
          data: { price: row.price },
        }),
      ),
    );

    revalidatePath("/admin/master-catalogue");
    return { success: true };
  } catch {
    return { success: false, error: "The prices could not be updated." };
  }
}

async function toggleMasterProductAction(
  id: string,
  isActive: boolean,
): Promise<CatalogueActionResult> {
  "use server";

  try {
    await prisma.masterCatalogueProduct.update({
      where: { id: String(id) },
      data: { isActive: Boolean(isActive) },
    });
    revalidatePath("/admin/master-catalogue");
    return { success: true };
  } catch {
    return {
      success: false,
      error: "The product status could not be changed.",
    };
  }
}

async function deleteMasterProductAction(
  id: string,
): Promise<CatalogueActionResult> {
  "use server";

  try {
    await prisma.masterCatalogueProduct.delete({
      where: { id: String(id) },
    });
    revalidatePath("/admin/master-catalogue");
    return { success: true };
  } catch {
    return {
      success: false,
      error: "The product could not be deleted because it is still in use.",
    };
  }
}

function buildQuery(
  base: { supplierId: string },
  overrides: Record<string, string | undefined>,
) {
  const params = new URLSearchParams();
  const merged = {
    supplierId: base.supplierId,
    ...overrides,
  };

  for (const [key, value] of Object.entries(merged)) {
    if (!value) continue;
    params.set(key, value);
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

export default async function MasterCataloguePage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const supplierId = normalizeQuery(params.supplierId);

  const where = {
    ...(supplierId ? { supplierId } : {}),
  };

  const [products, suppliers] = await Promise.all([
    prisma.masterCatalogueProduct.findMany({
      where,
      orderBy: [{ supplier: { name: "asc" } }, { name: "asc" }],
      include: {
        supplier: { select: { name: true } },
        finishes: {
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        },
        masterProductBases: {
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        },
        masterProductPrices: {
          where: { isActive: true },
          orderBy: { effectiveFrom: "desc" },
          include: {
            base: { select: { name: true } },
            finish: { select: { name: true } },
          },
        },
      },
    }),
    prisma.supplier.findMany({
      where: {
        masterCatalogueProducts: { some: {} },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  // Prisma Decimal values are converted to strings before crossing from the
  // server component into the client-side table.
  const tableProducts: MasterCatalogueTableProduct[] = products.map(
    (product) => ({
      id: product.id,
      name: product.name,
      normalizedName: product.normalizedName,
      category: product.category,
      usage: product.usage,
      description: product.description ?? "",
      isActive: product.isActive,
      supplier: product.supplier,
      finishes: product.finishes,
      bases: product.masterProductBases,
      prices: product.masterProductPrices.map((price) => ({
        id: price.id,
        finishId: price.finishId,
        baseId: price.baseId,
        unitSize: price.unitSize.toString(),
        uom: price.uom,
        price: price.price.toString(),
        base: price.base,
        finish: price.finish,
      })),
    }),
  );

  const hrefForSupplier = (targetSupplierId: string) =>
    `/admin/master-catalogue${buildQuery(
      { supplierId: targetSupplierId },
      {},
    )}`;

  return (
    <div className="mx-auto w-full space-y-3 flex flex-col lg:flex-row lg:space-y-0 lg:space-x-4">
      <aside className="w-full shrink-0 lg:sticky lg:top-4 lg:w-56">
        <div className="mb-3 flex h-8 items-center">
          <h1 className="font-bold tracking-tight">Paints & Preparations</h1>
        </div>
        <div className="overflow-hidden rounded border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-3 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Suppliers
            </p>
          </div>
          <div className="max-h-72 overflow-y-auto lg:max-h-[calc(100vh-190px)]">
            <Link
              href={hrefForSupplier("")}
              className={`block px-3 py-2 text-sm transition-colors ${
                supplierId === ""
                  ? "bg-blue-50 font-medium text-blue-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
              }`}
            >
              All Suppliers
            </Link>
            {suppliers.map((supplier) => (
              <Link
                key={supplier.id}
                href={hrefForSupplier(supplier.id)}
                className={`block truncate px-3 py-2 text-sm transition-colors ${
                  supplierId === supplier.id
                    ? "bg-blue-50 font-medium text-blue-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                }`}
                title={supplier.name}
              >
                {supplier.name}
              </Link>
            ))}
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <MasterCatalogueTable
          key={supplierId || "all"}
          products={tableProducts}
          updateProductAction={updateMasterProductAction}
          updatePricesAction={updateMasterPricesAction}
          toggleProductAction={toggleMasterProductAction}
          deleteProductAction={deleteMasterProductAction}
        />
      </main>
    </div>
  );
}
