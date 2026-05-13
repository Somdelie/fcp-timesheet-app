import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDaysUTC } from "@/lib/dateUtc";
import { requireApiAuth } from "@/lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}

async function getAdminFromRequest(req: NextRequest) {
  // 1) Prefer API Bearer token (mobile/desktop clients)
  const apiCtx = await requireApiAuth(req, ["ADMIN"]);
  if (apiCtx) {
    return { id: apiCtx.user.sub, role: apiCtx.user.role } as const;
  }

  // 2) Fallback to NextAuth web session (admin dashboard)
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;

  if (session?.user && role === "ADMIN") {
    return { id: (session.user as any).id as string, role } as const;
  }

  return null;
}

export async function GET(req: NextRequest) {
  const actor = await getAdminFromRequest(req);
  if (!actor) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const url = new URL(req.url);
  const siteId = url.searchParams.get("siteId");
  const foremanId = url.searchParams.get("foremanId");
  const supervisorId = url.searchParams.get("supervisorId");
  const dateStr = url.searchParams.get("date"); // YYYY-MM-DD

  // Default to last 7 days of workDate (inclusive of today)
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const sevenDaysAgo = addDaysUTC(todayStart, -6);

  // Build where clause
  const whereClause: any = {
    workDate: { gte: sevenDaysAgo, lt: addDaysUTC(todayStart, 1) },
  };

  if (siteId) {
    whereClause.siteId = siteId;
  }

  if (foremanId) {
    whereClause.siteDay = { ...whereClause.siteDay, foremanId };
  }

  if (dateStr) {
    const targetDate = new Date(`${dateStr}T00:00:00.000Z`);
    const nextDay = addDaysUTC(targetDate, 1);
    whereClause.workDate = {
      gte: targetDate,
      lt: nextDay,
    };
  }

  const scans = await prisma.attendanceScan.findMany({
    where: whereClause,
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          qrCodeValue: true,
        },
      },
      site: {
        select: {
          id: true,
          name: true,
          supervisorAssignments: {
            where: {
              startsOn: { lte: new Date() },
              OR: [{ endsOn: null }, { endsOn: { gt: new Date() } }],
            },
            include: {
              supervisor: {
                include: {
                  user: { select: { id: true, name: true } },
                },
              },
            },
            take: 1,
          },
        },
      },
      siteDay: {
        select: {
          id: true,
          workDate: true,
          foreman: {
            select: {
              id: true,
              user: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { scannedAt: "desc" },
    take: 1500,
  });

  // Map to response format with supervisor info
  let result = scans.map((scan) => {
    const supervisorAssignment = scan.site.supervisorAssignments[0];
    return {
      id: scan.id,
      employeeId: scan.employee.id,
      employeeName:
        `${scan.employee.firstName} ${scan.employee.lastName}`.trim(),
      employeeCode: scan.employee.qrCodeValue,
      siteId: scan.site.id,
      siteName: scan.site.name,
      foremanId: scan.siteDay.foreman.id,
      foremanName: scan.siteDay.foreman.user.name ?? "Unknown",
      supervisorId: supervisorAssignment?.supervisor.id ?? null,
      supervisorName: supervisorAssignment?.supervisor.user.name ?? null,
      workDateISO: scan.workDate.toISOString(),
      scannedAtISO: scan.scannedAt.toISOString(),
      scanType: scan.scanType,
      overtimeType: scan.overtimeType,
      latitude: scan.latitude,
      longitude: scan.longitude,
      address: scan.address,
    };
  });

  // Filter by supervisor if specified
  if (supervisorId) {
    result = result.filter((s) => s.supervisorId === supervisorId);
  }

  // Get unique sites, foremen and supervisors for filter dropdowns
  const sitesMap = new Map<string, string>();
  const foremenMap = new Map<string, string>();
  const supervisorsMap = new Map<string, string>();

  for (const scan of result) {
    sitesMap.set(scan.siteId, scan.siteName);
    foremenMap.set(scan.foremanId, scan.foremanName);
    if (scan.supervisorId && scan.supervisorName) {
      supervisorsMap.set(scan.supervisorId, scan.supervisorName);
    }
  }

  const sites = Array.from(sitesMap.entries()).map(([id, name]) => ({
    id,
    name,
  }));
  const foremen = Array.from(foremenMap.entries()).map(([id, name]) => ({
    id,
    name,
  }));
  const supervisors = Array.from(supervisorsMap.entries()).map(
    ([id, name]) => ({
      id,
      name,
    }),
  );

  return NextResponse.json(
    { scans: result, sites, foremen, supervisors },
    {
      headers: {
        ...CORS_HEADERS,
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
      },
    },
  );
}
