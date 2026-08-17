import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { uploadImageBuffer, getSecureUrl } from "@/lib/cloudinary";
import { getFaceVerifier, type FaceEnrollmentPose } from "@/lib/faceVerifier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

const VALID_POSES = new Set(["FRONT", "LEFT", "RIGHT", "SMILE", "NEUTRAL"]);

const DUPLICATE_FACE_DISTANCE_THRESHOLD = 0.5;

/**
 * POST /api/app/foreman/employees/[id]/face-enrollments
 *
 * Foreman captures reference photos for an employee (Phase 2, see
 * office-app/FACE_VERIFICATION_TECHNICAL_DESIGN.md). Mirrors
 * FingerprintEnrollment's lifecycle (PENDING_APPROVAL until an admin
 * approves), but one-to-many: each photo becomes its own FaceEnrollment
 * row rather than a single record, since matching needs several reference
 * images per employee.
 *
 * multipart/form-data:
 *   photos: File[]   (1-5 images)
 *   poses:  string    JSON array of pose labels, same order as photos
 *                     (FRONT | LEFT | RIGHT | SMILE | NEUTRAL)
 *   device, latitude, longitude: optional metadata, same as fingerprint enrollment
 *
 * Never blocks anything else — a failed enrollment attempt here has no
 * effect on the employee's ability to scan in/out via existing methods.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const token = getBearer(req);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const payload = await verifyApiToken(token);
    if (!payload || payload.role !== "FOREMAN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const foreman = await prisma.foreman.findUnique({
      where: { userId: payload.sub },
      select: { id: true },
    });
    if (!foreman) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const employeeId = id;

    // Same employee-ownership definition as the existing photo upload route.
    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        OR: [
          { createdByUserId: payload.sub },
          { foremanLinks: { some: { foremanId: foreman.id } } },
          { attendance: { some: { siteDay: { foremanId: foreman.id } } } },
        ],
      },
      select: { id: true },
    });
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const formData = await req.formData();
    const files = formData.getAll("photos").filter((f): f is File => f instanceof File);
    const posesRaw = formData.get("poses");
    const device = (formData.get("device") as string | null) ?? undefined;
    const latitude = formData.get("latitude")
      ? Number(formData.get("latitude"))
      : undefined;
    const longitude = formData.get("longitude")
      ? Number(formData.get("longitude"))
      : undefined;

    if (files.length === 0 || files.length > 5) {
      return NextResponse.json(
        { error: "Provide 1-5 photos in the 'photos' field" },
        { status: 400 },
      );
    }

    let poses: string[];
    try {
      poses = JSON.parse(String(posesRaw));
    } catch {
      return NextResponse.json(
        { error: "'poses' must be a JSON array matching photos order" },
        { status: 400 },
      );
    }
    if (!Array.isArray(poses) || poses.length !== files.length || poses.some((p) => !VALID_POSES.has(p))) {
      return NextResponse.json(
        { error: "'poses' must match photos length, each one of FRONT/LEFT/RIGHT/SMILE/NEUTRAL" },
        { status: 400 },
      );
    }

    const buffers = await Promise.all(files.map((f) => f.arrayBuffer().then(Buffer.from)));

    // Every other employee's currently-live embeddings (approved or still
    // pending review) — fetched once up front so the duplicate-face check
    // below doesn't re-query per photo. APPROVED + PENDING_APPROVAL only:
    // a REJECTED photo shouldn't keep blocking a real distinct worker.
    const otherEmployeeEmbeddings = await prisma.faceEnrollment
      .findMany({
        where: { employeeId: { not: employeeId }, status: { in: ["APPROVED", "PENDING_APPROVAL"] } },
        select: { embedding: true },
      })
      .then((rows) => rows.map((r) => r.embedding));

    const faceVerifier = getFaceVerifier();
    let outcomes;
    try {
      outcomes = await faceVerifier.enroll(buffers, poses as FaceEnrollmentPose[]);
    } catch (e: any) {
      // Unlike scan-out-face, enrollment can't gracefully "fall back" when
      // face-service is unreachable — producing the embedding *is* the
      // point, there's nothing meaningful to save without it. So instead of
      // letting this fall into the generic catch below (which would surface
      // a raw error message to the foreman), recognize connection-level and
      // timeout failures specifically and return an honest, retryable
      // message. A fetch aborted by AbortSignal.timeout() throws a
      // DOMException named "TimeoutError" with no `.cause` at all (verified
      // directly against this runtime, not assumed) — a different shape
      // from a raw network-level ECONNREFUSED/ETIMEDOUT, so both need their
      // own check.
      const isConnectionFailure = e?.cause?.code === "ECONNREFUSED" || e?.cause?.code === "ETIMEDOUT";
      const isTimeout = e?.name === "TimeoutError";
      if (isConnectionFailure || isTimeout) {
        console.error("Face enrollment error: face-service unreachable or timed out", e);
        return NextResponse.json(
          { error: "Face verification service is temporarily unavailable. Please try again shortly." },
          { status: 503 },
        );
      }
      throw e;
    }

    const results: (
      | { id: string; pose: string; qualityScore: number | null }
      | { pose: string; error: string; warnings?: string[] }
    )[] = [];

    for (let i = 0; i < outcomes.length; i++) {
      const outcome = outcomes[i];
      const pose = poses[i];

      if ("error" in outcome) {
        results.push({ pose, error: outcome.error, ...(outcome.warnings ? { warnings: outcome.warnings } : {}) });
        continue;
      }

      // Duplicate-face gate: the same real face shouldn't end up enrolled
      // under two different Employee records. Distance threshold is
      // stricter than compare.ts's general "distance <= 0.6 = same person"
      // verification rule of thumb — a false positive here wrongly blocks a
      // real, distinct worker, so this errs conservative. Starting point,
      // not calibrated against real data yet.
      if (otherEmployeeEmbeddings.length > 0) {
        const match = await faceVerifier.matchEmbedding(outcome.embedding, otherEmployeeEmbeddings);
        if (match && match.distance <= DUPLICATE_FACE_DISTANCE_THRESHOLD) {
          results.push({ pose, error: "duplicate_face" });
          continue;
        }
      }

      const upload = await uploadImageBuffer(buffers[i], { folder: "face-enrollments" });
      const imageUrl = getSecureUrl(upload);

      const created = await prisma.faceEnrollment.create({
        data: {
          employeeId,
          pose: pose as any,
          imageUrl,
          embedding: outcome.embedding,
          qualityScore: outcome.qualityScore,
          enrolledByForemanId: foreman.id,
          device,
          latitude,
          longitude,
        },
        select: { id: true, pose: true, qualityScore: true },
      });

      results.push(created);
    }

    return NextResponse.json({ results });
  } catch (e: any) {
    // Unexpected/internal failure (not one of the specific, deliberate
    // face-service error codes above, which are returned per-photo in the
    // 200 `results` array and never reach this catch) — log the real error
    // server-side, but never forward its raw message to the client.
    console.error("Face enrollment error", e);
    return NextResponse.json({ error: "Enrollment failed. Please try again." }, { status: 500 });
  }
}

/**
 * GET /api/app/foreman/employees/[id]/face-enrollments
 * Lists this employee's enrollments (any status) — lets the enrollment UI
 * show current progress/approval state.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const token = getBearer(req);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = await verifyApiToken(token);
  if (!payload || payload.role !== "FOREMAN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;

  const enrollments = await prisma.faceEnrollment.findMany({
    where: { employeeId: id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      pose: true,
      imageUrl: true,
      qualityScore: true,
      status: true,
      rejectedReason: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ enrollments });
}
