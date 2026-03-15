"use server";

import { prisma } from "@/lib/prisma";
import { requireServerAuth } from "@/lib/auth-server";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/client";

function clean(v: unknown) {
  return String(v ?? "").trim();
}

function cleanDecimal(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function serialize(row: any) {
  return JSON.parse(
    JSON.stringify(row, (_key, val) =>
      val instanceof Decimal
        ? val.toNumber()
        : val instanceof Date
          ? val.toISOString()
          : val,
    ),
  );
}

// ─── Coverage Profiles ────────────────────────────────

export async function listCoverageProfiles(productId?: string) {
  await requireServerAuth();

  const where: any = { isActive: true };
  if (productId) where.productId = productId;

  const rows = await prisma.procurementProductCoverage.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      product: { select: { id: true, name: true, uom: true, unitSize: true } },
    },
  });

  return { ok: true as const, coverages: serialize(rows) };
}

export async function upsertCoverageProfile(input: {
  id?: string;
  productId: string;
  uom?: string | null;
  unitSize?: number | null;
  coverageM2: number;
  note?: string | null;
}) {
  const auth = await requireServerAuth();
  if (auth.role !== "ADMIN" && auth.role !== "OFFICE") {
    return { ok: false as const, error: "Not authorized." };
  }

  const productId = clean(input.productId);
  if (!productId) return { ok: false as const, error: "Product is required." };

  const coverageM2 = cleanDecimal(input.coverageM2);
  if (!coverageM2 || coverageM2 <= 0)
    return { ok: false as const, error: "Coverage must be positive." };

  const data: any = {
    productId,
    coverageM2,
    uom: input.uom || null,
    unitSize: input.unitSize != null ? input.unitSize : null,
    note: clean(input.note) || null,
  };

  if (input.id) {
    const row = await prisma.procurementProductCoverage.update({
      where: { id: input.id },
      data,
    });
    return { ok: true as const, id: row.id };
  }

  const row = await prisma.procurementProductCoverage.create({ data });
  return { ok: true as const, id: row.id };
}

// ─── Paint Plans ──────────────────────────────────────

export async function listPaintPlans(filters?: {
  siteId?: string;
  productId?: string;
}) {
  await requireServerAuth();

  const where: any = {};
  if (filters?.siteId) where.siteId = filters.siteId;
  if (filters?.productId) where.productId = filters.productId;

  const plans = await prisma.sitePaintPlan.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      site: { select: { id: true, name: true, code: true } },
      product: { select: { id: true, name: true, uom: true, unitSize: true } },
      coverage: {
        select: {
          id: true,
          coverageM2: true,
          uom: true,
          unitSize: true,
          note: true,
        },
      },
      usages: {
        orderBy: { usedOn: "desc" },
        select: {
          id: true,
          usedLitres: true,
          usedContainers: true,
          note: true,
          usedOn: true,
        },
      },
    },
  });

  return { ok: true as const, plans: serialize(plans) };
}

