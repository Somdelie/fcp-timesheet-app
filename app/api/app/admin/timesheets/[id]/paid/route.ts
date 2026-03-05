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
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

async function getAuth(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  const token = m?.[1] ?? null;

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

  if (auth.role !== "ADMIN")
    return NextResponse.json(
      { error: "Forbidden - only admins can use this endpoint" },
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

  if (!parsed.siteId) {
    return NextResponse.json(
      {
        error:
          "siteId is required. Use format: YYYY-MM-DD_YYYY-MM-DD_FOREMANID_SITEID",
      },
      { status: 400, headers: CORS },
    );
  }

  const startDate = startOfDayUTC(parsed.startISO);
  const endDate = startOfDayUTC(parsed.endISO);
  const endExclusive = addDaysUTC(endDate, 1);

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
        siteId: parsed.siteId,
      },
    },
    create: {
      period: { connect: { id: period.id } },
      foreman: { connect: { id: parsed.foremanId } },
      site: parsed.siteId ? { connect: { id: parsed.siteId } } : undefined,
    },
    update: {},
    select: { id: true, status: true },
  });

  if (ts.status !== "APPROVED") {
    return NextResponse.json(
      {
        error: `Only APPROVED timesheets can be marked PAID (current: ${ts.status}).`,
      },
      { status: 400, headers: CORS },
    );
  }

  const updated = await prisma.timesheet.update({
    where: { id: ts.id },
    data: { status: "PAID", paidAt: new Date() },
    select: { status: true, paidAt: true },
  });

  const [foremanNameRow, site] = await Promise.all([
    prisma.foreman.findUnique({
      where: { id: parsed.foremanId },
      select: { user: { select: { name: true } } },
    }),
    prisma.site.findUnique({
      where: { id: parsed.siteId! },
      select: { id: true, name: true },
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
      siteId: site?.id ?? null,
      siteName: site?.name ?? null,
      title: "Timesheet marked as paid (admin)",
      description: site?.name ? `${site.name} - ${foremanName}` : foremanName,
    },
  });

  return NextResponse.json({ ok: true, ...updated }, { headers: CORS });
}
