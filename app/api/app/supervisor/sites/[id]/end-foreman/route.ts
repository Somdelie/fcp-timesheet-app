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

export async function POST(
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
  const body = await req.json().catch(() => null);
  const foremanId = String(body?.foremanId ?? "");
  if (!foremanId)
    return NextResponse.json(
      { error: "foremanId is required" },
      { status: 400 },
    );

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

  // End the most recent active assignment row
  const active = await prisma.foremanSiteAssignment.findFirst({
    where: {
      siteId,
      foremanId,
      startsOn: { lte: now },
      OR: [{ endsOn: null }, { endsOn: { gt: now } }],
    },
    orderBy: { startsOn: "desc" },
    select: { id: true },
  });

  if (!active)
    return NextResponse.json(
      { error: "Active assignment not found" },
      { status: 404 },
    );

  await prisma.foremanSiteAssignment.update({
    where: { id: active.id },
    data: { endsOn: now },
  });

  return NextResponse.json({ ok: true });
}
