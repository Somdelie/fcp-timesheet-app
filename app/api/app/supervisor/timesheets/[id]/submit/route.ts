import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { parseSupervisorTimesheetId } from "@/lib/timesheetId";
import { startOfDayUTC } from "@/lib/dateUtc";
import { writeAuditEvent } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() ?? null;
}

async function getAuth(req: Request) {
  const token = getBearer(req);
  if (token) {
    const payload = await verifyApiToken(token);
    if (!payload) return null;
    return { userId: payload.sub as string, role: payload.role as string };
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
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (auth.role !== "FOREMAN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const foreman = await prisma.foreman.findUnique({
      where: { userId: auth.userId },
      select: { id: true },
    });

    if (!foreman) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;

    // Expected: YYYY-MM-DD_YYYY-MM-DD__FOREMANID
    const parsed = parseSupervisorTimesheetId(id);
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid id. Expected YYYY-MM-DD_YYYY-MM-DD__FOREMANID" },
        { status: 400 },
      );
    }

    // ✅ Foreman can only submit their own timesheet
    if (parsed.foremanId !== foreman.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const startDate = startOfDayUTC(parsed.startISO);
    const endDate = startOfDayUTC(parsed.endISO);

    // Ensure period exists
    const period = await prisma.timesheetPeriod.upsert({
      where: { startDate_endDate: { startDate, endDate } },
      create: { startDate, endDate },
      update: {},
      select: { id: true },
    });

    // Ensure timesheet exists
    const ts = await prisma.timesheet.upsert({
      where: {
        periodId_foremanId: { periodId: period.id, foremanId: foreman.id },
      },
      create: { periodId: period.id, foremanId: foreman.id },
      update: {},
      select: { id: true, status: true },
    });

    // Block re-submission if already in terminal state (APPROVED or PAID)
    if (ts.status === "APPROVED" || ts.status === "PAID") {
      return NextResponse.json(
        {
          error: `Cannot submit timesheet that is already ${ts.status}.`,
        },
        { status: 400 },
      );
    }

    const updated = await prisma.timesheet.update({
      where: { id: ts.id },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),

        // optional: clear old rejection fields if you use them
        rejectedAt: null,
        rejectionReason: null,
      },
      select: { status: true, submittedAt: true },
    });

    const foremanNameRow = await prisma.foreman.findUnique({
      where: { id: foreman.id },
      select: { user: { select: { name: true } } },
    });
    const foremanName = foremanNameRow?.user?.name?.trim() || "Foreman";

    const siteDay = await prisma.siteDay.findFirst({
      where: {
        foremanId: foreman.id,
        workDate: {
          gte: startDate,
          lt: new Date(endDate.getTime() + 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { workDate: "desc" },
      select: { site: { select: { id: true, name: true } } },
    });

    await writeAuditEvent({
      actorUserId: auth.userId,
      action: "TIMESHEET_SUBMITTED",
      entity: "Timesheet",
      entityId: ts.id,
      metadata: {
        foremanId: foreman.id,
        period: { startISO: parsed.startISO, endISO: parsed.endISO },
        siteId: siteDay?.site?.id ?? null,
        siteName: siteDay?.site?.name ?? null,
        title: "Timesheet submitted",
        description: siteDay?.site?.name
          ? `${siteDay.site.name} - ${foremanName}`
          : foremanName,
      },
    });

    return NextResponse.json({ ok: true, ...updated });
  } catch (e: any) {
    console.error("Error submitting timesheet:", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 },
    );
  }
}
