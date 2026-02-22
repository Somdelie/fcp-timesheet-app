import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { parseTimesheetId } from "@/lib/timesheetId";
import { startOfDayUTC } from "@/lib/dateUtc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

export async function GET(
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
      { error: "Forbidden" },
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

  const startDate = startOfDayUTC(parsed.startISO);
  const endDate = startOfDayUTC(parsed.endISO);

  // Find the timesheet
  const period = await prisma.timesheetPeriod.findUnique({
    where: { startDate_endDate: { startDate, endDate } },
    select: { id: true },
  });

  if (!period) {
    return NextResponse.json(
      { dayAcceptances: [], timesheetStatus: "SUBMITTED" },
      { headers: CORS },
    );
  }

  const timesheet = await prisma.timesheet.findUnique({
    where: {
      periodId_foremanId_siteId: {
        periodId: period.id,
        foremanId: parsed.foremanId,
        siteId: siteId,
      },
    },
    select: {
      id: true,
      status: true,
      dayAcceptances: {
        select: {
          id: true,
          workDate: true,
          status: true,
          acceptedAt: true,
          rejectedAt: true,
          rejectionReason: true,
          acceptedBySupervisor: {
            select: { user: { select: { name: true } } },
          },
        },
        orderBy: { workDate: "asc" },
      },
    },
  });

  if (!timesheet) {
    return NextResponse.json(
      { dayAcceptances: [], timesheetStatus: "SUBMITTED" },
      { headers: CORS },
    );
  }

  // Format the response
  const dayAcceptances = timesheet.dayAcceptances.map((da) => ({
    id: da.id,
    workDate: da.workDate.toISOString().slice(0, 10),
    status: da.status,
    acceptedAt: da.acceptedAt?.toISOString() ?? null,
    rejectedAt: da.rejectedAt?.toISOString() ?? null,
    rejectionReason: da.rejectionReason,
    acceptedBy: da.acceptedBySupervisor?.user?.name ?? null,
  }));

  return NextResponse.json(
    {
      dayAcceptances,
      timesheetStatus: timesheet.status,
    },
    { headers: CORS },
  );
}
