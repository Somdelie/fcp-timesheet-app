import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminOrSupervisorFromRequest } from "@/lib/adminOrSupervisorAuth";
import { writeAuditEvent } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  scannedOutAtISO: z.string().datetime().optional(),
  note: z.string().optional().nullable(),
});

/**
 * POST /api/app/admin/attendance-scans/[id]/add-scan-out
 *
 * Daily Exception Dashboard "Add Scan Out" action — an admin manually
 * closes out a missing scan-out. Records who did it and why via the
 * existing AttendanceScanReview + AuditEvent trail; never touches
 * scanOutMethod (stays null, distinguishing it from PHOTO/FINGERPRINT).
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
    select: { id: true, scannedOutAt: true, direction: true },
  });
  if (!scan) {
    return NextResponse.json({ error: "Attendance scan not found" }, { status: 404 });
  }
  if (scan.direction !== "IN") {
    return NextResponse.json({ error: "This scan has no scan-out to add" }, { status: 400 });
  }
  if (scan.scannedOutAt) {
    return NextResponse.json({ error: "This scan already has a scan-out" }, { status: 409 });
  }

  const scannedOutAt = body.data.scannedOutAtISO
    ? new Date(body.data.scannedOutAtISO)
    : new Date();

  await prisma.$transaction([
    prisma.attendanceScan.update({
      where: { id: attendanceScanId },
      data: { scannedOutAt },
    }),
    prisma.attendanceScanReview.create({
      data: {
        attendanceScanId,
        action: "ADD_SCAN_OUT",
        note: body.data.note ?? null,
        byUserId: actor.id,
      },
    }),
  ]);

  await writeAuditEvent({
    actorUserId: actor.id,
    action: "attendance_scan_add_scan_out",
    entity: "AttendanceScan",
    entityId: attendanceScanId,
    metadata: { scannedOutAtISO: scannedOutAt.toISOString(), note: body.data.note ?? null },
  });

  return NextResponse.json({ ok: true, scannedOutAtISO: scannedOutAt.toISOString() });
}
