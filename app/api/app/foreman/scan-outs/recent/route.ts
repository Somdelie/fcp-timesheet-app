import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { resolveActingForeman } from "@/lib/resolveActingForeman";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RECENT_DAYS = 7;

/**
 * GET /api/app/foreman/scan-outs/recent
 *
 * Last 7 days of completed scan-outs across every site this foreman worked
 * - feeds office-app's (foreman)/scan-outs.tsx. Ownership follows
 * AttendanceScan.siteDay.foremanId, same as the reminder crons, not
 * ForemanSiteAssignment - a scan stays "this foreman's" even if their site
 * assignment has since ended.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token)
    return NextResponse.json({ error: "Missing token" }, { status: 401 });

  const payload = await verifyApiToken(token);
  if (!payload)
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  if (payload.role !== "FOREMAN" && payload.role !== "EMPLOYEE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const forForemanId =
    url.searchParams.get("forForemanId") ||
    req.headers.get("x-acting-foreman-id")?.trim() ||
    null;

  const resolved = await resolveActingForeman(payload.sub, forForemanId);
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status },
    );
  }
  const actingForemanId = resolved.foremanId!;

  const since = new Date();
  since.setDate(since.getDate() - RECENT_DAYS);

  const scans = await prisma.attendanceScan.findMany({
    where: {
      scannedOutAt: { gte: since },
      siteDay: { foremanId: actingForemanId },
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
