import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { logApiRequest } from "@/lib/apiRequestLogger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

async function getAuthFromRequest(req: Request) {
  // 1) Try mobile/API Bearer token
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

  // 2) Fallback to NextAuth web session
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

export async function GET(req: Request) {
  const auth = await getAuthFromRequest(req);
  if (!auth) {
    const res = NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: CORS_HEADERS },
    );
    logApiRequest("/api/app/admin/sites", req.method, res.status);
    return res;
  }

  try {
    const url = new URL(req.url);
    const search = url.searchParams.get("q")?.trim().toLowerCase() || "";
    const isActive = url.searchParams.get("isActive");
    const fields = url.searchParams.get("fields");
    const dateFrom = url.searchParams.get("dateFrom") || "";
    const dateTo = url.searchParams.get("dateTo") || "";

    // Lightweight mode — only id, name, code (for dropdowns / lookups)
    if (fields === "lite") {
      const liteSites = await prisma.site.findMany({
        where: {
          ...(search && {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { code: { contains: search, mode: "insensitive" } },
            ],
          }),
          ...(isActive && { isActive: isActive === "true" }),
        },
        select: { id: true, name: true, code: true, isActive: true },
        orderBy: { name: "asc" },
      });
      const res = NextResponse.json(
        { ok: true, sites: liteSites },
        { headers: CORS_HEADERS },
      );
      logApiRequest("/api/app/admin/sites", req.method, res.status);
      return res;
    }

    // Build date filters for scans / orders
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom + "T00:00:00.000Z");
    if (dateTo) dateFilter.lte = new Date(dateTo + "T23:59:59.999Z");
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    const sites = await prisma.site.findMany({
      where: {
        ...(search && {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { code: { contains: search, mode: "insensitive" } },
            { location: { contains: search, mode: "insensitive" } },
          ],
        }),
        ...(isActive && {
          isActive: isActive === "true",
        }),
      },
      select: {
        id: true,
        name: true,
        code: true,
        client: true,
        location: true,
        latitude: true,
        longitude: true,
        isActive: true,
        specAvailable: true,
        createdAt: true,
        supervisorAssignments: {
          select: {
            supervisor: {
              select: {
                user: {
                  select: { name: true },
                },
              },
            },
            startsOn: true,
            endsOn: true,
          },
          orderBy: { startsOn: "desc" },
          take: 1,
        },
        attendanceScans: {
          where: hasDateFilter ? { workDate: dateFilter } : undefined,
          select: {
            dayRateAtScan: true,
          },
        },
        siteProductOrders: {
          where: hasDateFilter ? { createdAt: dateFilter } : undefined,
          select: {
            items: {
              select: {
                quantity: true,
                unitPriceAtOrder: true,
              },
            },
          },
        },
        finishingSchedules: {
          where: { isActive: true },
          select: { id: true, status: true },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const res = NextResponse.json(
      {
        ok: true,
        sites: sites.map((s) => {
          // Get supervisor name from first active assignment
          const supervisorName =
            s.supervisorAssignments[0]?.supervisor?.user?.name ?? null;
          // Calculate total wages from all attendance scans
          const totalWages = s.attendanceScans.reduce(
            (sum: number, scan: { dayRateAtScan: unknown }) =>
              sum + (Number(scan.dayRateAtScan) || 0),
            0,
          );
          // Calculate total material cost from order items
          const totalMaterialCost =
            (s as any).siteProductOrders?.reduce(
              (sum: number, order: any) =>
                sum +
                (order.items ?? []).reduce(
                  (s2: number, item: any) =>
                    s2 +
                    (Number(item.unitPriceAtOrder) || 0) * (item.quantity || 0),
                  0,
                ),
              0,
            ) ?? 0;
          return {
            id: s.id,
            name: s.name,
            code: s.code,
            client: s.client ?? null,
            location: s.location,
            latitude: s.latitude,
            longitude: s.longitude,
            isActive: s.isActive,
            specAvailable: Boolean(s.specAvailable),
            hasFinishingSchedule: (s.finishingSchedules?.length ?? 0) > 0,
            finishingScheduleStatus: s.finishingSchedules?.[0]?.status ?? null,
            createdAt: s.createdAt.toISOString(),
            supervisorName,
            totalWages,
            totalMaterialCost,
          };
        }),
      },
      {
        headers: {
          ...CORS_HEADERS,
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
        },
      },
    );
    logApiRequest("/api/app/admin/sites", req.method, res.status);
    return res;
  } catch (e: any) {
    console.error("Error fetching sites:", e);
    const res = NextResponse.json(
      { error: "Failed to fetch sites" },
      { status: 500, headers: CORS_HEADERS },
    );
    logApiRequest("/api/app/admin/sites", req.method, res.status);
    return res;
  }
}

export async function POST(req: Request) {
  const auth = await getAuthFromRequest(req);
  if (!auth || auth.role !== "ADMIN") {
    const res = NextResponse.json(
      { error: "Unauthorized – admin only" },
      { status: 401, headers: CORS_HEADERS },
    );
    logApiRequest("/api/app/admin/sites", req.method, res.status);
    return res;
  }

  try {
    const body = await req.json();
    const name = (body.name ?? "").toString().trim();
    const code = (body.code ?? "").toString().trim() || null;
    const location = (body.location ?? "").toString().trim() || null;
    const address = (body.address ?? "").toString().trim() || null;

    if (!name) {
      const res = NextResponse.json(
        { error: "Site name is required." },
        { status: 400, headers: CORS_HEADERS },
      );
      logApiRequest("/api/app/admin/sites", req.method, res.status);
      return res;
    }

    const site = await prisma.site.create({
      data: { name, code, location, address, isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        location: true,
        address: true,
        isActive: true,
        createdAt: true,
      },
    });

    const res = NextResponse.json(
      {
        ok: true,
        site: { ...site, createdAt: site.createdAt.toISOString() },
      },
      { status: 201, headers: CORS_HEADERS },
    );
    logApiRequest("/api/app/admin/sites", req.method, res.status);
    return res;
  } catch (e: any) {
    if (String(e?.code) === "P2002") {
      const res = NextResponse.json(
        { error: "Site code must be unique." },
        { status: 409, headers: CORS_HEADERS },
      );
      logApiRequest("/api/app/admin/sites", req.method, res.status);
      return res;
    }
    console.error("Error creating site:", e);
    const res = NextResponse.json(
      { error: "Failed to create site" },
      { status: 500, headers: CORS_HEADERS },
    );
    logApiRequest("/api/app/admin/sites", req.method, res.status);
    return res;
  }
}
