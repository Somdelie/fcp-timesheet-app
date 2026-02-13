import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { parseSupervisorTimesheetId } from "@/lib/timesheetId";
import { addDaysUTC, startOfDayUTC } from "@/lib/dateUtc";
import { writeAuditEvent } from "@/lib/audit";

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

async function assertSupervisorAccess(
  userId: string,
  foremanId: string,
  startDate: Date,
  endExclusive: Date,
) {
  const supervisor = await prisma.supervisor.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!supervisor)
    return { ok: false as const, status: 404, msg: "Supervisor not found" };

  const siteAssignments = await prisma.supervisorSiteAssignment.findMany({
    where: { supervisorId: supervisor.id },
    select: { siteId: true },
  });
  const siteIds = Array.from(new Set(siteAssignments.map((a) => a.siteId)));
  if (!siteIds.length)
    return { ok: false as const, status: 403, msg: "Forbidden" };

  const hasSiteDay = await prisma.siteDay.findFirst({
    where: {
      foremanId,
      siteId: { in: siteIds },
      workDate: { gte: startDate, lt: endExclusive },
    },
    select: { id: true },
  });

  if (!hasSiteDay) return { ok: false as const, status: 403, msg: "Forbidden" };
  return { ok: true as const };
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await getAuth(req);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.role !== "SUPERVISOR")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const parsed = parseSupervisorTimesheetId(id);
  if (!parsed) {
    return NextResponse.json(
      { error: "Invalid id. Expected YYYY-MM-DD_YYYY-MM-DD__FOREMANID" },
      { status: 400 },
    );
  }

  const startDate = startOfDayUTC(parsed.startISO);
  const endDate = startOfDayUTC(parsed.endISO);
  const endExclusive = addDaysUTC(endDate, 1);

  const access = await assertSupervisorAccess(
    auth.userId,
    parsed.foremanId,
    startDate,
    endExclusive,
  );
  if (!access.ok)
    return NextResponse.json({ error: access.msg }, { status: access.status });

  const period = await prisma.timesheetPeriod.upsert({
    where: { startDate_endDate: { startDate, endDate } },
    create: { startDate, endDate },
    update: {},
    select: { id: true },
  });

  const ts = await prisma.timesheet.upsert({
    where: {
      periodId_foremanId: { periodId: period.id, foremanId: parsed.foremanId },
    },
    create: { periodId: period.id, foremanId: parsed.foremanId },
    update: {},
    select: { id: true, status: true },
  });

  if (ts.status !== "APPROVED") {
    return NextResponse.json(
      {
        error: `Only APPROVED timesheets can be marked PAID (current: ${ts.status}).`,
      },
      { status: 400 },
    );
  }

  const updated = await prisma.timesheet.update({
    where: { id: ts.id },
    data: { status: "PAID", paidAt: new Date() },
    select: { status: true, paidAt: true },
  });

  const [foremanNameRow, siteDay] = await Promise.all([
    prisma.foreman.findUnique({
      where: { id: parsed.foremanId },
      select: { user: { select: { name: true } } },
    }),
    prisma.siteDay.findFirst({
      where: {
        foremanId: parsed.foremanId,
        workDate: { gte: startDate, lt: endExclusive },
      },
      orderBy: { workDate: "desc" },
      select: { site: { select: { id: true, name: true } } },
    }),
  ]);
  const foremanName = foremanNameRow?.user?.name?.trim() || "Foreman";

  await writeAuditEvent({
    actorUserId: auth.userId,
    action: "TIMESHEET_PAID",
    entity: "Timesheet",
    entityId: ts.id,
    metadata: {
      foremanId: parsed.foremanId,
      period: { startISO: parsed.startISO, endISO: parsed.endISO },
      siteId: siteDay?.site?.id ?? null,
      siteName: siteDay?.site?.name ?? null,
      title: "Timesheet marked as paid",
      description: siteDay?.site?.name
        ? `${siteDay.site.name} - ${foremanName}`
        : foremanName,
    },
  });

  return NextResponse.json({ ok: true, ...updated });
}
