import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { uploadImageBuffer, getSecureUrl } from "@/lib/cloudinary";
import { getFaceVerifier, type FaceEnrollmentPose } from "@/lib/faceVerifier";
import { employeeWhereFor } from "@/lib/employee-scope";

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
 * POST /api/app/supervisor/employees/[id]/face-enrollments
 *
 * Supervisor equivalent of the foreman face-enrollment route (see
 * app/api/app/foreman/employees/[id]/face-enrollments/route.ts, which this
 * mirrors) - captures reference photos for an employee within the
 * supervisor's scope (own-created, or linked/scanned via their foremen, see
 * lib/employee-scope.ts). Same PENDING_APPROVAL lifecycle, one row per photo.
 *
 * multipart/form-data:
 *   photos: File[]   (1-5 images)
 *   poses:  string    JSON array of pose labels, same order as photos
 *                     (FRONT | LEFT | RIGHT | SMILE | NEUTRAL)
 *   device, latitude, longitude: optional metadata
 *
 * Never blocks anything else - a failed enrollment attempt here has no
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
    if (!payload || payload.role !== "SUPERVISOR") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supervisor = await prisma.supervisor.findUnique({
      where: { userId: payload.sub },
      select: { id: true },
    });
    if (!supervisor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const employeeId = id;

    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        ...employeeWhereFor({ userId: payload.sub, role: "SUPERVISOR" }),
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

    // Same duplicate-face gate as the foreman route - every other employee's
    // currently-live embeddings, fetched once up front.
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
      // See the foreman route for why connection/timeout failures get their
      // own honest, retryable message instead of falling into the generic
      // catch below.
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
          enrolledBySupervisorId: supervisor.id,
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
    console.error("Face enrollment error", e);
    return NextResponse.json({ error: "Enrollment failed. Please try again." }, { status: 500 });
  }
}

/**
 * GET /api/app/supervisor/employees/[id]/face-enrollments
 * Lists this employee's enrollments (any status), scoped to employees the
 * supervisor can see (see lib/employee-scope.ts).
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
  if (!payload || payload.role !== "SUPERVISOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;

  const employee = await prisma.employee.findFirst({
    where: {
      id,
      ...employeeWhereFor({ userId: payload.sub, role: "SUPERVISOR" }),
    },
    select: { id: true },
  });
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

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
