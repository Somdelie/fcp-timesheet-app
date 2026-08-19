import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { resolveActingForeman } from "@/lib/resolveActingForeman";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function startOfDayUTC(dateISO: string) {
  const d = new Date(`${dateISO}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid dateISO");
  return d;
}

/**
 * POST /api/app/attendance/scan-out-confirm
 *
 * Records the scan-out for a candidate that scan-out-identify returned as
 * needsConfirmation — called only after the foreman taps "Yes, that's them"
 * on the scanner screen. A foreman visually confirming the match is treated
 * as at least as strong a signal as the algorithmic VERIFIED threshold, so
 * this records VERIFIED too; the original (below-threshold) confidence is
 * still stored on the attempt row, so the fact that this one needed a human
 * look stays visible in the audit trail even though the outcome reads the
 * same as an auto-accepted match.
 */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await verifyApiToken(token);
  if (!payload)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (payload.role !== "FOREMAN" && payload.role !== "EMPLOYEE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const siteId = typeof body?.siteId === "string" ? body.siteId : "";
  const dateISO = typeof body?.dateISO === "string" ? body.dateISO : "";
  const employeeId = typeof body?.employeeId === "string" ? body.employeeId : "";
  const device = typeof body?.device === "string" ? body.device.slice(0, 200) : "";
  const confidence = typeof body?.confidence === "number" ? body.confidence : null;
  const matchedEnrollmentId =
    typeof body?.matchedEnrollmentId === "string" ? body.matchedEnrollmentId : null;

  if (!siteId || !dateISO || !employeeId || !device || confidence === null) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  let workDate: Date;
  try {
    workDate = startOfDayUTC(dateISO);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const actingForemanIdHeader =
    req.headers.get("x-acting-foreman-id")?.trim() || null;
  const resolved = await resolveActingForeman(payload.sub, actingForemanIdHeader);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const actingForemanId = resolved.foremanId!;

  const siteAssignment = await prisma.foremanSiteAssignment.findFirst({
    where: {
      foremanId: actingForemanId,
      siteId,
      startsOn: { lte: new Date() },
      OR: [{ endsOn: null }, { endsOn: { gt: new Date() } }],
    },
    select: { id: true },
  });
  if (!siteAssignment) {
    return NextResponse.json({ error: "You are not assigned to this site." }, { status: 403 });
  }

  const siteDay = await prisma.siteDay.findFirst({
    where: { foremanId: actingForemanId, siteId, workDate },
    select: { id: true },
  });
  if (!siteDay) {
    return NextResponse.json({ ok: false, error: "no_scan_in" });
  }

  const scan = await prisma.attendanceScan.findFirst({
    where: { siteDayId: siteDay.id, employeeId, direction: "IN" },
    select: { id: true, scannedOutAt: true },
  });
  if (!scan) {
    return NextResponse.json({ ok: false, error: "no_scan_in" });
  }
  if (scan.scannedOutAt) {
    // Benign race (another frame/confirm already recorded this employee) —
    // the desired end state already holds, not an error.
    return NextResponse.json({ ok: true, recorded: false, alreadyClockedOut: true });
  }

  const now = new Date();
  const updateResult = await prisma.attendanceScan.updateMany({
    where: { id: scan.id, scannedOutAt: null },
    data: {
      scannedOutAt: now,
      scanOutMethod: "FACE",
      scanOutDevice: device,
      verificationStatus: "VERIFIED",
      scanOutFaceMatchScore: confidence,
    },
  });

  if (updateResult.count === 1 && matchedEnrollmentId) {
    await prisma.faceVerificationAttempt.create({
      data: {
        attendanceScanId: scan.id,
        employeeId,
        matchedEnrollmentId,
        confidence,
      },
    });
  }

  if (updateResult.count === 0) {
    return NextResponse.json({ ok: true, recorded: false, alreadyClockedOut: true });
  }

  return NextResponse.json({ ok: true, recorded: true, scannedOutAt: now.toISOString() });
}
