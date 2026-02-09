// app/api/app/sites/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { resolveActingForeman } from "@/lib/resolveActingForeman";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

export async function GET(req: Request) {
  const token = getBearer(req);
  if (!token)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await verifyApiToken(token);
  if (!payload)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (payload.role !== "FOREMAN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // x-acting-foreman-id is always Foreman.id (used by assistants)
  const actingForemanId =
    req.headers.get("x-acting-foreman-id")?.trim() || null;

  // Resolve whether user is a real foreman or an assistant acting on behalf of a foreman
  const resolved = await resolveActingForeman(payload.sub, actingForemanId);

  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status },
    );
  }

  const effectiveForemanId = resolved.foremanId!;

  const now = new Date();

  const assignments = await prisma.foremanSiteAssignment.findMany({
    where: {
      foremanId: effectiveForemanId,
      OR: [{ endsOn: null }, { endsOn: { gt: now } }],
      site: { isActive: true },
    },
    select: {
      site: {
        select: {
          id: true,
          name: true,
          code: true,
          isActive: true,
        },
      },
    },
    orderBy: { site: { name: "asc" } },
  });

  const sites = assignments.map((a) => ({
    id: a.site.id,
    name: a.site.name,
    jobNumber: a.site.code,
    active: a.site.isActive,
  }));

  return NextResponse.json({ sites });
}
