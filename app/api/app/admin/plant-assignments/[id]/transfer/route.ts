import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAuth(req: Request) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (session?.user && (role === "ADMIN" || role === "OFFICE" || role === "SUPERVISOR"))
    return { id: (session.user as any).id as string, role };
  return null;
}

/**
 * POST /api/app/admin/plant-assignments/[id]/transfer
 *
 * Atomically:
 *   1. Validates source assignment has enough quantity
 *   2. Reduces (or closes) the source assignment
 *   3. Creates a new deployment assignment at the destination site
 *   4. Logs a PlantTransfer record for full audit trail
 *
 * Body: { toSiteId, quantity, note? }
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: fromAssignmentId } = await ctx.params;
    const body = await req.json();
    const { toSiteId, quantity, note } = body as {
      toSiteId: string;
      quantity: number;
      note?: string;
    };

    if (!toSiteId)
      return NextResponse.json({ error: "toSiteId is required" }, { status: 400 });
    if (!quantity || quantity < 1)
      return NextResponse.json({ error: "quantity must be at least 1" }, { status: 400 });

    // Load source
    const source = await prisma.sitePlantAssignment.findUnique({
      where: { id: fromAssignmentId },
    });
    if (!source)
      return NextResponse.json({ error: "Source assignment not found" }, { status: 404 });
    if (source.status === "RETURNED" || source.status === "LOST")
      return NextResponse.json({ error: "Cannot transfer — source is already returned or lost" }, { status: 400 });
    if (quantity > source.quantity)
      return NextResponse.json(
        { error: `Cannot transfer ${quantity} — source only has ${source.quantity}` },
        { status: 400 },
      );
    if (source.siteId === toSiteId)
      return NextResponse.json({ error: "Source and destination site are the same" }, { status: 400 });

    // Run everything in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Reduce or close source
      const remaining = source.quantity - quantity;
      const updatedSource = await tx.sitePlantAssignment.update({
        where: { id: fromAssignmentId },
        data:
          remaining === 0
            ? { quantity: 0, status: "RETURNED", returnedOn: new Date() }
            : { quantity: remaining },
      });

      // 2. Create destination assignment
      const dest = await tx.sitePlantAssignment.create({
        data: {
          siteId: toSiteId,
          productId: source.productId,
          quantity,
          size: source.size,
          condition: source.condition,
          status: "DEPLOYED",
          deployedOn: new Date(),
          note: note?.trim() || null,
          assignedByUserId: auth.id,
          transferredFromSiteId: source.siteId,
          transferredFromAssignmentId: source.id,
        },
      });

      // 3. Log the transfer
      const transfer = await tx.plantTransfer.create({
        data: {
          productId: source.productId,
          quantity,
          fromSiteId: source.siteId,
          toSiteId,
          fromAssignmentId: source.id,
          toAssignmentId: dest.id,
          note: note?.trim() || null,
          transferredByUserId: auth.id,
          transferredOn: new Date(),
        },
      });

      return { updatedSource, dest, transfer };
    });

    // Return enriched destination for immediate UI refresh
    const dest = await prisma.sitePlantAssignment.findUnique({
      where: { id: result.dest.id },
      include: {
        product: { select: { id: true, name: true, thumbnailUrl: true } },
        site: { select: { id: true, name: true, code: true } },
        assignedByUser: { select: { id: true, name: true } },
        transfersIn: {
          include: {
            fromSite: { select: { id: true, name: true, code: true } },
            transferredByUser: { select: { id: true, name: true } },
          },
          orderBy: { transferredOn: "desc" },
          take: 1,
        },
      },
    });

    return NextResponse.json({ ok: true, data: dest }, { status: 201 });
  } catch (e: any) {
    console.error("POST plant-assignment transfer error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
