import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { parseSupervisorTimesheetId } from "@/lib/timesheetId";
import { addDaysUTC, startOfDayUTC } from "@/lib/dateUtc";

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

async function assertForemanAccess(userId: string, foremanId: string) {
  const foreman = await prisma.foreman.findUnique({
    where: { userId },
    select: { id: true },
  });
  // Foreman can only submit their own timesheet
  if (!foreman) {
    console.error(`[submit] Foreman not found for userId: ${userId}`);
    return { ok: false as const, status: 403, msg: "Forbidden" };
  }
  if (foreman.id !== foremanId) {
    console.error(
      `[submit] Foreman ID mismatch: ${foreman.id} !== ${foremanId}`,
    );
    return { ok: false as const, status: 403, msg: "Forbidden" };
  }

  return { ok: true as const };
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await getAuth(req);
  console.log("[submit] Auth:", auth);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.role !== "FOREMAN") {
    console.error(`[submit] Wrong role: ${auth.role}`);
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Look up the foreman's actual database ID
  const foreman = await prisma.foreman.findUnique({
    where: { userId: auth.userId },
    select: { id: true },
  });
  if (!foreman) {
    console.error(`[submit] No foreman found for userId: ${auth.userId}`);
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const parsed = parseSupervisorTimesheetId(id);
  if (!parsed) {
    return NextResponse.json(
      { error: "Invalid id. Expected YYYY-MM-DD_YYYY-MM-DD__FOREMANID" },
      { status: 400 },
    );
  }

  // Use the actual foreman ID from database, not the one in the URL
  // The URL might have userId instead of foremanId
  const actualForemanId = foreman.id;
  console.log(
    `[submit] Using foremanId: ${actualForemanId} (URL had: ${parsed.foremanId})`,
  );

  const startDate = startOfDayUTC(parsed.startISO);
  const endDate = startOfDayUTC(parsed.endISO);
  const endExclusive = addDaysUTC(endDate, 1);

  const access = await assertForemanAccess(auth.userId, actualForemanId);
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
      periodId_foremanId: { periodId: period.id, foremanId: actualForemanId },
    },
    create: { periodId: period.id, foremanId: actualForemanId },
    update: {},
    select: { id: true, status: true },
  });

  // Only allow submitting while timesheet is in initial SUBMITTED state
  // (once it is APPROVED/REJECTED/PAID, block resubmission)
  if (ts.status !== "SUBMITTED") {
    return NextResponse.json(
      {
        error: `Timesheet already submitted (status: ${ts.status}). Cannot submit again.`,
      },
      { status: 400 },
    );
  }

  const updated = await prisma.timesheet.update({
    where: { id: ts.id },
    data: { submittedAt: new Date() },
    select: { status: true, submittedAt: true },
  });

  return NextResponse.json({ ok: true, ...updated });
}
