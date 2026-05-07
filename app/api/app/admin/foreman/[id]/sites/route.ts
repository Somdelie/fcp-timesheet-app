import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/apiAuth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}

async function getAdminFromRequest(req: NextRequest) {
  const apiCtx = await requireApiAuth(req, ["ADMIN", "OFFICE"]);
  if (apiCtx) return { id: apiCtx.user.sub } as const;
  try {
    const session = await getServerSession(authOptions);
    if (session?.user && (session.user as any).id) {
      const role = (session.user as any).role as string | undefined;
      if (role === "ADMIN" || role === "OFFICE") return { id: (session.user as any).id as string };
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * GET /api/app/admin/foreman/:id/sites
 * Returns all site assignments for a foreman (active sites only).
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await getAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
    }

    const { id: foremanId } = await ctx.params;

    const assignments = await prisma.foremanSiteAssignment.findMany({
      where: {
        foremanId,
        site: { isActive: true },
        // Only current/open assignments (no end date, or end date in the future)
        OR: [{ endsOn: null }, { endsOn: { gt: new Date() } }],
      },
      include: {
        site: { select: { id: true, name: true, code: true, client: true } },
      },
      orderBy: { startsOn: "desc" },
    });

    const sites = assignments.map((a) => ({
      id: a.site.id,
      name: a.site.name,
      code: a.site.code ?? null,
      client: a.site.client ?? null,
    }));

    return NextResponse.json({ ok: true, sites }, { headers: CORS_HEADERS });
  } catch (e: any) {
    console.error("/api/app/admin/foreman/[id]/sites GET error", e);
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500, headers: CORS_HEADERS });
  }
}
