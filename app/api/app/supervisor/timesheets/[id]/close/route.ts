import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { parseSupervisorTimesheetId } from "@/lib/timesheetId";
import { addDaysUTC, startOfDayUTC, isoFromDateUTC } from "@/lib/dateUtc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

async function getAuth(req: Request) {
  const token = getBearer(req);
  if (token) {
    const payload = await verifyApiToken(token);
    if (!payload) return null;
    return { userId: payload.sub, role: payload.role };
  }
  const session = await getServerSession(authOptions);
  const u = session?.user as any;
  if (!u?.id) return null;
  return { userId: u.id as string, role: u.role as string };
}

/**
 * Close a timesheet - marks it as submitted and ready for review
 * Can only be done by a SUPERVISOR who manages sites where this foreman worked
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await getAuth(req);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (auth.role !== "SUPERVISOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supervisor = await prisma.supervisor.findUnique({
    where: { userId: auth.userId },
    select: { id: true },
  });

  if (!supervisor) {
    return NextResponse.json(
      { error: "Supervisor not found" },
      { status: 404 },
    );
  }

  const { id } = await ctx.params;
  const parsed = parseSupervisorTimesheetId(id);
  if (!parsed) {
    return NextResponse.json(
      { error: "Invalid id. Expected YYYY-MM-DD_YYYY-MM-DD__FOREMANID" },
      { status: 400 },
    );
  }

  const { startISO, endISO, foremanId } = parsed;

  let startDate: Date;
  let endDate: Date;
  try {
    startDate = startOfDayUTC(startISO);
    endDate = startOfDayUTC(endISO);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Invalid dates" },
      { status: 400 },
    );
  }

  // Verify supervisor has access to sites where this foreman worked in this period
  const siteAssignments = await prisma.supervisorSiteAssignment.findMany({
    where: { supervisorId: supervisor.id },
    select: { siteId: true },
  });

  const siteIds = Array.from(new Set(siteAssignments.map((a) => a.siteId)));
  if (siteIds.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify this foreman worked at one of supervisor's sites during this period
  const siteDays = await prisma.siteDay.findFirst({
    where: {
      siteId: { in: siteIds },
      foremanId,
      workDate: { gte: startDate, lt: addDaysUTC(endDate, 1) },
    },
  });

  if (!siteDays) {
    return NextResponse.json(
      { error: "Foreman did not work at supervisor's sites in this period" },
      { status: 403 },
    );
  }

  // Get or create the period
  const period = await prisma.timesheetPeriod.findUnique({
    where: { startDate_endDate: { startDate, endDate } },
    select: { id: true },
  });

  if (!period) {
    return NextResponse.json({ error: "Period not found" }, { status: 404 });
  }

  // Get the timesheet
  const timesheet = await prisma.timesheet.findFirst({
    where: { periodId: period.id, foremanId },
    select: { id: true, status: true },
  });

  if (!timesheet) {
    return NextResponse.json({ error: "Timesheet not found" }, { status: 404 });
  }

  // Only allow closing if still in SUBMITTED status
  if (timesheet.status !== "SUBMITTED") {
    return NextResponse.json(
      { error: `Cannot close timesheet with status ${timesheet.status}` },
      { status: 400 },
    );
  }

  // Mark as submitted with current timestamp
  const updated = await prisma.timesheet.update({
    where: { id: timesheet.id },
    data: { submittedAt: new Date() },
    select: { id: true, status: true, submittedAt: true },
  });

  // Auto-create next period starting the day after this one ends
  // This allows continuous timesheet periods instead of being locked to fortnights
  const nextStartDate = addDaysUTC(endDate, 1);
  const nextEndDate = addDaysUTC(nextStartDate, 13); // 14 days

  await prisma.timesheetPeriod.upsert({
    where: {
      startDate_endDate: { startDate: nextStartDate, endDate: nextEndDate },
    },
    create: { startDate: nextStartDate, endDate: nextEndDate },
    update: {},
  });

  return NextResponse.json({
    ok: true,
    timesheet: {
      id: updated.id,
      status: updated.status,
      submittedAt: updated.submittedAt,
    },
  });
}
