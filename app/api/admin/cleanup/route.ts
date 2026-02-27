import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { verifyApiToken } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
import { deleteImage } from "@/lib/cloudinary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

async function getAdmin(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (token) {
    const payload = await verifyApiToken(token);
    if (payload && payload.role === "ADMIN") {
      return { id: payload.sub, role: "ADMIN" as const };
    }
  }

  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;

  if (session?.user && role === "ADMIN") {
    return { id: (session.user as any).id as string, role: "ADMIN" as const };
  }

  return null;
}

// ─── Extract Cloudinary public_id from a URL ────────────────────────
function extractPublicId(url: string): string | null {
  try {
    // e.g. https://res.cloudinary.com/xxx/image/upload/v123/employees/abc.jpg
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

// ─── Inactive employees: no scans for N months → hard-delete ─────────
async function cleanupInactiveEmployees(months: number) {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);

  // Find employees whose latest scan is older than cutoff (or have no scans)
  const employees = await prisma.employee.findMany({
    where: {
      isActive: true,
      attendance: { none: { scannedAt: { gte: cutoff } } },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      faceImageUrl: true,
      userId: true,
    },
  });

  if (!employees.length) return { deletedCount: 0, employees: [] };

  const deleted: { id: string; name: string }[] = [];

  for (const emp of employees) {
    // Delete face image from Cloudinary
    if (emp.faceImageUrl) {
      const pubId = extractPublicId(emp.faceImageUrl);
      if (pubId) await deleteImage(pubId).catch(() => {});
    }

    // Delete related records, then the employee
    await prisma.$transaction([
      prisma.attendanceScan.deleteMany({ where: { employeeId: emp.id } }),
      prisma.foremanEmployee.deleteMany({ where: { employeeId: emp.id } }),
      prisma.foremanAssistant.deleteMany({ where: { employeeId: emp.id } }),
      prisma.photoDetection.deleteMany({ where: { employeeId: emp.id } }),
      prisma.deduction.deleteMany({ where: { employeeId: emp.id } }),
      prisma.employeeDayRateOverride.deleteMany({
        where: { employeeId: emp.id },
      }),
      prisma.employee.delete({ where: { id: emp.id } }),
    ]);

    deleted.push({
      id: emp.id,
      name: `${emp.firstName} ${emp.lastName}`.trim(),
    });
  }

  return { deletedCount: deleted.length, employees: deleted };
}

// ─── Inactive sites: no scans for N months → hard-delete ─────────────
async function cleanupInactiveSites(months: number) {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);

  const sites = await prisma.site.findMany({
    where: {
      isActive: true,
      attendanceScans: { none: { scannedAt: { gte: cutoff } } },
    },
    select: { id: true, name: true, code: true },
  });

  if (!sites.length) return { deletedCount: 0, sites: [] };

  const deleted: { id: string; name: string }[] = [];

  for (const site of sites) {
    // Clean up related records then the site
    await prisma.$transaction([
      prisma.attendanceScan.deleteMany({ where: { siteId: site.id } }),
      prisma.foremanSiteAssignment.deleteMany({ where: { siteId: site.id } }),
      prisma.supervisorSiteAssignment.deleteMany({
        where: { siteId: site.id },
      }),
      prisma.employeeDayRateOverride.deleteMany({
        where: { siteId: site.id },
      }),
      prisma.siteForemanDayRateOverride.deleteMany({
        where: { siteId: site.id },
      }),
      // SiteDays cascade should handle photos, but be safe
      prisma.siteDay.deleteMany({ where: { siteId: site.id } }),
      prisma.timesheet.deleteMany({ where: { siteId: site.id } }),
      prisma.site.delete({ where: { id: site.id } }),
    ]);

    deleted.push({ id: site.id, name: site.name });
  }

  return { deletedCount: deleted.length, sites: deleted };
}

// ─── Prune paid timesheets: delete scan data for PAID timesheets ─────
async function prunePaidTimesheets() {
  // Find all PAID timesheets
  const paidTimesheets = await prisma.timesheet.findMany({
    where: { status: "PAID" },
    select: {
      id: true,
      foremanId: true,
      siteId: true,
      period: { select: { startDate: true, endDate: true } },
    },
  });

  if (!paidTimesheets.length) return { prunedCount: 0 };

  let prunedScans = 0;

  for (const ts of paidTimesheets) {
    if (!ts.siteId || !ts.period) continue;

    const startDate = ts.period.startDate;
    const endDate = new Date(ts.period.endDate);
    endDate.setDate(endDate.getDate() + 1); // exclusive

    // Get siteDays for this foreman+site+period
    const siteDays = await prisma.siteDay.findMany({
      where: {
        foremanId: ts.foremanId,
        siteId: ts.siteId,
        workDate: { gte: startDate, lt: endDate },
      },
      select: { id: true },
    });

    if (!siteDays.length) continue;

    const siteDayIds = siteDays.map((sd) => sd.id);

    // Delete attendance scans for these site days
    const { count } = await prisma.attendanceScan.deleteMany({
      where: { siteDayId: { in: siteDayIds } },
    });

    prunedScans += count;
  }

  return { prunedCount: prunedScans };
}

// ─── GET: Preview what would be cleaned ──────────────────────────────
export async function GET(req: NextRequest) {
  const admin = await getAdmin(req);
  if (!admin)
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: CORS },
    );

  const cutoffEmployees = new Date();
  cutoffEmployees.setMonth(cutoffEmployees.getMonth() - 2);

  const cutoffSites = new Date();
  cutoffSites.setMonth(cutoffSites.getMonth() - 6);

  const [inactiveEmployees, inactiveSites, paidTimesheets] = await Promise.all([
    prisma.employee.count({
      where: {
        isActive: true,
        attendance: { none: { scannedAt: { gte: cutoffEmployees } } },
      },
    }),
    prisma.site.count({
      where: {
        isActive: true,
        attendanceScans: { none: { scannedAt: { gte: cutoffSites } } },
      },
    }),
    prisma.timesheet.count({ where: { status: "PAID" } }),
  ]);

  return NextResponse.json(
    {
      preview: {
        inactiveEmployees,
        inactiveSites,
        paidTimesheets,
      },
    },
    { headers: CORS },
  );
}

// ─── POST: Run cleanup tasks ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  const admin = await getAdmin(req);
  if (!admin)
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: CORS },
    );

  const body = await req.json().catch(() => ({}));
  const task = body?.task as string | undefined;

  if (!task) {
    return NextResponse.json(
      {
        error:
          "Missing 'task' in body. Use: inactive-employees, inactive-sites, prune-paid",
      },
      { status: 400, headers: CORS },
    );
  }

  try {
    switch (task) {
      case "inactive-employees": {
        const months = body?.months ?? 2;
        const result = await cleanupInactiveEmployees(months);
        return NextResponse.json(
          { ok: true, task, ...result },
          { headers: CORS },
        );
      }
      case "inactive-sites": {
        const months = body?.months ?? 6;
        const result = await cleanupInactiveSites(months);
        return NextResponse.json(
          { ok: true, task, ...result },
          { headers: CORS },
        );
      }
      case "prune-paid": {
        const result = await prunePaidTimesheets();
        return NextResponse.json(
          { ok: true, task, ...result },
          { headers: CORS },
        );
      }
      default:
        return NextResponse.json(
          { error: `Unknown task: ${task}` },
          { status: 400, headers: CORS },
        );
    }
  } catch (err: any) {
    console.error(`Cleanup task "${task}" failed:`, err);
    return NextResponse.json(
      { error: err?.message ?? "Cleanup failed" },
      { status: 500, headers: CORS },
    );
  }
}
