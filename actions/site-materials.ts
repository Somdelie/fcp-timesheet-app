// actions/site-materials.ts
"use server";

import { prisma } from "@/lib/prisma";
import { requireServerAuth } from "@/lib/auth-server";
import { requireCanManageSite } from "@/lib/guards";
import { revalidatePath } from "next/cache";

function clean(v: unknown) {
  return String(v ?? "").trim();
}

/**
 * List all materials assigned to a site
 */
export async function listSiteMaterials(siteId: string) {
  const auth = await requireServerAuth();
  const id = clean(siteId);
  if (!id) return { ok: false as const, error: "Site is required." };

  const materials = await prisma.siteMaterial.findMany({
    where: { siteId: id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      siteId: true,
      productId: true,
      quantity: true,
      note: true,
      createdAt: true,
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          uom: true,
          unitSize: true,
          category: { select: { id: true, name: true } },
        },
      },
    },
  });

  return {
    ok: true as const,
    materials: materials.map((m) => ({
      id: m.id,
      siteId: m.siteId,
      productId: m.productId,
      quantity: m.quantity,
      note: m.note,
      createdAt: m.createdAt.toISOString(),
      product: {
        id: m.product.id,
        name: m.product.name,
        sku: m.product.sku,
        uom: m.product.uom,
        unitSize: m.product.unitSize ? Number(m.product.unitSize) : null,
        category: m.product.category,
      },
    })),
  };
}

export type SiteMaterialRow = {
  id: string;
  siteId: string;
  productId: string;
  quantity: number | null;
  note: string | null;
  createdAt: string;
  product: {
    id: string;
    name: string;
    sku: string | null;
    uom: string | null;
    unitSize: number | null;
    category: { id: string; name: string } | null;
  };
};

/**
 * Add a product to a site's materials list
 */
export async function addSiteMaterial(input: {
  siteId: string;
  productId: string;
  quantity?: number | null;
  note?: string | null;
}) {
  const auth = await requireServerAuth();
  if (auth.role !== "ADMIN" && auth.role !== "SUPERVISOR") {
    return { ok: false as const, error: "Not authorized." };
  }

  const siteId = clean(input.siteId);
  const productId = clean(input.productId);
  if (!siteId) return { ok: false as const, error: "Site is required." };
  if (!productId) return { ok: false as const, error: "Product is required." };

  await requireCanManageSite(auth, siteId);

  // Verify product exists
  const product = await prisma.procurementProduct.findUnique({
    where: { id: productId },
    select: { id: true },
  });
  if (!product) return { ok: false as const, error: "Product not found." };

  try {
    const material = await prisma.siteMaterial.create({
      data: {
        site: { connect: { id: siteId } },
        product: { connect: { id: productId } },
        quantity: input.quantity ?? null,
        note: input.note ? clean(input.note) : null,
      },
      select: { id: true },
    });

    revalidatePath(`/sites/${siteId}`);
    return { ok: true as const, id: material.id };
  } catch (e: any) {
    if (String(e?.code) === "P2002") {
      return {
        ok: false as const,
        error: "This product is already added to this site.",
      };
    }
    return { ok: false as const, error: "Failed to add material." };
  }
}

/**
 * Add multiple products to a site at once
 */
export async function addSiteMaterialsBulk(input: {
  siteId: string;
  productIds: string[];
}) {
  const auth = await requireServerAuth();
  if (auth.role !== "ADMIN" && auth.role !== "SUPERVISOR") {
    return { ok: false as const, error: "Not authorized." };
  }

  const siteId = clean(input.siteId);
  if (!siteId) return { ok: false as const, error: "Site is required." };
  if (!input.productIds?.length)
    return { ok: false as const, error: "No products selected." };

  await requireCanManageSite(auth, siteId);

  // Filter out already-added products
  const existing = await prisma.siteMaterial.findMany({
    where: { siteId, productId: { in: input.productIds } },
    select: { productId: true },
  });
  const existingIds = new Set(existing.map((e) => e.productId));
  const newIds = input.productIds.filter((id) => !existingIds.has(id));

  if (newIds.length === 0) {
    return {
      ok: false as const,
      error: "All selected products are already added.",
    };
  }

  await prisma.siteMaterial.createMany({
    data: newIds.map((productId) => ({
      siteId,
      productId,
    })),
  });

  revalidatePath(`/sites/${siteId}`);
  return { ok: true as const, added: newIds.length };
}

/**
 * Update a site material (quantity / note)
 */
export async function updateSiteMaterial(input: {
  id: string;
  quantity?: number | null;
  note?: string | null;
}) {
  const auth = await requireServerAuth();
  if (auth.role !== "ADMIN" && auth.role !== "SUPERVISOR") {
    return { ok: false as const, error: "Not authorized." };
  }

  const id = clean(input.id);
  if (!id) return { ok: false as const, error: "Material ID is required." };

  const mat = await prisma.siteMaterial.findUnique({
    where: { id },
    select: { siteId: true },
  });
  if (!mat) return { ok: false as const, error: "Material not found." };

  await requireCanManageSite(auth, mat.siteId);

  await prisma.siteMaterial.update({
    where: { id },
    data: {
      ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
      ...(input.note !== undefined
        ? { note: input.note ? clean(input.note) : null }
        : {}),
    },
  });

  revalidatePath(`/sites/${mat.siteId}`);
  return { ok: true as const };
}

/**
 * Remove a material from a site
 */
export async function removeSiteMaterial(id: string) {
  const auth = await requireServerAuth();
  if (auth.role !== "ADMIN" && auth.role !== "SUPERVISOR") {
    return { ok: false as const, error: "Not authorized." };
  }

  const materialId = clean(id);
  if (!materialId)
    return { ok: false as const, error: "Material ID is required." };

  const mat = await prisma.siteMaterial.findUnique({
    where: { id: materialId },
    select: { siteId: true },
  });
  if (!mat) return { ok: false as const, error: "Material not found." };

  await requireCanManageSite(auth, mat.siteId);

  await prisma.siteMaterial.delete({ where: { id: materialId } });

  revalidatePath(`/sites/${mat.siteId}`);
  return { ok: true as const };
}

/**
 * List available procurement products for selection
 */
export async function listAvailableProducts(input?: { q?: string }) {
  await requireServerAuth();

  const q = clean(input?.q);

  const products = await prisma.procurementProduct.findMany({
    where: {
      isActive: true,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { sku: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    take: 100,
    select: {
      id: true,
      name: true,
      sku: true,
      uom: true,
      unitSize: true,
      category: { select: { id: true, name: true } },
    },
  });

  return {
    ok: true as const,
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      uom: p.uom,
      unitSize: p.unitSize ? Number(p.unitSize) : null,
      category: p.category,
    })),
  };
}
