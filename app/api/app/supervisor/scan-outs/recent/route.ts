import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import type { ScanOutMethod } from "@/generated/prisma/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RECENT_DAYS = 7;

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

/**
 * GET /api/app/supervisor/scan-outs/recent?method=FACE
 *
 * Last 7 days of completed scan-outs across every site this supervisor is
 * assigned to - feeds office-app's "Face scan-outs" tab. Scoped by
 * SupervisorSiteAssignment (same pattern as /supervisor/site-day-photos),
 * not by who ran the scan.
 */
export async function GET(req: Request) {
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

  const url = new URL(req.url);
  const method = url.searchParams.get("method") as ScanOutMethod | null;

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
  if (siteIds.length === 0) return NextResponse.json({ scanOuts: [] });

  const since = new Date();
  since.setDate(since.getDate() - RECENT_DAYS);

  const scans = await prisma.attendanceScan.findMany({
    where: {
      siteId: { in: siteIds },
      scannedOutAt: { gte: since },
      ...(method ? { scanOutMethod: method } : {}),
    },
    orderBy: { scannedOutAt: "desc" },
    select: {
      id: true,
      scannedOutAt: true,
      scanOutMethod: true,
      verificationStatus: true,
      scanOutFaceMatchScore: true,
      scanOutFingerprintMatchScore: true,
      employee: { select: { firstName: true, lastName: true, faceImageUrl: true } },
      site: { select: { id: true, name: true } },
    },
  });

  const scanOuts = scans.map((s) => {
    const confidence =
      s.scanOutMethod === "FACE"
        ? s.scanOutFaceMatchScore
        : s.scanOutMethod === "FINGERPRINT"
          ? s.scanOutFingerprintMatchScore
          : null;

    return {
      id: s.id,
      employeeName: `${s.employee.firstName} ${s.employee.lastName}`.trim(),
      faceImageUrl: s.employee.faceImageUrl ?? null,
      siteId: s.site.id,
      siteName: s.site.name,
      scannedOutAtISO: s.scannedOutAt!.toISOString(),
      method: s.scanOutMethod,
      confidence: confidence ?? null,
      verificationStatus: s.verificationStatus,
    };
  });

  return NextResponse.json({ scanOuts });
}
