import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serializeSettings(s: any) {
  return {
    id: s.id,
    defaultEmployeeDayRate: String(s.defaultEmployeeDayRate),
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
    const ctx = await requireApiAuth(request, ["ADMIN"]);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    return NextResponse.json({
      ok: true,
      settings: serializeSettings(settings),
    });
  } catch (error) {
    console.error("Error fetching company settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 },
    );
  }
}
