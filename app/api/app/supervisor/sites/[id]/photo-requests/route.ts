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

async function ensureAccess(supervisorId: string, siteId: string) {
  const now = new Date();
  const access = await prisma.supervisorSiteAssignment.findFirst({
    where: {
      supervisorId,
      siteId,
      startsOn: { lte: now },
      OR: [{ endsOn: null }, { endsOn: { gt: now } }],
    },
    select: { id: true },
  });
  return Boolean(access);
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
  if (!(await ensureAccess(sup.id, siteId)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const todayISO = isoFromDateUTC(new Date());
  const today = startOfDayUTC(todayISO);

  const siteDay = await prisma.siteDay.findUnique({
    where: { siteId_workDate: { siteId, workDate: today } },
    select: { id: true },
  });

  if (!siteDay) return NextResponse.json({ ok: true, requests: [] });

  const requests = await prisma.siteDayPhotoRequest.findMany({
    where: { siteDayId: siteDay.id },
    select: {
      id: true,
      siteDayId: true,
      status: true,
      requestedAt: true,
      dueAt: true,
      note: true,
      requestedByUser: { select: { id: true, name: true, email: true } },
      siteDayPhotos: { select: { id: true } },
    },
    orderBy: { requestedAt: "desc" },
  });

  return NextResponse.json({
    ok: true,
    requests: requests.map((r) => ({
      id: r.id,
      siteDayId: r.siteDayId,
      status: r.status,
      requestedAt: r.requestedAt.toISOString(),
      dueAt: r.dueAt ? r.dueAt.toISOString() : null,
      note: r.note ?? null,
      requestedBy: r.requestedByUser
        ? {
            id: r.requestedByUser.id,
            name: r.requestedByUser.name ?? r.requestedByUser.email ?? "User",
          }
        : null,
      photoCount: r.siteDayPhotos.length,
    })),
  });
}

export async function POST(
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
  if (!(await ensureAccess(sup.id, siteId)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const note = String(body?.note ?? "").trim();
  const dueAtISO = body?.dueAtISO ? String(body.dueAtISO) : null;

  const todayISO = isoFromDateUTC(new Date());
  const today = startOfDayUTC(todayISO);

  // Ensure a SiteDay exists; if not, create one using the first assigned foreman (or reject)
  const assigned = await prisma.foremanSiteAssignment.findFirst({
    where: { siteId, endsOn: null },
    select: { foremanId: true },
    orderBy: { startsOn: "desc" },
  });

  if (!assigned) {
    return NextResponse.json(
      { error: "No foreman assigned to this site." },
      { status: 400 },
    );
  }

  const siteDay = await prisma.siteDay.upsert({
    where: { siteId_workDate: { siteId, workDate: today } },
    create: { siteId, foremanId: assigned.foremanId, workDate: today },
    update: {},
    select: { id: true },
  });

  const dueAt = dueAtISO ? new Date(`${dueAtISO}T17:00:00.000Z`) : null;

  const created = await prisma.siteDayPhotoRequest.create({
    data: {
      siteDayId: siteDay.id,
      requestedByUserId: userId,
      note: note || null,
      dueAt,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, requestId: created.id });
}
