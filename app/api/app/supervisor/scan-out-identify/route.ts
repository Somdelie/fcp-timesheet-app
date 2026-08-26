import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { getFaceVerifier } from "@/lib/faceVerifier";
import {
  VERIFIED_THRESHOLD,
  PENDING_REVIEW_THRESHOLD,
  MIN_IDENTIFY_MARGIN,
} from "@/lib/faceVerificationThresholds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

async function getAuth(req: Request) {
  let userId: string | null = null;
  let role: string | null = null;

  const token = getBearer(req);
  if (token) {
    const payload = await verifyApiToken(token);
    if (!payload) return { userId: null, role: null };
    userId = payload.sub;
    role = payload.role;
  } else {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    userId = user?.id ?? null;
    role = user?.role ?? null;
  }

  return { userId, role };
}

function startOfDayUTC(dateISO: string) {
  const d = new Date(`${dateISO}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid dateISO");
  return d;
}

/**
 * POST /api/app/supervisor/scan-out-identify
 *
 * Supervisor counterpart of /api/app/attendance/scan-out-identify. A
 * supervisor oversees several sites/foremen at once, so unlike the foreman
 * version there is no siteId in the request - the candidate pool is every
 * not-yet-scanned-out IN scan across every site this supervisor is
 * currently assigned to (SupervisorSiteAssignment), and the matched
 * employee's site/foreman are resolved from whichever scan wins the face
 * match, then returned so the client can show what was auto-detected.
 */
export async function POST(req: Request) {
  const { userId, role } = await getAuth(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "SUPERVISOR")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supervisor = await prisma.supervisor.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!supervisor)
    return NextResponse.json(
      { error: "Supervisor not found" },
      { status: 404 },
    );

  const body = await req.json().catch(() => null);
  const dateISO = typeof body?.dateISO === "string" ? body.dateISO : "";
  const device = typeof body?.device === "string" ? body.device.slice(0, 200) : "";
  const image = typeof body?.image === "string" ? body.image : "";
  const checkLiveness = body?.checkLiveness === true;

  if (!dateISO || !device || !image) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  let workDate: Date;
  try {
    workDate = startOfDayUTC(dateISO);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const now = new Date();
  const assignments = await prisma.supervisorSiteAssignment.findMany({
    where: {
      supervisorId: supervisor.id,
      startsOn: { lte: now },
      OR: [{ endsOn: null }, { endsOn: { gt: now } }],
    },
    select: { siteId: true },
  });
  const siteIds = Array.from(new Set(assignments.map((a) => a.siteId)));
  if (siteIds.length === 0) {
    return NextResponse.json({ ok: false, error: "no_candidates" });
  }

  const scans = await prisma.attendanceScan.findMany({
    where: {
      siteId: { in: siteIds },
      workDate,
      direction: "IN",
      scannedOutAt: null,
    },
    select: {
      id: true,
      employeeId: true,
      site: { select: { id: true, name: true } },
      siteDay: {
        select: {
          foreman: { select: { id: true, user: { select: { name: true } } } },
        },
      },
    },
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
    return NextResponse.json({ ok: false, error: result.error, warnings: result.warnings });
  }

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
  const [winnerEmployeeId] = ranked[0];
  const winnerDistance = ranked[0][1];
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

  const scan = scanByEmployeeId.get(winnerEmployeeId)!;
  const site = { id: scan.site.id, name: scan.site.name };
  const foreman = scan.siteDay.foreman
    ? { id: scan.siteDay.foreman.id, name: scan.siteDay.foreman.user.name ?? "Unknown foreman" }
    : null;

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
      site,
      foreman,
    });
  }

  // Atomic conditional update, not read-then-write — see the equivalent
  // comment in attendance/scan-out-identify.
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
    site,
    foreman,
  });
}