export async function getPaintPlan(id: string) {
  await requireServerAuth();

  const plan = await prisma.sitePaintPlan.findUnique({
    where: { id },
    include: {
      site: { select: { id: true, name: true, code: true } },
      product: { select: { id: true, name: true, uom: true, unitSize: true } },
      coverage: {
        select: {
          id: true,
          coverageM2: true,
          uom: true,
          unitSize: true,
          note: true,
        },
      },
      createdByUser: { select: { id: true, name: true } },
      usages: {
        orderBy: { usedOn: "desc" },
        select: {
          id: true,
          usedLitres: true,
          usedContainers: true,
          note: true,
          usedOn: true,
          createdByUser: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!plan) return { ok: false as const, error: "Plan not found." };
  return { ok: true as const, plan: serialize(plan) };
}

export async function createPaintPlan(input: {
  siteId: string;
  description: string;
  boqReference?: string | null;
  areaM2: number;
  productId: string;
  coverageId?: string | null;
  coats: number;
  coverageM2PerUnit: number;
  unitSizeLitres: number;
  costPerContainer?: number | null;
  note?: string | null;
}) {
  const auth = await requireServerAuth();
  if (auth.role !== "ADMIN" && auth.role !== "OFFICE") {
    return { ok: false as const, error: "Not authorized." };
  }

  const siteId = clean(input.siteId);
  const productId = clean(input.productId);
  const description = clean(input.description);
  if (!siteId) return { ok: false as const, error: "Site is required." };
  if (!productId) return { ok: false as const, error: "Product is required." };
  if (!description)
    return { ok: false as const, error: "Description is required." };

  const areaM2 = cleanDecimal(input.areaM2);
  if (!areaM2 || areaM2 <= 0)
    return { ok: false as const, error: "Area must be positive." };

  const coats = Math.max(1, Math.round(Number(input.coats) || 1));
  const coverageM2PerUnit = cleanDecimal(input.coverageM2PerUnit);
  const unitSizeLitres = cleanDecimal(input.unitSizeLitres);

  if (!coverageM2PerUnit || coverageM2PerUnit <= 0)
    return { ok: false as const, error: "Coverage rate must be positive." };
  if (!unitSizeLitres || unitSizeLitres <= 0)
    return { ok: false as const, error: "Unit size must be positive." };

  const effectiveArea = areaM2 * coats;
  const containersNeeded = effectiveArea / coverageM2PerUnit;
  const requiredLitres = containersNeeded * unitSizeLitres;
  const roundedContainers = Math.ceil(containersNeeded);

  const costPerContainer = cleanDecimal(input.costPerContainer);
  const estimatedCost = costPerContainer
    ? roundedContainers * costPerContainer
    : null;

  const plan = await prisma.sitePaintPlan.create({
    data: {
      siteId,
      description,
      boqReference: clean(input.boqReference) || null,
      areaM2,
      productId,
      coverageId: clean(input.coverageId) || null,
      coats,
      requiredLitres: parseFloat(requiredLitres.toFixed(2)),
      requiredContainers: parseFloat(containersNeeded.toFixed(2)),
      roundedContainers,
      estimatedCost,
      note: clean(input.note) || null,
      createdByUserId: auth.userId,
    },
  });

  revalidatePath("/admin/paint-planning");
  return { ok: true as const, id: plan.id };
}

export async function deletePaintPlan(planId: string) {
  const auth = await requireServerAuth();
  if (auth.role !== "ADMIN" && auth.role !== "OFFICE") {
    return { ok: false as const, error: "Not authorized." };
  }

  const id = clean(planId);
  if (!id) return { ok: false as const, error: "Plan ID is required." };

  await prisma.sitePaintPlan.delete({ where: { id } });
  revalidatePath("/admin/paint-planning");
  return { ok: true as const };
}

// ─── Paint Usage ──────────────────────────────────────

export async function addPaintUsage(input: {
  planId: string;
  usedLitres?: number | null;
  usedContainers?: number | null;
  note?: string | null;
  usedOn?: string | null;
}) {
  const auth = await requireServerAuth();
  if (auth.role !== "ADMIN" && auth.role !== "OFFICE") {
    return { ok: false as const, error: "Not authorized." };
  }

  const planId = clean(input.planId);
  if (!planId) return { ok: false as const, error: "Plan is required." };

  const usedLitres = cleanDecimal(input.usedLitres);
  const usedContainers = cleanDecimal(input.usedContainers);
  if (!usedLitres && !usedContainers) {
    return { ok: false as const, error: "Enter litres or containers used." };
  }

  const usage = await prisma.sitePaintUsage.create({
    data: {
      planId,
      usedLitres,
      usedContainers,
      note: clean(input.note) || null,
      usedOn: input.usedOn ? new Date(input.usedOn) : new Date(),
      createdByUserId: auth.userId,
    },
  });

  revalidatePath("/admin/paint-planning");
  return { ok: true as const, id: usage.id };
}

export async function deletePaintUsage(usageId: string) {
  const auth = await requireServerAuth();
  if (auth.role !== "ADMIN" && auth.role !== "OFFICE") {
    return { ok: false as const, error: "Not authorized." };
  }

  const id = clean(usageId);
  if (!id) return { ok: false as const, error: "Usage ID is required." };

  await prisma.sitePaintUsage.delete({ where: { id } });
  revalidatePath("/admin/paint-planning");
  return { ok: true as const };
}

// ─── Lookup helpers ───────────────────────────────────

export async function listSitesForSelect() {
  await requireServerAuth();
  const sites = await prisma.site.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  });
  return { ok: true as const, sites };
}

export async function listProductsForSelect(q?: string) {
  await requireServerAuth();

  const where: any = { isActive: true };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { sku: { contains: q, mode: "insensitive" } },
    ];
  }

  const products = await prisma.procurementProduct.findMany({
    where,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      sku: true,
      uom: true,
      unitSize: true,
    },
  });

  return { ok: true as const, products: serialize(products) };
}
