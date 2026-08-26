import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";

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
 * POST /api/app/supervisor/scan-out-confirm
 *
 * Records the scan-out for a candidate that scan-out-identify returned as
 * needsConfirmation, once the supervisor taps "Yes, that's them". siteId
 * comes back from that identify response (the site it auto-detected), and
 * is re-validated here against the supervisor's current site assignments
 * rather than trusted as-is.
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

  const now = new Date();
  const siteAssignment = await prisma.supervisorSiteAssignment.findFirst({
    where: {
      supervisorId: supervisor.id,
      siteId,
      startsOn: { lte: now },
      OR: [{ endsOn: null }, { endsOn: { gt: now } }],
    },
    select: { id: true },
  });
  if (!siteAssignment) {
    return NextResponse.json({ error: "You are not assigned to this site." }, { status: 403 });
  }

  const scan = await prisma.attendanceScan.findFirst({
    where: { siteId, employeeId, workDate, direction: "IN" },
    select: { id: true, scannedOutAt: true },
  });
  if (!scan) {
    return NextResponse.json({ ok: false, error: "no_scan_in" });
  }
  if (scan.scannedOutAt) {
    return NextResponse.json({ ok: true, recorded: false, alreadyClockedOut: true });
  }

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
