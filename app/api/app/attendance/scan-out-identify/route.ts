import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { resolveActingForeman } from "@/lib/resolveActingForeman";
import { getFaceVerifier } from "@/lib/faceVerifier";
import {
  VERIFIED_THRESHOLD,
  PENDING_REVIEW_THRESHOLD,
  MIN_IDENTIFY_MARGIN,
} from "@/lib/faceVerificationThresholds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function startOfDayUTC(dateISO: string) {
  const d = new Date(`${dateISO}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid dateISO");
  return d;
}

/**
 * POST /api/app/attendance/scan-out-identify
 *
 * The continuous-scanner counterpart to scan-out-face: "here's a face, tell
 * me who this is" instead of "verify this specific employee". Candidate
 * pool is deliberately narrow — only employees scanned IN today at this
 * site with no scan-out yet (same set as GET .../day/scan-out-pending) —
 * never company-wide. That bound is the main defense against a wrong-person
 * match as the crew size grows (see faceVerificationThresholds.ts).
 *
 * A VERIFIED-band match with a clear margin over the next-closest employee
 * is recorded immediately. Anything less certain (PENDING_REVIEW band, or a
 * VERIFIED-band match too close to a runner-up to trust unattended) comes
 * back as needsConfirmation instead of being recorded — the client shows
 * the candidate and waits for a foreman tap before calling
 * scan-out-confirm. Detection/quality failures and "no plausible match" are
 * both reported as ok:false so the client can reset the scanner instead of
 * treating them as a hard error.
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
  const device = typeof body?.device === "string" ? body.device.slice(0, 200) : "";
  const image = typeof body?.image === "string" ? body.image : "";
  const checkLiveness = body?.checkLiveness === true;

  if (!siteId || !dateISO || !device || !image) {
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
    return NextResponse.json({ ok: false, error: "no_candidates" });
  }

  const scans = await prisma.attendanceScan.findMany({
    where: { siteDayId: siteDay.id, direction: "IN", scannedOutAt: null },
    select: { id: true, employeeId: true },
  });
  if (scans.length === 0) {
    return NextResponse.json({ ok: false, error: "no_candidates" });
  }

  const scanByEmployeeId = new Map(scans.map((s) => [s.employeeId, s]));
  const enrollments = await prisma.faceEnrollment.findMany({
    where: { employeeId: { in: Array.from(scanByEmployeeId.keys()) }, status: "APPROVED" },
    select: { id: true, employeeId: true, embedding: true },
  });
  if (enrollments.length === 0) {
    return NextResponse.json({ ok: false, error: "no_candidates" });
  }

  const imageBuffer = Buffer.from(image, "base64");
  const faceVerifier = getFaceVerifier();

  let result;
  try {
    result = await faceVerifier.verify(
      imageBuffer,
      enrollments.map((e) => e.embedding),
      { checkLiveness },
    );
  } catch (e) {
    console.error("Face identify failed, face-service unreachable or timed out:", e);
    return NextResponse.json({ ok: false, error: "service_unavailable" });
  }

  if (!result.ok) {
    // no_face_detected / multiple_faces_detected / low_quality — nothing to
    // identify, never a hard error: the client just resets the scanner.
    return NextResponse.json({ ok: false, error: result.error, warnings: result.warnings });
  }

  // Best distance per distinct employee (not per raw embedding) — an
  // employee with several close-together poses shouldn't look artificially
  // more "won" against themselves; the margin that matters is winner vs.
  // the next different person.
  const bestDistanceByEmployee = new Map<string, number>();
  for (let i = 0; i < enrollments.length; i++) {
    const employeeId = enrollments[i].employeeId;
    const distance = result.distances[i];
    const current = bestDistanceByEmployee.get(employeeId);
    if (current === undefined || distance < current) {
      bestDistanceByEmployee.set(employeeId, distance);
    }
  }

  const ranked = Array.from(bestDistanceByEmployee.entries()).sort((a, b) => a[1] - b[1]);
  const [winnerEmployeeId, winnerDistance] = ranked[0];
  const runnerUpDistance = ranked.length > 1 ? ranked[1][1] : Infinity;
  const margin = runnerUpDistance - winnerDistance;

  const matchedEnrollment = enrollments[result.bestIndex];
  const employee = await prisma.employee.findUnique({
    where: { id: winnerEmployeeId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!employee) {
    return NextResponse.json({ ok: false, error: "no_match" });
  }
  const fullName = `${employee.firstName} ${employee.lastName}`.trim();

  if (result.confidence < PENDING_REVIEW_THRESHOLD) {
    return NextResponse.json({ ok: false, error: "no_match" });
  }

  const canAutoRecord = result.confidence >= VERIFIED_THRESHOLD && margin >= MIN_IDENTIFY_MARGIN;

  if (!canAutoRecord) {
    return NextResponse.json({
      ok: true,
      recorded: false,
      needsConfirmation: true,
      employee: { id: employee.id, fullName },
      method: "FACE",
      confidence: result.confidence,
      matchedEnrollmentId: matchedEnrollment.id,
    });
  }

  const scan = scanByEmployeeId.get(winnerEmployeeId)!;
  const now = new Date();

  // Atomic conditional update, not read-then-write — two near-simultaneous
  // frames (or a race with scan-out-confirm) can never both record the same
  // employee's scan-out.
  const updateResult = await prisma.attendanceScan.updateMany({
    where: { id: scan.id, scannedOutAt: null },
    data: {
      scannedOutAt: now,
      scanOutMethod: "FACE",
      scanOutDevice: device,
      verificationStatus: "VERIFIED",
      scanOutFaceMatchScore: result.confidence,
    },
  });

  if (updateResult.count === 1) {
    await prisma.faceVerificationAttempt.create({
      data: {
        attendanceScanId: scan.id,
        employeeId: employee.id,
        matchedEnrollmentId: matchedEnrollment.id,
        confidence: result.confidence,
        livenessPassed: checkLiveness ? result.livenessPassed : undefined,
        processingTimeMs: result.processingTimeMs,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    recorded: true,
    employee: { id: employee.id, fullName },
    method: "FACE",
    confidence: result.confidence,
    verificationStatus: "VERIFIED",
    scannedOutAt: now.toISOString(),
  });
}
