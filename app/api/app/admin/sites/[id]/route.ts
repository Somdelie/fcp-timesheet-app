import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { decimalToNumber } from "@/lib/dateUtc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAdminFromRequest(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (token) {
    const payload = await verifyApiToken(token);
    if (payload && payload.role === "ADMIN") {
      return { id: payload.sub, role: "ADMIN" as const };
    }
  }

  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;

  if (session?.user && role === "ADMIN") {
    return { id: (session.user as any).id as string, role: "ADMIN" as const };
  }

  return null;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await getAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    const now = new Date();

    const site = await prisma.site.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        code: true,
        location: true,
        address: true,
        latitude: true,
        longitude: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    const foremanAssignments = await prisma.foremanSiteAssignment.findMany({
      where: {
        siteId: id,
        startsOn: { lte: now },
        OR: [{ endsOn: null }, { endsOn: { gt: now } }],
      },
      select: {
        foremanId: true,
        foreman: {
          select: {
            userId: true,
            user: { select: { name: true, email: true } },
          },
        },
        startsOn: true,
        endsOn: true,
      },
      orderBy: [{ startsOn: "desc" }],
    });

    const supervisorAssignments =
      await prisma.supervisorSiteAssignment.findMany({
        where: {
          siteId: id,
          startsOn: { lte: now },
          OR: [{ endsOn: null }, { endsOn: { gt: now } }],
        },
        select: {
          supervisor: {
            select: {
              userId: true,
              user: { select: { name: true, email: true } },
            },
          },
          startsOn: true,
          endsOn: true,
        },
        orderBy: [{ startsOn: "desc" }],
      });

    // Calculate total project wages from all attendance scans for this site
    const scans = await prisma.attendanceScan.findMany({
      where: { siteId: id },
      select: { dayRateAtScan: true },
    });
    const totalProjectWages = scans.reduce(
      (sum, s) => sum + decimalToNumber(s.dayRateAtScan),
      0,
    );

    return NextResponse.json({
      ok: true,
      site: {
        id: site.id,
        name: site.name,
        code: site.code,
        location: site.location,
        address: site.address,
        latitude: site.latitude,
        longitude: site.longitude,
        isActive: site.isActive,
        createdAt: site.createdAt.toISOString(),
      },
      totalProjectWages,
      foremen: foremanAssignments.map((a) => ({
        foremanId: a.foremanId,
        userId: a.foreman.userId,
        name: a.foreman.user?.name ?? a.foreman.user?.email ?? "Foreman",
        email: a.foreman.user?.email ?? null,
        startsOn: a.startsOn.toISOString(),
        endsOn: a.endsOn ? a.endsOn.toISOString() : null,
      })),
      supervisors: supervisorAssignments.map((a) => ({
        userId: a.supervisor.userId,
        name:
          a.supervisor.user?.name ?? a.supervisor.user?.email ?? "Supervisor",
        email: a.supervisor.user?.email ?? null,
        startsOn: a.startsOn.toISOString(),
        endsOn: a.endsOn ? a.endsOn.toISOString() : null,
      })),
    });
  } catch (e: any) {
    console.error("Error fetching admin site detail:", e);
    return NextResponse.json(
      { error: "Failed to fetch site" },
      { status: 500 },
    );
  }
}
