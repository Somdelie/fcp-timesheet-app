import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { resolveActingForeman } from "@/lib/resolveActingForeman";
import { joburgTodayISO, startOfDayUTC } from "@/lib/dateUtc";
import { getFaceVerifier } from "@/lib/faceVerifier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

const BodySchema = z.object({
  employeeId: z.string().min(1),
  device: z.string().min(1).max(200),
  // Phase 2 (all optional — older clients / no-image fallback still work
  // exactly like Phase 1 did): base64 JPEG/PNG of the live capture, plus
  // whether the client showed the Phase 3 "turn your head" liveness prompt
  // before capturing.
  image: z.string().min(1).optional(),
  checkLiveness: z.boolean().optional(),
});

// Placeholder bands (design doc §8) — NOT yet calibrated against real site
// photos. Revisit once Phase 0/pilot has real confidence distributions.
const VERIFIED_THRESHOLD = 0.9;
const PENDING_REVIEW_THRESHOLD = 0.75;

/**
 * POST /api/app/attendance/scan-out-face
 *
 * Individual, employee-initiated face scan-out (as opposed to the existing
 * bulk photo-witnessed scan-out-all). The employee is selected from their
 * profile first — identity comes from that selection, not from any
 * biometric check.
 *
 * Phase 2: if the client sends a captured `image` and the employee has at
 * least one APPROVED FaceEnrollment, this now calls the real face-service
 * for verification and bands the result into VERIFIED / PENDING_REVIEW /
 * REJECTED. If there's no image, no approved enrollments, or face-service
 * is unreachable/errors, this falls back to the exact Phase 1 behavior
 * (PENDING_REVIEW, no comparison attempted) — verification NEVER blocks
 * attendance; only "no scan-in today" / "already scanned out" do.
 *
 * Not scoped to the acting foreman's own site day: workers are sometimes
 * scanned in by one foreman and scanned out by another later the same day.
 */
export async function POST(req: Request) {
  const token = getBearer(req);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = await verifyApiToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (payload.role !== "FOREMAN" && payload.role !== "EMPLOYEE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const actingForemanIdHeader =
    req.headers.get("x-acting-foreman-id")?.trim() || null;
  const resolved = await resolveActingForeman(
    payload.sub,
    actingForemanIdHeader,
  );
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status },
    );
  }

  const body = BodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const { employeeId, device, image, checkLiveness } = body.data;

  const workDate = startOfDayUTC(joburgTodayISO());

  const scan = await prisma.attendanceScan.findFirst({
    where: {
      employeeId,
      workDate,
      direction: "IN",
    },
    select: { id: true, scannedOutAt: true },
  });

  if (!scan) {
    return NextResponse.json(
      { error: "No scan-in found today. Cannot scan out." },
      { status: 409 },
    );
  }
  if (scan.scannedOutAt) {
    return NextResponse.json(
      { error: "This guy is already scanned out." },
      { status: 409 },
    );
  }

  // Phase 1 default — overwritten below only if a real comparison succeeds.
  let verificationStatus: "VERIFIED" | "PENDING_REVIEW" | "REJECTED" =
    "PENDING_REVIEW";
  let scanOutFaceMatchScore: number | undefined;
  // Response-only (not persisted — verificationStatus/schema unchanged) so
  // the client can tell "no face was even found in the photo" / "the photo
  // itself is unusable" apart from "a face was found but we're not
  // confident it matches" instead of all three silently reading as the same
  // PENDING_REVIEW outcome.
  let noFaceReason: "no_face_detected" | "multiple_faces_detected" | "low_quality" | undefined;
  let qualityWarnings: string[] | undefined;

  if (image) {
    const approvedEnrollments = await prisma.faceEnrollment.findMany({
      where: { employeeId, status: "APPROVED" },
      select: { id: true, embedding: true },
    });

    if (approvedEnrollments.length > 0) {
      try {
        const imageBuffer = Buffer.from(image, "base64");
        const faceVerifier = getFaceVerifier();
        const result = await faceVerifier.verify(
          imageBuffer,
          approvedEnrollments.map((e) => e.embedding),
          { checkLiveness },
        );

        if (result.ok) {
          scanOutFaceMatchScore = result.confidence;

          if (result.confidence >= VERIFIED_THRESHOLD) {
            verificationStatus = "VERIFIED";
          } else if (result.confidence >= PENDING_REVIEW_THRESHOLD) {
            verificationStatus = "PENDING_REVIEW";
          } else {
            verificationStatus = "REJECTED";
          }

          // Liveness failure downgrades to PENDING_REVIEW regardless of
          // confidence — never a hard block, just "a human should look at
          // this one" (design doc §9/§11).
          if (checkLiveness && result.livenessPassed === false) {
            verificationStatus = "PENDING_REVIEW";
          }

          await prisma.faceVerificationAttempt.create({
            data: {
              attendanceScanId: scan.id,
              employeeId,
              matchedEnrollmentId: approvedEnrollments[result.bestIndex]?.id,
              confidence: result.confidence,
              livenessPassed: checkLiveness ? result.livenessPassed : undefined,
              processingTimeMs: result.processingTimeMs,
            },
          });
        } else if (
          result.error === "no_face_detected" ||
          result.error === "multiple_faces_detected" ||
          result.error === "low_quality"
        ) {
          // verificationStatus/DB stays the Phase 1 PENDING_REVIEW default
          // (detection/quality failing isn't grounds to reject or block
          // clocking out), but the client should say so honestly instead of
          // showing the same "couldn't confidently match" copy it'd show for
          // a genuinely ambiguous comparison. low_quality never reaches
          // findBestMatch on the face-service side, so this is always a
          // "we didn't attempt a comparison" case, never a low-confidence one.
          noFaceReason = result.error;
          if (result.error === "low_quality") qualityWarnings = result.warnings;
        }
        // Any other result.ok === false case (including a timeout, which
        // throws and lands in the outer catch below instead): leave the
        // Phase 1 PENDING_REVIEW default in place, no attempt row — nothing
        // meaningful to log when detection itself failed for another reason.
      } catch (e) {
        // face-service unreachable or errored — never let a biometric
        // engine failure block clocking out.
        console.error(
          "Face verification failed, falling back to PENDING_REVIEW:",
          e,
        );
      }
    }
  }

  const now = new Date();
  await prisma.attendanceScan.update({
    where: { id: scan.id },
    data: {
      scannedOutAt: now,
      scanOutMethod: "FACE",
      scanOutDevice: device,
      verificationStatus,
      ...(scanOutFaceMatchScore !== undefined ? { scanOutFaceMatchScore } : {}),
    },
    select: { id: true },
  });

  return NextResponse.json({
    ok: true,
    scannedOutAt: now.toISOString(),
    verificationStatus,
    confidence: scanOutFaceMatchScore ?? null,
    device,
    ...(noFaceReason ? { reason: noFaceReason } : {}),
    ...(qualityWarnings ? { warnings: qualityWarnings } : {}),
  });
}
