import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminOrSupervisorFromRequest } from "@/lib/adminOrSupervisorAuth";
import { writeAuditEvent } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  action: z.enum(["MARK_VALID", "REQUEST_EXPLANATION"]),
  note: z.string().optional().nullable(),
});

/**
 * POST /api/app/admin/attendance-scans/[id]/review
 *
 * Daily Exception Dashboard actions that don't mutate the underlying scan:
 * Mark Valid (dismiss the exception) and Request Explanation (notify the
 * foreman). "Add Scan Out" and "Remove Attendance" are separate endpoints
 * since they actually change data (see add-scan-out route and the
 * existing Global Trash DELETE on /api/admin/attendance-scans).
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const actor = await getAdminOrSupervisorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = BodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { id: attendanceScanId } = await ctx.params;

  const scan = await prisma.attendanceScan.findUnique({
    where: { id: attendanceScanId },
    select: {
      id: true,
      siteDay: { select: { foreman: { select: { user: { select: { id: true } } } } } },
    },
  });
  if (!scan) {
    return NextResponse.json({ error: "Attendance scan not found" }, { status: 404 });
  }

  const review = await prisma.attendanceScanReview.create({
    data: {
      attendanceScanId,
      action: body.data.action,
      note: body.data.note ?? null,
      byUserId: actor.id,
    },
    select: { id: true, action: true, createdAt: true },
  });

  if (body.data.action === "REQUEST_EXPLANATION") {
    await prisma.notification.create({
      data: {
        userId: scan.siteDay.foreman.user.id,
        type: "ATTENDANCE_EXPLANATION_REQUESTED",
        title: "Explanation requested",
        message:
          body.data.note?.trim() ||
          "An admin has requested an explanation for one of your attendance records.",
      },
    });
  }

  await writeAuditEvent({
    actorUserId: actor.id,
    action: `attendance_scan_review_${body.data.action.toLowerCase()}`,
    entity: "AttendanceScan",
    entityId: attendanceScanId,
    metadata: { note: body.data.note ?? null },
  });

  return NextResponse.json({
    ok: true,
    review: { id: review.id, action: review.action, createdAtISO: review.createdAt.toISOString() },
  });
}
