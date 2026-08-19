import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminOrSupervisorFromRequest } from "@/lib/adminOrSupervisorAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/app/admin/employees/[id]/face-verification-history
 *
 * Backs the Verified-tab profile dialog on the admin Face Verifications page
 * — recent FaceVerificationAttempt rows for one employee (the scan-out
 * verification audit trail), separate from FaceEnrollment's reference
 * photos. No new table: FaceVerificationAttempt already exists and is
 * already written by app/api/app/attendance/scan-out-face/route.ts; this is
 * the first route that reads it back.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const actor = await getAdminOrSupervisorFromRequest(req, ["ADMIN"]);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const attempts = await prisma.faceVerificationAttempt.findMany({
    where: { employeeId: id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      confidence: true,
      livenessPassed: true,
      processingTimeMs: true,
      createdAt: true,
      matchedEnrollment: { select: { pose: true } },
      attendanceScan: { select: { workDate: true } },
    },
  });

  return NextResponse.json({
    attempts: attempts.map((a) => ({
      id: a.id,
      confidence: a.confidence,
      livenessPassed: a.livenessPassed,
      processingTimeMs: a.processingTimeMs,
      createdAtISO: a.createdAt.toISOString(),
      matchedPose: a.matchedEnrollment?.pose ?? null,
      workDateISO: a.attendanceScan?.workDate?.toISOString() ?? null,
    })),
  });
}
