import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/apiAuth";
import { logApiRequest } from "@/lib/apiRequestLogger";

export const runtime = "nodejs";
export const revalidate = 1800;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function serializeSettings(s: any) {
  return {
    id: s.id,
    defaultEmployeeDayRate: String(s.defaultEmployeeDayRate),
    fingerprintMandatory: Boolean(s.fingerprintMandatory),
    scanOutFaceEnabled: s.scanOutFaceEnabled ?? true,
    scanOutPhotoEnabled: s.scanOutPhotoEnabled ?? true,
    updatedAt:
      s.updatedAt instanceof Date
        ? s.updatedAt.toISOString()
        : String(s.updatedAt),
  };
}

/**
 * GET /api/app/admin/settings
 * Fetch company settings (ADMIN only, JWT auth for mobile)
 * Read-only: Use the admin dashboard to modify settings.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireApiAuth(request, ["ADMIN", "SUPERVISOR"]);
    if (!ctx) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS },
      );
    }

    let settings = await prisma.companySettings.findUnique({
      where: { id: "singleton" },
    });

    // Ensure singleton exists
    if (!settings) {
      settings = await prisma.companySettings.create({
        data: { id: "singleton", defaultEmployeeDayRate: 0 },
      });
    }

    const res = NextResponse.json(
      {
        ok: true,
        settings: serializeSettings(settings),
      },
      {
        headers: {
          ...CORS_HEADERS,
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
        },
      },
    );
    logApiRequest("/api/app/admin/settings", request.method, res.status);
    return res;
  } catch (error) {
    console.error("Error fetching company settings:", error);
    const res = NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500, headers: CORS_HEADERS },
    );
    logApiRequest("/api/app/admin/settings", request.method, res.status);
    return res;
  }
}
