import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";

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

  const supervisor = await prisma.supervisor.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!supervisor)
    return NextResponse.json(
      { error: "Supervisor not found" },
      { status: 404 },
    );

  const { id: siteId } = await ctx.params;
  const now = new Date();

  // Access: supervisor must be assigned to this site
  const access = await prisma.supervisorSiteAssignment.findFirst({
    where: {
      supervisorId: supervisor.id,
      siteId,
      startsOn: { lte: now },
      OR: [{ endsOn: null }, { endsOn: { gt: now } }],
    },
    select: { id: true },
  });
  if (!access)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: {
      id: true,
      name: true,
      code: true,
      location: true,
      isActive: true,
    },
  });
  if (!site)
    return NextResponse.json({ error: "Site not found" }, { status: 404 });

  // Current foreman assignments for this site
  const assigned = await prisma.foremanSiteAssignment.findMany({
    where: {
      siteId,
      startsOn: { lte: now },
      OR: [{ endsOn: null }, { endsOn: { gt: now } }],
    },
    select: {
      foremanId: true,
      foreman: {
        select: { userId: true, user: { select: { name: true, email: true } } },
      },
      startsOn: true,
      endsOn: true,
    },
    orderBy: [{ startsOn: "desc" }],
  });

  // Available foremen = foremen linked to this supervisor (active SupervisorForeman link)
  const links = await prisma.supervisorForeman.findMany({
    where: {
      supervisorId: supervisor.id,
      startsOn: { lte: now },
      OR: [{ endsOn: null }, { endsOn: { gt: now } }],
    },
    select: {
      foreman: {
        select: { userId: true, user: { select: { name: true, email: true } } },
      },
    },
  });

  const availableForemen = Array.from(
    new Map(
      links.map((l) => {
        const u = l.foreman.user;
        return [
          l.foreman.userId,
          {
            userId: l.foreman.userId,
            name: u?.name ?? u?.email ?? "Foreman",
            email: u?.email ?? null,
          },
        ] as const;
      }),
    ).values(),
  );

  return NextResponse.json({
    site,
    assignedForemen: assigned.map((a) => ({
      foremanId: a.foremanId,
      userId: a.foreman.userId,
      name: a.foreman.user?.name ?? a.foreman.user?.email ?? "Foreman",
      email: a.foreman.user?.email ?? null,
      startsOn: a.startsOn.toISOString(),
      endsOn: a.endsOn ? a.endsOn.toISOString() : null,
    })),
    availableForemen,
  });
}
