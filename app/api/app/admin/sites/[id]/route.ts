import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { decimalToNumber } from "@/lib/dateUtc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const SPEC_STATUSES = [
  "NOT_REQUESTED",
  "NOT_NEEDED",
  "NOT_REQUIRED",
  "REQUESTED",
  "RECEIVED",
  "ACTIONED",
] as const;

type SiteSpecStatus = (typeof SPEC_STATUSES)[number];

function normalizeSpecStatus(value: unknown): SiteSpecStatus | undefined {
  if (value === undefined) return undefined;
  const status = String(value ?? "").trim().toUpperCase();
  if (status === "NOT_NEEDED") return "NOT_REQUIRED";
  return SPEC_STATUSES.includes(status as SiteSpecStatus)
    ? (status as SiteSpecStatus)
    : undefined;
}

function specAvailableFromStatus(status: SiteSpecStatus) {
  return status === "RECEIVED" || status === "ACTIONED";
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

async function getAuthFromRequest(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (token) {
    const payload = await verifyApiToken(token);
    if (
      payload &&
      (payload.role === "ADMIN" ||
        payload.role === "OFFICE" ||
        payload.role === "SUPERVISOR")
    ) {
      return {
        id: payload.sub,
        role: payload.role as "ADMIN" | "OFFICE" | "SUPERVISOR",
      };
    }
  }

  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;

  if (
    session?.user &&
    (role === "ADMIN" || role === "OFFICE" || role === "SUPERVISOR")
  ) {
    return {
      id: (session.user as any).id as string,
      role: role as "ADMIN" | "OFFICE" | "SUPERVISOR",
    };
  }

  return null;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthFromRequest(req);
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS },
      );
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
        specStatus: true,
        specAvailable: true,
        createdAt: true,
      },
    });

    if (!site) {
      return NextResponse.json(
        { error: "Site not found" },
        { status: 404, headers: CORS_HEADERS },
      );
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

    return NextResponse.json(
      {
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
          specStatus:
            (site.specStatus as SiteSpecStatus | null | undefined) ??
            (site.specAvailable ? "RECEIVED" : "NOT_REQUESTED"),
          specAvailable: site.specAvailable,
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
      },
      { headers: CORS_HEADERS },
    );
  } catch (e: any) {
    console.error("Error fetching admin site detail:", e);
    return NextResponse.json(
      { error: "Failed to fetch site" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthFromRequest(req);
    if (!auth || auth.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS },
      );
    }

    const { id } = await ctx.params;

    const site = await prisma.site.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!site) {
      return NextResponse.json(
        { error: "Site not found" },
        { status: 404, headers: CORS_HEADERS },
      );
    }

    const body = await req.json();
    const {
      name,
      code,
      location,
      address,
      latitude,
      longitude,
      isActive,
      specStatus: rawSpecStatus,
      specAvailable,
    } = body;
    const specStatus =
      rawSpecStatus !== undefined
        ? normalizeSpecStatus(rawSpecStatus)
        : specAvailable !== undefined
          ? Boolean(specAvailable)
            ? "RECEIVED"
            : "NOT_REQUESTED"
          : undefined;

    if (rawSpecStatus !== undefined && !specStatus) {
      return NextResponse.json(
        { error: "Invalid spec status" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    // Validate name if provided
    if (name !== undefined && typeof name === "string" && !name.trim()) {
      return NextResponse.json(
        { error: "Site name cannot be empty" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    // Validate latitude and longitude if provided
    if (latitude !== undefined && latitude !== null) {
      const lat = Number(latitude);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        return NextResponse.json(
          { error: "Latitude must be between -90 and 90" },
          { status: 400, headers: CORS_HEADERS },
        );
      }
    }

    if (longitude !== undefined && longitude !== null) {
      const lon = Number(longitude);
      if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
        return NextResponse.json(
          { error: "Longitude must be between -180 and 180" },
          { status: 400, headers: CORS_HEADERS },
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined)
      updateData.name = typeof name === "string" ? name.trim() : name;
    if (code !== undefined)
      updateData.code = typeof code === "string" ? code.trim() || null : code;
    if (location !== undefined)
      updateData.location =
        typeof location === "string" ? location.trim() || null : location;
    if (address !== undefined)
      updateData.address =
        typeof address === "string" ? address.trim() || null : address;
    if (latitude !== undefined)
      updateData.latitude = latitude !== null ? Number(latitude) : null;
    if (longitude !== undefined)
      updateData.longitude = longitude !== null ? Number(longitude) : null;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (specStatus !== undefined) {
      updateData.specStatus = specStatus;
      updateData.specAvailable = specAvailableFromStatus(specStatus);
    } else if (specAvailable !== undefined) {
      updateData.specAvailable = Boolean(specAvailable);
    }

    const updatedSite = await prisma.site.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        code: true,
        location: true,
        address: true,
        latitude: true,
        longitude: true,
        isActive: true,
        specStatus: true,
        specAvailable: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        site: {
          id: updatedSite.id,
          name: updatedSite.name,
          code: updatedSite.code,
          location: updatedSite.location,
          address: updatedSite.address,
          latitude: updatedSite.latitude,
          longitude: updatedSite.longitude,
          isActive: updatedSite.isActive,
          specStatus:
            (updatedSite.specStatus as SiteSpecStatus | null | undefined) ??
            (updatedSite.specAvailable ? "RECEIVED" : "NOT_REQUESTED"),
          specAvailable: updatedSite.specAvailable,
          createdAt: updatedSite.createdAt.toISOString(),
        },
      },
      { headers: CORS_HEADERS },
    );
  } catch (e: any) {
    console.error("Error updating site:", e);
    if (String(e?.code) === "P2002") {
      return NextResponse.json(
        { error: "Site code must be unique" },
        { status: 400, headers: CORS_HEADERS },
      );
    }
    return NextResponse.json(
      { error: "Failed to update site" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthFromRequest(req);
    if (!auth || auth.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS },
      );
    }

    const { id } = await ctx.params;

    const site = await prisma.site.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!site) {
      return NextResponse.json(
        { error: "Site not found" },
        { status: 404, headers: CORS_HEADERS },
      );
    }

    await prisma.site.delete({ where: { id } });

    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
  } catch (e: any) {
    console.error("Error deleting site:", e);
    return NextResponse.json(
      { error: "Failed to delete site" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
