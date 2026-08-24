import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminOrSupervisorFromRequest } from "@/lib/adminOrSupervisorAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set(["PENDING_APPROVAL", "APPROVED", "REJECTED"]);

/**
 * GET /api/app/admin/face-enrollments?status=PENDING_APPROVAL
 *
 * Backs the admin Face Verifications review page — lists FaceEnrollment
 * rows (defaults to the review queue, PENDING_APPROVAL) so an admin can
 * approve/reject reference photos captured by foremen via
 * office-app's capture-reference.tsx. Approve/reject actions themselves are
 * the existing [id]/approve and [id]/reject routes; this is just the list.
 */
export async function GET(req: NextRequest) {
  const actor = await getAdminOrSupervisorFromRequest(req, ["ADMIN"]);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const statusParam = req.nextUrl.searchParams.get("status")?.toUpperCase();
  const status = statusParam && VALID_STATUSES.has(statusParam) ? statusParam : "PENDING_APPROVAL";

  const enrollments = await prisma.faceEnrollment.findMany({
    where: { status: status as any },
    orderBy: { enrolledAt: "asc" },
    take: 500,
    select: {
      id: true,
      pose: true,
      imageUrl: true,
      qualityScore: true,
      status: true,
      rejectedReason: true,
      enrolledAt: true,
      approvedAt: true,
      device: true,
      employee: { select: { id: true, firstName: true, lastName: true } },
      enrolledByForeman: { select: { id: true, user: { select: { name: true } } } },
      enrolledBySupervisor: { select: { id: true, user: { select: { name: true } } } },
      approvedByUser: { select: { name: true } },
    },
  });

  return NextResponse.json({
    enrollments: enrollments.map((e) => ({
      id: e.id,
      employeeId: e.employee.id,
      employeeName: `${e.employee.firstName} ${e.employee.lastName}`.trim(),
      pose: e.pose,
      imageUrl: e.imageUrl,
      qualityScore: e.qualityScore,
      status: e.status,
      rejectedReason: e.rejectedReason,
      enrolledAtISO: e.enrolledAt.toISOString(),
      approvedAtISO: e.approvedAt?.toISOString() ?? null,
      device: e.device,
      foremanName:
        e.enrolledByForeman?.user.name ??
        e.enrolledBySupervisor?.user.name ??
        "Unknown",
      approvedByName: e.approvedByUser?.name ?? null,
    })),
  });
}
