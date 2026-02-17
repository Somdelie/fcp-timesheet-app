import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDaysUTC } from "@/lib/dateUtc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const siteId = url.searchParams.get("siteId");
  const foremanId = url.searchParams.get("foremanId");
  const supervisorId = url.searchParams.get("supervisorId");
  const dateStr = url.searchParams.get("date"); // YYYY-MM-DD

  // Default to last 7 days
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const sevenDaysAgo = addDaysUTC(todayStart, -7);

  // Build where clause
  const whereClause: any = {
    scannedAt: { gte: sevenDaysAgo },
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
    take: 500, // Limit for performance
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

  return NextResponse.json({ scans: result, sites, foremen, supervisors });
}
