import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const token = getBearer(req);
  if (!token)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await verifyApiToken(token);
  if (!payload)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (payload.role !== "SUPERVISOR" && payload.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: siteId } = await ctx.params;

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const foremanIdRaw = String(body?.foremanId ?? "").trim();
  const foremanUserIdRaw = String(body?.foremanUserId ?? "").trim();

  if (!siteId) {
    return NextResponse.json({ error: "siteId is required" }, { status: 400 });
  }

  if (!foremanIdRaw && !foremanUserIdRaw) {
    return NextResponse.json(
      { error: "foremanId or foremanUserId is required" },
      { status: 400 },
    );
  }

  // ✅ normalize to Foreman.id
  let foremanId = foremanIdRaw;

  if (!foremanId) {
    const foreman = await prisma.foreman.findUnique({
      where: { userId: foremanUserIdRaw },
      select: { id: true },
    });

    if (!foreman) {
      return NextResponse.json({ error: "Foreman not found" }, { status: 404 });
    }

    foremanId = foreman.id;
  }

  // Ensure site exists
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { id: true },
  });
  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  // ✅ Close any active assignment first (if exists)
  const now = new Date();

  // Find active assignment(s) for this foreman on this site
  const active = await prisma.foremanSiteAssignment.findFirst({
    where: {
      siteId,
      foremanId,
      startsOn: { lte: now },
      OR: [{ endsOn: null }, { endsOn: { gt: now } }],
    },
    select: { id: true },
  });

  if (active) {
    // already assigned and active — idempotent success
    return NextResponse.json({ ok: true, assigned: "already" });
  }

  // Optional: prevent foreman being double-booked across sites at same time
  // (If you want this rule, keep it. If not, remove this block.)
  const activeElsewhere = await prisma.foremanSiteAssignment.findFirst({
    where: {
      foremanId,
      startsOn: { lte: now },
      OR: [{ endsOn: null }, { endsOn: { gt: now } }],
      NOT: { siteId },
    },
    select: { siteId: true },
  });

  if (activeElsewhere) {
    return NextResponse.json(
      {
        error:
          "Foreman is already assigned to another site. End that assignment first.",
      },
      { status: 409 },
    );
  }

  // ✅ Create new assignment
  await prisma.foremanSiteAssignment.create({
    data: {
      siteId,
      foremanId,
      startsOn: now,
      endsOn: null,
    },
  });

  return NextResponse.json({ ok: true, assigned: "created" });
}
