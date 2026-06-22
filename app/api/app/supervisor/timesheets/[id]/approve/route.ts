import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { parseTimesheetId } from "@/lib/timesheetId";
import { addDaysUTC, startOfDayUTC } from "@/lib/dateUtc";
import { writeAuditEvent } from "@/lib/audit";
import { sendExpoPush } from "@/lib/expoPush";

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

async function assertSupervisorAccess(
  userId: string,
  foremanId: string,
  siteId: string,
  startDate: Date,
  endExclusive: Date,
) {
  const supervisor = await prisma.supervisor.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!supervisor)
    return { ok: false as const, status: 404, msg: "Supervisor not found" };

  const now = new Date();
  const siteAssignments = await prisma.supervisorSiteAssignment.findMany({
    where: {
      supervisorId: supervisor.id,
      OR: [{ endsOn: null }, { endsOn: { gt: now } }],
    },
    select: { siteId: true },
  });
  const siteIds = Array.from(new Set(siteAssignments.map((a) => a.siteId)));
  if (!siteIds.length)
    return { ok: false as const, status: 403, msg: "Forbidden" };
  if (!siteIds.includes(siteId))
    return { ok: false as const, status: 403, msg: "Forbidden" };

  const hasSiteDay = await prisma.siteDay.findFirst({
    where: {
      foremanId,
      siteId,
      workDate: { gte: startDate, lt: endExclusive },
    },
    select: { id: true },
  });

  if (!hasSiteDay) return { ok: false as const, status: 403, msg: "Forbidden" };
  return { ok: true as const, supervisorId: supervisor.id };
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
      { error: "Forbidden - only supervisors can approve timesheets" },
      { status: 403, headers: CORS },
    );

  const { id } = await ctx.params;
  const parsed = parseTimesheetId(id);
  if (!parsed) {
    return NextResponse.json(
      { error: "Invalid id. Expected YYYY-MM-DD_YYYY-MM-DD_FOREMANID_SITEID" },
      { status: 400, headers: CORS },
    );
  }

  const siteId = parsed.siteId ?? new URL(req.url).searchParams.get("siteId");

  // Require siteId for per-site approval
  if (!siteId) {
    return NextResponse.json(
      {
        error:
          "siteId is required for approval. Use format: YYYY-MM-DD_YYYY-MM-DD_FOREMANID_SITEID",
      },
      { status: 400, headers: CORS },
    );
  }

  const startDate = startOfDayUTC(parsed.startISO);
  const endDate = startOfDayUTC(parsed.endISO);
  const endExclusive = addDaysUTC(endDate, 1);

  // Check if today is on or after the last day of the fortnight
  const today = startOfDayUTC(new Date().toISOString().slice(0, 10));
  if (today < endDate) {
    return NextResponse.json(
      {
        error: `Final approval is only available on the last day of the fortnight (${parsed.endISO}) or later. Use daily Accept during the period.`,
      },
      { status: 400, headers: CORS },
    );
  }

  // Admins can approve any timesheet; supervisors need site access check
  let supervisorId: string | null = null;
  if (auth.role === "SUPERVISOR") {
    const access = await assertSupervisorAccess(
      auth.userId,
      parsed.foremanId,
      siteId,
      startDate,
      endExclusive,
    );
    if (!access.ok)
      return NextResponse.json(
        { error: access.msg },
        { status: access.status, headers: CORS },
      );
    supervisorId = access.supervisorId;
  }

  const period = await prisma.timesheetPeriod.upsert({
    where: { startDate_endDate: { startDate, endDate } },
    create: { startDate, endDate },
    update: {},
    select: { id: true },
  });

  const ts = await prisma.timesheet.upsert({
    where: {
      periodId_foremanId_siteId: {
        periodId: period.id,
        foremanId: parsed.foremanId,
        siteId,
      },
    },
    create: {
      period: { connect: { id: period.id } },
      foreman: { connect: { id: parsed.foremanId } },
      site: { connect: { id: siteId } },
    },
    update: {},
    select: { id: true, status: true },
  });

  if (ts.status !== "SUBMITTED" && ts.status !== "ACCEPTED") {
    return NextResponse.json(
      {
        error: `Only SUBMITTED or ACCEPTED timesheets can be approved (current: ${ts.status}).`,
      },
      { status: 400, headers: CORS },
    );
  }

  const updated = await prisma.timesheet.update({
    where: { id: ts.id },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      approvedBySupervisor: supervisorId
        ? { connect: { id: supervisorId } }
        : undefined,
      rejectedAt: null,
      rejectionReason: null,
    },
    select: { status: true, approvedAt: true },
  });

  const [foremanNameRow, site] = await Promise.all([
    prisma.foreman.findUnique({
      where: { id: parsed.foremanId },
      select: { user: { select: { name: true } } },
    }),
    prisma.site.findUnique({
      where: { id: siteId },
      select: { id: true, name: true },
    }),
  ]);
  const foremanName = foremanNameRow?.user?.name?.trim() || "Foreman";

  await writeAuditEvent({
    actorUserId: auth.userId,
    action: "TIMESHEET_APPROVED",
    entity: "Timesheet",
    entityId: ts.id,
    metadata: {
      foremanId: parsed.foremanId,
      period: { startISO: parsed.startISO, endISO: parsed.endISO },
      siteId: site?.id ?? null,
      siteName: site?.name ?? null,
      title: "Timesheet approved",
      description: site?.name ? `${site.name} - ${foremanName}` : foremanName,
    },
  });

  try {
    const foremanRow = await prisma.foreman.findUnique({
      where: { id: parsed.foremanId },
      select: { userId: true },
    });
    const foremanUserId = foremanRow?.userId ?? null;

    if (foremanUserId) {
      const title = "Timesheet approved";
      const message = site?.name
        ? `${foremanName}, your timesheet for ${site.name} was approved.`
        : `${foremanName}, your timesheet was approved.`;

      await prisma.notification.create({
        data: {
          userId: foremanUserId,
          type: "TIMESHEET_APPROVED",
          title,
          message,
          siteId: site?.id ?? null,
          linkUrl: null,
        },
      });

      const pushTokens = await prisma.pushToken.findMany({
        where: { userId: foremanUserId },
        select: { token: true },
      });

      if (pushTokens.length > 0) {
        await sendExpoPush(
          pushTokens.map((token) => token.token),
          {
            title,
            body: message,
            data: {
              type: "TIMESHEET_APPROVED",
              siteId: site?.id ?? null,
              timesheetId: ts.id,
              foremanId: parsed.foremanId,
              periodStartISO: parsed.startISO,
              periodEndISO: parsed.endISO,
            },
          },
        );
      }
    }
  } catch (error) {
    console.error("Failed to send timesheet approval notification:", error);
  }

  return NextResponse.json({ ok: true, ...updated }, { headers: CORS });
}
