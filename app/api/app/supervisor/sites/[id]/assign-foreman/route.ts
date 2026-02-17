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

  // ✅ Check if the site has at least one active supervisor
  const activeSupervisorAssignments =
    await prisma.supervisorSiteAssignment.findMany({
      where: { siteId, endsOn: null },
      select: { supervisorId: true },
    });

  if (activeSupervisorAssignments.length === 0) {
    return NextResponse.json(
      {
        error: "Cannot assign foreman: site must have a supervisor first.",
      },
      { status: 400 },
    );
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

  // ✅ Create new assignment AND link foreman to all active supervisors at the site
  await prisma.$transaction(async (tx) => {
    // 1. Create the site assignment
    await tx.foremanSiteAssignment.create({
      data: {
        siteId,
        foremanId,
        startsOn: now,
        endsOn: null,
      },
    });

    // 2. Link foreman to each active supervisor at this site (if not already linked)
    for (const { supervisorId } of activeSupervisorAssignments) {
      const existingLink = await tx.supervisorForeman.findFirst({
        where: {
          supervisorId,
          foremanId,
          endsOn: null,
        },
      });

      if (!existingLink) {
        await tx.supervisorForeman.create({
          data: {
            supervisorId,
            foremanId,
            startsOn: now,
          },
        });
      }
    }
  });

  return NextResponse.json({ ok: true, assigned: "created" });
}
