import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminOrSupervisorFromRequest } from "@/lib/adminOrSupervisorAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/app/admin/face-enrollments/[id]/reject  body: { reason: string }
 *
 * `reason` is required — a foreman checking a rejected enrollment needs to
 * know why before recapturing, and an unexplained rejection is just as
 * unhelpful as the silent per-photo failures capture-reference.tsx used to
 * paper over.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const actor = await getAdminOrSupervisorFromRequest(req, ["ADMIN"]);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!reason) {
    return NextResponse.json(
      { error: "A rejection reason is required" },
      { status: 400 },
    );
  }

  const enrollment = await prisma.faceEnrollment.findUnique({ where: { id } });
  if (!enrollment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.faceEnrollment.update({
    where: { id },
    data: {
      status: "REJECTED",
      approvedByUserId: actor.id,
      approvedAt: new Date(),
      rejectedReason: reason,
    },
    select: { id: true, status: true, rejectedReason: true },
  });

  return NextResponse.json({ enrollment: updated });
}
