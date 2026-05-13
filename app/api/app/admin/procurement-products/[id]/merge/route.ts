import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { mergeProcurementProducts } from "@/lib/procurement/mergeProcurementProducts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
    if (p && p.role === "ADMIN")
      return { id: p.sub, role: "ADMIN" as const };
  }
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (session?.user && role === "ADMIN")
    return { id: (session.user as any).id as string, role: "ADMIN" as const };
  return null;
}

/**
 * POST /api/app/admin/procurement-products/[id]/merge
 * Body: { targetId: string }
 *
 * Merges the source product ([id]) into the target product (targetId):
 * - Re-points all SitePlantAssignment records to targetId
 * - Re-points all PlantTransfer records to targetId
 * - Adds source.stockQty to target.stockQty
 * - Deletes the source product
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });

    const { id: sourceId } = await ctx.params;
    const body = await req.json();
    const { targetId } = body as { targetId?: string };

    if (!targetId || targetId === sourceId)
      return NextResponse.json(
        { error: "targetId must be a different product" },
        { status: 400, headers: CORS },
      );

    const [source, target] = await Promise.all([
      prisma.procurementProduct.findUnique({ where: { id: sourceId }, select: { id: true, stockQty: true, name: true } }),
      prisma.procurementProduct.findUnique({ where: { id: targetId }, select: { id: true, stockQty: true, name: true } }),
    ]);

    if (!source)
      return NextResponse.json({ error: "Source product not found" }, { status: 404, headers: CORS });
    if (!target)
      return NextResponse.json({ error: "Target product not found" }, { status: 404, headers: CORS });

    await prisma.$transaction(
      async (tx) => {
        await mergeProcurementProducts(tx, sourceId, targetId);
      },
      { maxWait: 10000, timeout: 30000 },
    );

    return NextResponse.json({ ok: true }, { headers: CORS });
  } catch (e: any) {
    console.error("merge procurement-product error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500, headers: CORS });
  }
}
