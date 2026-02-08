import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { verifyApiToken } from "@/lib/jwt";
import { isoFromDateUTC, startOfDayUTC } from "@/lib/dateUtc";

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
    if (!payload) return { userId: null, role: null };
    return { userId: payload.sub as string, role: payload.role as string };
  }
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  return { userId: user?.id ?? null, role: user?.role ?? null };
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { userId, role } = await getAuth(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "SUPERVISOR")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sup = await prisma.supervisor.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!sup)
    return NextResponse.json(
      { error: "Supervisor not found" },
      { status: 404 },
    );

  const { id: siteId } = await ctx.params;
  const now = new Date();

  const access = await prisma.supervisorSiteAssignment.findFirst({
    where: {
      supervisorId: sup.id,
      siteId,
      startsOn: { lte: now },
      OR: [{ endsOn: null }, { endsOn: { gt: now } }],
    },
    select: { id: true },
  });
  if (!access)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const todayISO = isoFromDateUTC(new Date());
  const today = startOfDayUTC(todayISO);

  // Get all siteDays for this site on this date (multiple foremen can work the same day)
  const siteDays = await prisma.siteDay.findMany({
    where: { siteId, workDate: today },
    select: { id: true, isLocked: true, readyToSubmit: true, foremanId: true },
  });

  // Count scans today for this site
  const scannedCount = await prisma.attendanceScan.count({
    where: { siteId, workDate: today },
  });

  // Who is assigned to site today (via foremanSiteAssignment)
  const assignedForemen = await prisma.foremanSiteAssignment.findMany({
    where: {
      siteId,
      startsOn: { lte: now },
      OR: [{ endsOn: null }, { endsOn: { gt: now } }],
    },
    select: {
      foremanId: true,
      foreman: { select: { user: { select: { name: true, email: true } } } },
    },
  });

  return NextResponse.json({
    ok: true,
    data: {
      siteId,
      dateISO: todayISO,
      scannedCount,
      readyToSubmit: siteDays.some((s) => s.readyToSubmit) ? true : false,
      isLocked: siteDays.some((s) => s.isLocked) ? true : false,
      foremenOnSite: assignedForemen.map((a) => ({
        foremanId: a.foremanId,
        name: a.foreman.user?.name ?? a.foreman.user?.email ?? "Foreman",
      })),
    },
  });
}
