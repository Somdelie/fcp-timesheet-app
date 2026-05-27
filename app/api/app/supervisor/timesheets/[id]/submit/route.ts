import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { parseSupervisorTimesheetId } from "@/lib/timesheetId";
import { startOfDayUTC } from "@/lib/dateUtc";
import { writeAuditEvent } from "@/lib/audit";
import { sendExpoPush } from "@/lib/expoPush";

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
    // Use findFirst + create pattern since siteId can be null
    let ts = await prisma.timesheet.findFirst({
      where: {
        periodId: period.id,
        foremanId: foreman.id,
        siteId: parsed.siteId ?? null,
      },
      select: { id: true, status: true },
    });

    if (!ts) {
      ts = await prisma.timesheet.create({
        data: {
          period: { connect: { id: period.id } },
          foreman: { connect: { id: foreman.id } },
          site: parsed.siteId ? { connect: { id: parsed.siteId } } : undefined,
        },
        select: { id: true, status: true },
      });
    }

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

    // Persist in-app notification + send Expo push to supervisors assigned to the timesheet site
    const siteId = siteDay?.site?.id ?? null;
    const siteName = siteDay?.site?.name ?? null;

    if (siteId && siteName) {
      const title = "Timesheet submitted — Pending review";
      const message = `${foremanName} submitted a timesheet for ${siteName}.`;

      const now = new Date();

      const assignedSupervisorSiteRows =
        await prisma.supervisorSiteAssignment.findMany({
          where: {
            siteId,
            startsOn: { lte: now },
            OR: [{ endsOn: null }, { endsOn: { gt: now } }],
          },
          select: { supervisorId: true },
        });

      const supervisorIds = Array.from(
        new Set(assignedSupervisorSiteRows.map((r) => r.supervisorId)),
      );

      if (supervisorIds.length > 0) {
        const supervisors = await prisma.supervisor.findMany({
          where: { id: { in: supervisorIds } },
          select: { userId: true },
        });

        const supervisorUserIds = supervisors.map((s) => s.userId);

        if (supervisorUserIds.length > 0) {
          await prisma.notification.createMany({
            data: supervisorUserIds.map((userId) => ({
              userId,
              type: "TIMESHEET_SUBMITTED",
              title,
              message,
              siteId,
              linkUrl: null,
            })),
          });

          const pushTokens = await prisma.pushToken.findMany({
            where: { userId: { in: supervisorUserIds } },
            select: { token: true },
          });

          if (pushTokens.length > 0) {
            await sendExpoPush(
              pushTokens.map((t) => t.token),
              {
                title,
                body: message,
                data: {
                  type: "TIMESHEET_SUBMITTED",
                  siteId,
                  timesheetId: ts.id,
                  foremanId: foreman.id,
                  periodStartISO: parsed.startISO,
                  periodEndISO: parsed.endISO,
                },
              },
            );
          }
        }
      }
    }

    return NextResponse.json({ ok: true, ...updated });
  } catch (e: any) {
    console.error("Error submitting timesheet:", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 },
    );
  }
}
