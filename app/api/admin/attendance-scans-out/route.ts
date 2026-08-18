import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDaysUTC, startOfDayUTC, joburgTodayISO } from "@/lib/dateUtc";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// scanOutMethod only actually gets set to "FACE" anywhere in the app today
// (see scan-out-face/route.ts) — PHOTO/FINGERPRINT are schema-only, never
// written. A foreman's bulk "photo-witnessed" close-out (scan-out-all/route.ts)
// leaves scanOutMethod null but sets scanOutPhotoId; an admin's manual
// Add-Scan-Out (add-scan-out/route.ts) leaves both null. Bucketing by what's
// actually distinguishable in the data, not by the unused enum values.
type MethodBucket = "FACE" | "PHOTO_BULK" | "MANUAL";

function methodBucket(scanOutMethod: string | null, scanOutPhotoId: string | null): MethodBucket {
  if (scanOutMethod === "FACE") return "FACE";
  if (scanOutPhotoId) return "PHOTO_BULK";
  return "MANUAL";
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const siteId = url.searchParams.get("siteId") || null;
  const team = url.searchParams.get("team") || null;
  const q = (url.searchParams.get("q") || "").trim();
  const fromStr = url.searchParams.get("from"); // YYYY-MM-DD
  const toStr = url.searchParams.get("to"); // YYYY-MM-DD

  const today = joburgTodayISO();
  const from = fromStr ? startOfDayUTC(fromStr) : startOfDayUTC(today);
  const to = toStr ? startOfDayUTC(toStr) : startOfDayUTC(today);

  const whereClause: any = {
    scannedOutAt: { gte: from, lt: addDaysUTC(to, 1) },
  };

  if (siteId) whereClause.siteId = siteId;
  if (team) whereClause.team = team;

  if (q) {
    const terms = q.split(/\s+/).filter(Boolean);
    whereClause.employee = {
      AND: terms.map((term) => ({
        OR: [
          { firstName: { contains: term, mode: "insensitive" } },
          { lastName: { contains: term, mode: "insensitive" } },
          { qrCodeValue: { contains: term, mode: "insensitive" } },
        ],
      })),
    };
  }

  const scans = await prisma.attendanceScan.findMany({
    where: whereClause,
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true, qrCodeValue: true, faceImageUrl: true },
      },
      site: { select: { id: true, name: true, code: true } },
      siteDay: {
        select: { foreman: { select: { id: true, user: { select: { name: true } } } } },
      },
    },
    orderBy: { scannedOutAt: "desc" },
    take: 1500,
  });

  const allMapped = scans.map((scan) => ({
    id: scan.id,
    employeeId: scan.employee.id,
    employeeName: `${scan.employee.firstName} ${scan.employee.lastName}`.trim(),
    employeeCode: scan.employee.qrCodeValue,
    employeePhotoUrl: scan.employee.faceImageUrl ?? null,
    siteId: scan.site.id,
    siteName: scan.site.name,
    siteCode: scan.site.code,
    team: scan.team,
    foremanName: scan.siteDay.foreman.user.name ?? "Unknown",
    scannedAtISO: scan.scannedAt.toISOString(),
    scannedOutAtISO: scan.scannedOutAt!.toISOString(),
    methodBucket: methodBucket(scan.scanOutMethod, scan.scanOutPhotoId),
    verificationStatus: scan.verificationStatus,
    confidence: scan.scanOutFaceMatchScore,
    device: scan.scanOutDevice,
    latitude: scan.latitude,
    longitude: scan.longitude,
    address: scan.address,
  }));

  // Stats reflect the full date/site/team/search-filtered set, independent
  // of the method/status tab the client currently has selected.
  const stats = {
    total: allMapped.length,
    face: allMapped.filter((s) => s.methodBucket === "FACE").length,
    photoBulk: allMapped.filter((s) => s.methodBucket === "PHOTO_BULK").length,
    manual: allMapped.filter((s) => s.methodBucket === "MANUAL").length,
    failedRejected: allMapped.filter((s) => s.verificationStatus === "REJECTED").length,
  };

  // Dropdown options built from the full filtered result (matches the
  // sibling attendance-scans route's convention).
  const sitesMap = new Map<string, { name: string; code: string | null }>();
  const teamsSet = new Set<string>();
  for (const scan of allMapped) {
    sitesMap.set(scan.siteId, { name: scan.siteName, code: scan.siteCode });
    if (scan.team) teamsSet.add(scan.team);
  }
  const sites = Array.from(sitesMap.entries()).map(([id, site]) => ({ id, ...site }));
  const teams = Array.from(teamsSet.values()).sort();

  return NextResponse.json(
    { scans: allMapped, sites, teams, stats },
    { headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } },
  );
}
