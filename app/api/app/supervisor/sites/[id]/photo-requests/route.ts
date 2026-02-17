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

  const siteDays = await prisma.siteDay.findMany({
    where: { siteId, workDate: today },
    select: { id: true },
  });

  if (siteDays.length === 0)
    return NextResponse.json({ ok: true, requests: [] });

  const siteDayIds = siteDays.map((s) => s.id);

  const requests = await prisma.siteDayPhotoRequest.findMany({
    where: { siteDayId: { in: siteDayIds } },
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

  // Check if there's already a photo request for this site today
  const existingRequests = await prisma.siteDayPhotoRequest.findMany({
    where: {
      siteDay: {
        siteId,
        workDate: today,
      },
      status: "REQUESTED",
    },
    select: { id: true },
  });

  if (existingRequests.length > 0) {
    return NextResponse.json(
      { error: "A photo request has already been sent for this site today." },
      { status: 400 },
    );
  }

  // Get or create siteDays for all assigned foremen
  const assignedForemen = await prisma.foremanSiteAssignment.findMany({
    where: {
      siteId,
      startsOn: { lte: new Date() },
      OR: [{ endsOn: null }, { endsOn: { gte: new Date() } }],
    },
    select: { foremanId: true },
  });

  if (assignedForemen.length === 0) {
    return NextResponse.json(
      { error: "No foreman assigned to this site." },
      { status: 400 },
    );
  }

  // Create siteDays if they don't exist for the assigned foremen
  const siteDays = await Promise.all(
    assignedForemen.map((f) =>
      prisma.siteDay
        .findFirst({
          where: { foremanId: f.foremanId, workDate: today },
          select: { id: true },
        })
        .then((existing) =>
          existing
            ? existing
            : prisma.siteDay.create({
                data: {
                  siteId,
                  foremanId: f.foremanId,
                  workDate: today,
                },
                select: { id: true },
              }),
        ),
    ),
  );

  const dueAt = dueAtISO ? new Date(`${dueAtISO}T17:00:00.000Z`) : null;

  // Create photo requests for all siteDays
  const created = await Promise.all(
    siteDays.map((sd) =>
      prisma.siteDayPhotoRequest.create({
        data: {
          siteDayId: sd.id,
          requestedByUserId: userId,
          note: note || null,
          dueAt,
        },
        select: { id: true },
      }),
    ),
  );

  return NextResponse.json({ ok: true, requestIds: created.map((c) => c.id) });
}
