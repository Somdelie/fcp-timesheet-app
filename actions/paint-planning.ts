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

  const where: any = {
    isActive: true,
    rateMode: "COVERAGE",
    rateUnit: "M2_PER_L",
    coverageM2PerLitre: { not: null },
  };
  if (productId) where.productId = productId;

  const rows = await prisma.procurementProductCoverage.findMany({
    where,
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    include: {
      product: { select: { id: true, name: true, uom: true, unitSize: true } },
    },
  });

  return { ok: true as const, coverages: serialize(rows) };
}

export async function upsertCoverageProfile(input: {
  id?: string;
  productId: string;
  name?: string | null;
  applicationMethod?: string | null;
  coverageType?: "THEORETICAL" | "PRACTICAL";
  coverageBasis?: "PER_COAT" | "TOTAL_SYSTEM";
  recommendedCoats?: number | null;
  uom?: string | null;
  unitSize?: number | null;
  coverageM2PerLitre?: number | null;
  coverageM2?: number | null;
  recommendedDftMicrons?: number | null;
  recommendedWftMicrons?: number | null;
  sourceDocument?: string | null;
  sourceRevision?: string | null;
  sourceRevisionDate?: string | null;
  sourcePage?: number | null;
  note?: string | null;
  isDefault?: boolean;
}) {
  const auth = await requireServerAuth();
  if (auth.role !== "ADMIN" && auth.role !== "OFFICE") {
    return { ok: false as const, error: "Not authorized." };
  }

  const productId = clean(input.productId);
  if (!productId) return { ok: false as const, error: "Product is required." };

  const unitSize = cleanDecimal(input.unitSize);
  const providedPerLitre = cleanDecimal(input.coverageM2PerLitre);
  const providedPerUnit = cleanDecimal(input.coverageM2);
  const coverageM2PerLitre =
    providedPerLitre && providedPerLitre > 0
      ? providedPerLitre
      : providedPerUnit && providedPerUnit > 0 && unitSize && unitSize > 0
        ? providedPerUnit / unitSize
        : null;

  if (!coverageM2PerLitre || coverageM2PerLitre <= 0)
    return { ok: false as const, error: "Coverage must be positive." };

  const name = clean(input.name) || `Coverage ${new Date().toISOString()}`;
  const recommendedCoats = Math.max(
    1,
    Math.round(Number(input.recommendedCoats) || 1),
  );
  const recommendedDftMicrons = cleanDecimal(input.recommendedDftMicrons);
  const recommendedWftMicrons = cleanDecimal(input.recommendedWftMicrons);

  const data: any = {
    productId,
    name,
    applicationMethod: clean(input.applicationMethod) || null,
    applicationMethods: input.applicationMethod
      ? [clean(input.applicationMethod)]
      : undefined,
    rateMode: "COVERAGE",
    rateUnit: "M2_PER_L",
    rateMin: coverageM2PerLitre,
    rateMax: coverageM2PerLitre,
    coverageType: input.coverageType ?? "PRACTICAL",
    coverageM2: coverageM2PerLitre,
    coverageM2PerLitre,
    coverageBasis: input.coverageBasis ?? "PER_COAT",
    recommendedCoats,
    recommendedCoatsMin: recommendedCoats,
    recommendedCoatsMax: recommendedCoats,
    uom: input.uom || null,
    unitSize: unitSize != null ? unitSize : null,
    recommendedDftMicrons,
    recommendedWftMicrons,
    thicknessMin: recommendedDftMicrons ?? recommendedWftMicrons,
    thicknessMax: recommendedDftMicrons ?? recommendedWftMicrons,
    thicknessUnit:
      recommendedDftMicrons != null || recommendedWftMicrons != null
        ? "MICRON"
        : null,
    sourceDocument: clean(input.sourceDocument) || null,
    sourceRevision: clean(input.sourceRevision) || null,
    sourceRevisionDate: input.sourceRevisionDate
      ? new Date(input.sourceRevisionDate)
      : null,
    sourcePage:
      input.sourcePage != null && Number.isFinite(Number(input.sourcePage))
        ? Math.max(1, Math.round(Number(input.sourcePage)))
        : null,
    note: clean(input.note) || null,
    isDefault: Boolean(input.isDefault),
  };

  if (data.isDefault) {
    await prisma.procurementProductCoverage.updateMany({
      where: { productId, isDefault: true },
      data: { isDefault: false },
    });
  }

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
          name: true,
          rateMode: true,
          rateUnit: true,
          coverageM2PerLitre: true,
          coverageBasis: true,
          coverageType: true,
          recommendedCoats: true,
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
          name: true,
          coverageM2PerLitre: true,
          coverageBasis: true,
          coverageType: true,
          recommendedCoats: true,
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
  coverageBasis?: "PER_COAT" | "TOTAL_SYSTEM";
  coverageNameSnapshot?: string | null;
  coverageM2PerLitre?: number | null;
  coverageM2PerUnit?: number | null;
  unitSizeLitres?: number | null;
  containerSizeLitres?: number | null;
  wastagePercent?: number | null;
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
  const containerSizeLitres =
    cleanDecimal(input.containerSizeLitres) ??
    cleanDecimal(input.unitSizeLitres);

  let coverageBasis: "PER_COAT" | "TOTAL_SYSTEM" =
    input.coverageBasis ?? "PER_COAT";

  let coverageNameSnapshot = clean(input.coverageNameSnapshot) || null;

  let coverageM2PerLitre = cleanDecimal(input.coverageM2PerLitre);
  const coverageM2PerUnit = cleanDecimal(input.coverageM2PerUnit);
  if (!coverageM2PerLitre && coverageM2PerUnit && containerSizeLitres) {
    coverageM2PerLitre = coverageM2PerUnit / containerSizeLitres;
  }

  if (input.coverageId) {
    const selectedCoverage = await prisma.procurementProductCoverage.findUnique(
      {
        where: { id: input.coverageId },
        select: {
          id: true,
          productId: true,
          name: true,
          rateMode: true,
          rateUnit: true,
          coverageM2PerLitre: true,
          coverageBasis: true,
        },
      },
    );

    if (
      !selectedCoverage ||
      selectedCoverage.productId !== productId ||
      selectedCoverage.rateMode !== "COVERAGE" ||
      selectedCoverage.rateUnit !== "M2_PER_L" ||
      selectedCoverage.coverageM2PerLitre === null
    ) {
      return {
        ok: false as const,
        error: "Select a compatible m²/L coverage profile.",
      };
    }

    if (!coverageM2PerLitre || coverageM2PerLitre <= 0) {
      coverageM2PerLitre = Number(selectedCoverage.coverageM2PerLitre);
    }

    if (!coverageNameSnapshot) coverageNameSnapshot = selectedCoverage.name;
    if (!input.coverageBasis) {
      coverageBasis = selectedCoverage.coverageBasis ?? "PER_COAT";
    }
  }

  const wastagePercent = Math.max(0, cleanDecimal(input.wastagePercent) ?? 0);

  if (!coverageM2PerLitre || coverageM2PerLitre <= 0)
    return { ok: false as const, error: "Coverage rate must be positive." };
  if (!containerSizeLitres || containerSizeLitres <= 0)
    return { ok: false as const, error: "Unit size must be positive." };

  const coatFactor = coverageBasis === "PER_COAT" ? coats : 1;
  const requiredLitresBeforeWastage =
    (areaM2 * coatFactor) / coverageM2PerLitre;
  const wastageLitres = requiredLitresBeforeWastage * (wastagePercent / 100);
  const requiredLitres = requiredLitresBeforeWastage + wastageLitres;
  const containersNeeded = requiredLitres / containerSizeLitres;
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
      coverageNameSnapshot,
      coverageM2PerLitreSnapshot: parseFloat(coverageM2PerLitre.toFixed(3)),
      coverageBasisSnapshot: coverageBasis,
      containerSizeLitresSnapshot: parseFloat(containerSizeLitres.toFixed(3)),
      wastagePercent: parseFloat(wastagePercent.toFixed(2)),
      requiredLitresBeforeWastage: parseFloat(
        requiredLitresBeforeWastage.toFixed(2),
      ),
      wastageLitres: parseFloat(wastageLitres.toFixed(2)),
      requiredLitres: parseFloat(requiredLitres.toFixed(2)),
      requiredContainers: parseFloat(containersNeeded.toFixed(2)),
      roundedContainers,
      estimatedCost,
      note: clean(input.note) || null,
      createdByUserId: auth.userId,
    },
  });

  revalidatePath("/admin/paint-planning");
  revalidatePath("/admin/sites-operations");
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
