import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { logApiRequest } from "@/lib/apiRequestLogger";

export const runtime = "nodejs";
export const revalidate = 1800;

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
      (payload.role === "ADMIN" || payload.role === "SUPERVISOR")
    ) {
      return { id: payload.sub, role: payload.role as "ADMIN" | "SUPERVISOR" };
    }
  }

  // 2) Fallback to NextAuth web session
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;

  if (session?.user && (role === "ADMIN" || role === "SUPERVISOR")) {
    return {
      id: (session.user as any).id as string,
      role: role as "ADMIN" | "SUPERVISOR",
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
        location: true,
        latitude: true,
        longitude: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const res = NextResponse.json(
      {
        ok: true,
        sites: sites.map((s) => ({
          id: s.id,
          name: s.name,
          code: s.code,
          location: s.location,
          latitude: s.latitude,
          longitude: s.longitude,
          isActive: s.isActive,
          createdAt: s.createdAt.toISOString(),
        })),
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
