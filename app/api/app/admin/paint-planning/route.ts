import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { Decimal } from "@prisma/client/runtime/client";

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

/** GET /api/app/admin/paint-planning */
export async function GET(req: Request) {
  const auth = await getAuth(req);
  if (!auth)
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: CORS },
    );

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get("siteId") || undefined;
  const productId = searchParams.get("productId") || undefined;

  const where: any = {};
  if (siteId) where.siteId = siteId;
  if (productId) where.productId = productId;

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

  // Also return sites and products for filter dropdowns
  const [sites, products] = await Promise.all([
    prisma.site.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
    prisma.procurementProduct.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true, uom: true, unitSize: true },
    }),
  ]);

  return NextResponse.json(
    {
      plans: serialize(plans),
      sites: serialize(sites),
      products: serialize(products),
    },
    { headers: CORS },
  );
}

/** POST /api/app/admin/paint-planning */
export async function POST(req: Request) {
  const auth = await getAuth(req);
  if (!auth)
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: CORS },
    );

  const body = await req.json();
  const {
    siteId,
    description,
    boqReference,
    areaM2,
    productId,
    coverageId,
    coats,
    coverageBasis,
    coverageNameSnapshot,
    coverageM2PerLitre,
    unitSizeLitres,
    containerSizeLitres,
    wastagePercent,
    costPerContainer,
    note,
  } = body;

  if (!siteId)
    return NextResponse.json(
      { error: "Site is required" },
      { status: 400, headers: CORS },
    );
  if (!productId)
    return NextResponse.json(
      { error: "Product is required" },
      { status: 400, headers: CORS },
    );
  if (!description)
    return NextResponse.json(
      { error: "Description is required" },
      { status: 400, headers: CORS },
    );

  const parsedAreaM2 = Number(areaM2);
  const parsedCoats = Math.max(1, Math.round(Number(coats) || 1));
  const parsedCoverageM2PerLitre = Number(coverageM2PerLitre);
  const parsedContainerSizeLitres = Number(
    containerSizeLitres ?? unitSizeLitres,
  );
  const parsedWastagePercent = Math.max(0, Number(wastagePercent ?? 0));
  const parsedCoverageBasis =
    coverageBasis === "TOTAL_SYSTEM" ? "TOTAL_SYSTEM" : "PER_COAT";

  if (!parsedAreaM2 || parsedAreaM2 <= 0)
    return NextResponse.json(
      { error: "Area must be positive" },
      { status: 400, headers: CORS },
    );
  if (!parsedCoverageM2PerLitre || parsedCoverageM2PerLitre <= 0)
    return NextResponse.json(
      { error: "Coverage rate must be positive" },
      { status: 400, headers: CORS },
    );
  if (!parsedContainerSizeLitres || parsedContainerSizeLitres <= 0)
    return NextResponse.json(
      { error: "Unit size must be positive" },
      { status: 400, headers: CORS },
    );

  const coatFactor = parsedCoverageBasis === "PER_COAT" ? parsedCoats : 1;
  const requiredLitresBeforeWastage =
    (parsedAreaM2 * coatFactor) / parsedCoverageM2PerLitre;
  const wastageLitres =
    requiredLitresBeforeWastage * (parsedWastagePercent / 100);
  const requiredLitres = requiredLitresBeforeWastage + wastageLitres;
  const containersNeeded = requiredLitres / parsedContainerSizeLitres;
  const roundedContainers = Math.ceil(containersNeeded);
  const parsedCostPerContainer = costPerContainer
    ? Number(costPerContainer)
    : null;
  const estimatedCost =
    parsedCostPerContainer && parsedCostPerContainer > 0
      ? roundedContainers * parsedCostPerContainer
      : null;

  const plan = await prisma.sitePaintPlan.create({
    data: {
      siteId,
      description,
      boqReference: boqReference || null,
      areaM2: parsedAreaM2,
      productId,
      coverageId: coverageId || null,
      coats: parsedCoats,
      coverageNameSnapshot: coverageNameSnapshot || null,
      coverageM2PerLitreSnapshot: Number(parsedCoverageM2PerLitre.toFixed(3)),
      coverageBasisSnapshot: parsedCoverageBasis,
      containerSizeLitresSnapshot: Number(parsedContainerSizeLitres.toFixed(3)),
      wastagePercent: Number(parsedWastagePercent.toFixed(2)),
      requiredLitresBeforeWastage: Number(
        requiredLitresBeforeWastage.toFixed(2),
      ),
      wastageLitres: Number(wastageLitres.toFixed(2)),
      requiredLitres: parseFloat(requiredLitres.toFixed(2)),
      requiredContainers: parseFloat(containersNeeded.toFixed(2)),
      roundedContainers,
      estimatedCost,
      note: note || null,
      createdByUserId: auth.id,
    },
  });

  return NextResponse.json(
    { ok: true, id: plan.id },
    { status: 201, headers: CORS },
  );
}
