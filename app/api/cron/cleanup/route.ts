import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteImage } from "@/lib/cloudinary";
import { authorizedCron } from "@/lib/cronAuth";

/**
 * Cron-callable cleanup endpoint.
 * Secured via CRON_SECRET env var — pass it as ?secret=... or Authorization: Bearer ...
 *
 * This runs ALL cleanup tasks in sequence:
 *   1. Delete inactive employees (no scans for 2 months)
 *   2. Delete inactive sites (no scans for 6 months)
 *   3. Prune paid timesheet scan data
 *
 * Schedule via Vercel Cron, Windows Task Scheduler, or any HTTP scheduler:
 *   GET /api/cron/cleanup?secret=YOUR_CRON_SECRET
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function extractPublicId(url: string): string | null {
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/);
  return match?.[1] ?? null;
}

export async function GET(req: NextRequest) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, any> = {};

  try {
    // 1. Inactive employees (2 months)
    const empCutoff = new Date();
    empCutoff.setMonth(empCutoff.getMonth() - 2);

    const inactiveEmployees = await prisma.employee.findMany({
      where: {
        isActive: true,
        attendance: { none: { scannedAt: { gte: empCutoff } } },
      },
      select: { id: true, firstName: true, lastName: true, faceImageUrl: true },
    });

    let empDeleted = 0;
    for (const emp of inactiveEmployees) {
      if (emp.faceImageUrl) {
        const pubId = extractPublicId(emp.faceImageUrl);
        if (pubId) await deleteImage(pubId).catch(() => {});
      }
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
      empDeleted++;
    }
    results.inactiveEmployees = { deleted: empDeleted };

    // 2. Inactive sites (6 months)
    const siteCutoff = new Date();
    siteCutoff.setMonth(siteCutoff.getMonth() - 6);

    const inactiveSites = await prisma.site.findMany({
      where: {
        isActive: true,
        attendanceScans: { none: { scannedAt: { gte: siteCutoff } } },
      },
      select: { id: true, name: true },
    });

    let siteDeleted = 0;
    for (const site of inactiveSites) {
      await prisma.$transaction([
        prisma.attendanceScan.deleteMany({ where: { siteId: site.id } }),
        prisma.foremanSiteAssignment.deleteMany({
          where: { siteId: site.id },
        }),
        prisma.supervisorSiteAssignment.deleteMany({
          where: { siteId: site.id },
        }),
        prisma.employeeDayRateOverride.deleteMany({
          where: { siteId: site.id },
        }),
        prisma.siteForemanDayRateOverride.deleteMany({
          where: { siteId: site.id },
        }),
        prisma.siteDay.deleteMany({ where: { siteId: site.id } }),
        prisma.timesheet.deleteMany({ where: { siteId: site.id } }),
        prisma.site.delete({ where: { id: site.id } }),
      ]);
      siteDeleted++;
    }
    results.inactiveSites = { deleted: siteDeleted };

    // 3. Prune paid timesheet scan data
    const paidTimesheets = await prisma.timesheet.findMany({
      where: { status: "PAID" },
      select: {
        id: true,
        foremanId: true,
        siteId: true,
        period: { select: { startDate: true, endDate: true } },
      },
    });

    let prunedScans = 0;
    for (const ts of paidTimesheets) {
      if (!ts.siteId || !ts.period) continue;
      const endExcl = new Date(ts.period.endDate);
      endExcl.setDate(endExcl.getDate() + 1);

      const siteDays = await prisma.siteDay.findMany({
        where: {
          foremanId: ts.foremanId,
          siteId: ts.siteId,
          workDate: { gte: ts.period.startDate, lt: endExcl },
        },
        select: { id: true },
      });
      if (!siteDays.length) continue;

      const { count } = await prisma.attendanceScan.deleteMany({
        where: { siteDayId: { in: siteDays.map((sd) => sd.id) } },
      });
      prunedScans += count;
    }
    results.prunedPaidScans = { pruned: prunedScans };

    return NextResponse.json({
      ok: true,
      ranAt: new Date().toISOString(),
      results,
    });
  } catch (err: any) {
    console.error("Cron cleanup error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Cleanup failed" },
      { status: 500 },
    );
  }
}
