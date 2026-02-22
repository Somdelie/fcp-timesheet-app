import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { parseTimesheetId } from "@/lib/timesheetId";
import { addDaysUTC, startOfDayUTC } from "@/lib/dateUtc";
import { writeAuditEvent } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

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

async function getSupervisorId(userId: string) {
  const supervisor = await prisma.supervisor.findUnique({
    where: { userId },
    select: { id: true },
  });
  return supervisor?.id ?? null;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await getAuth(req);
  if (!auth)
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: CORS },
    );
  if (auth.role !== "SUPERVISOR")
    return NextResponse.json(
      { error: "Forbidden - only supervisors can accept timesheets" },
      { status: 403, headers: CORS },
    );

  const { id } = await ctx.params;
  const parsed = parseTimesheetId(id);
  if (!parsed) {
    return NextResponse.json(
      {
        error:
          "Invalid id. Expected YYYY-MM-DD_YYYY-MM-DD_FOREMANID_SITEID or YYYY-MM-DD_YYYY-MM-DD__FOREMANID with ?siteId=...",
      },
      { status: 400, headers: CORS },
    );
  }

  // Accept siteId from URL path or query param
  const url = new URL(req.url);
  const siteId = parsed.siteId ?? url.searchParams.get("siteId");

  if (!siteId) {
    return NextResponse.json(
      {
        error:
          "siteId is required. Use format: YYYY-MM-DD_YYYY-MM-DD_FOREMANID_SITEID or add ?siteId=...",
      },
      { status: 400, headers: CORS },
    );
  }

  // Parse request body for the date to accept
  let body: { date: string; action: "accept" | "reject"; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400, headers: CORS },
    );
  }

  if (!body.date || !body.action) {
    return NextResponse.json(
      { error: "date and action are required" },
      { status: 400, headers: CORS },
    );
  }

  if (body.action !== "accept" && body.action !== "reject") {
    return NextResponse.json(
      { error: "action must be 'accept' or 'reject'" },
      { status: 400, headers: CORS },
    );
  }

  const workDate = startOfDayUTC(body.date);
  const startDate = startOfDayUTC(parsed.startISO);
  const endDate = startOfDayUTC(parsed.endISO);

  // Validate date is within the fortnight period
  if (workDate < startDate || workDate > endDate) {
    return NextResponse.json(
      { error: "Date must be within the timesheet period" },
      { status: 400, headers: CORS },
    );
  }

  // Get or create the timesheet period
  const period = await prisma.timesheetPeriod.upsert({
    where: { startDate_endDate: { startDate, endDate } },
    create: { startDate, endDate },
    update: {},
    select: { id: true },
  });

  // Get or create the timesheet
  const ts = await prisma.timesheet.upsert({
    where: {
      periodId_foremanId_siteId: {
        periodId: period.id,
        foremanId: parsed.foremanId,
        siteId: siteId,
      },
    },
    create: {
      periodId: period.id,
      foremanId: parsed.foremanId,
      siteId: siteId,
    },
    update: {},
    select: { id: true, status: true },
  });

  // Can only accept/reject days for SUBMITTED or ACCEPTED timesheets
  if (ts.status !== "SUBMITTED" && ts.status !== "ACCEPTED") {
    return NextResponse.json(
      {
        error: `Cannot modify day acceptance for ${ts.status} timesheets.`,
      },
      { status: 400, headers: CORS },
    );
  }

  // Get supervisor ID for tracking who accepted
  let supervisorId: string | null = null;
  if (auth.role === "SUPERVISOR") {
    supervisorId = await getSupervisorId(auth.userId);
  }

  // Create or update the day acceptance
  const dayAcceptance = await prisma.timesheetDayAcceptance.upsert({
    where: {
      timesheetId_workDate: {
        timesheetId: ts.id,
        workDate,
      },
    },
    create: {
      timesheetId: ts.id,
      workDate,
      status: body.action === "accept" ? "ACCEPTED" : "REJECTED",
      acceptedAt: body.action === "accept" ? new Date() : null,
      rejectedAt: body.action === "reject" ? new Date() : null,
      rejectionReason: body.action === "reject" ? body.reason : null,
      acceptedBySupervisorId: supervisorId,
    },
    update: {
      status: body.action === "accept" ? "ACCEPTED" : "REJECTED",
      acceptedAt: body.action === "accept" ? new Date() : null,
      rejectedAt: body.action === "reject" ? new Date() : null,
      rejectionReason: body.action === "reject" ? body.reason : null,
      acceptedBySupervisorId: supervisorId,
    },
    select: { id: true, status: true, workDate: true },
  });

  // Update the timesheet status to ACCEPTED if any day has been accepted
  if (body.action === "accept" && ts.status === "SUBMITTED") {
    await prisma.timesheet.update({
      where: { id: ts.id },
      data: { status: "ACCEPTED" },
    });
  }

  // Get site info for audit
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { id: true, name: true },
  });

  const foreman = await prisma.foreman.findUnique({
    where: { id: parsed.foremanId },
    select: { user: { select: { name: true } } },
  });

  const foremanName = foreman?.user?.name?.trim() || "Foreman";
  const dateStr = body.date;

  await writeAuditEvent({
    actorUserId: auth.userId,
    action:
      body.action === "accept"
        ? "TIMESHEET_DAY_ACCEPTED"
        : "TIMESHEET_DAY_REJECTED",
    entity: "TimesheetDayAcceptance",
    entityId: dayAcceptance.id,
    metadata: {
      foremanId: parsed.foremanId,
      siteId: site?.id ?? null,
      siteName: site?.name ?? null,
      workDate: dateStr,
      title: body.action === "accept" ? "Day accepted" : "Day rejected",
      description: site?.name
        ? `${site.name} - ${foremanName} - ${dateStr}`
        : `${foremanName} - ${dateStr}`,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      dayAcceptance: {
        id: dayAcceptance.id,
        status: dayAcceptance.status,
        workDate: dayAcceptance.workDate,
      },
    },
    { headers: CORS },
  );
}
