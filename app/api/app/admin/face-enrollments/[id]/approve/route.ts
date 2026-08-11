import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminOrSupervisorFromRequest } from "@/lib/adminOrSupervisorAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/app/admin/face-enrollments/[id]/approve
 *
 * Admin-only (unlike most daily-exception review actions, which allow
 * supervisors too) — approving a biometric reference image is more
 * sensitive than reviewing an attendance exception.
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

  const enrollment = await prisma.faceEnrollment.findUnique({ where: { id } });
  if (!enrollment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.faceEnrollment.update({
    where: { id },
    data: {
      status: "APPROVED",
      approvedByUserId: actor.id,
      approvedAt: new Date(),
      rejectedReason: null,
    },
    select: { id: true, status: true, approvedAt: true },
  });

  return NextResponse.json({ enrollment: updated });
}
