import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/apiAuth";

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
  const apiCtx = await requireApiAuth(req, ["ADMIN"]);
  if (apiCtx) {
    return { id: apiCtx.user.sub, role: apiCtx.user.role } as const;
  }

  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (session?.user && role === "ADMIN") {
    return { id: (session.user as any).id as string, role } as const;
  }

  return null;
}

/**
 * GET /api/app/admin/manual-scan?q=<search>
 *
 * Returns recent manual attendance scans. Supports optional search by
 * employee name, employee code, or site name.
 */
export async function GET(req: NextRequest) {
  const actor = await getAdminFromRequest(req);
  if (!actor) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() || "";

  const where: any = {
    scanType: "MANUAL",
  };

  if (q) {
    where.OR = [
      {
        employee: {
          firstName: { contains: q, mode: "insensitive" },
        },
      },
      {
        employee: {
          lastName: { contains: q, mode: "insensitive" },
        },
      },
      {
        employee: {
          qrCodeValue: { contains: q, mode: "insensitive" },
        },
      },
      {
        site: {
          name: { contains: q, mode: "insensitive" },
        },
      },
    ];
  }

  try {
    const scans = await prisma.attendanceScan.findMany({
      where,
      orderBy: { scannedAt: "desc" },
      take: 100,
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            qrCodeValue: true,
          },
        },
        site: {
          select: { name: true },
        },
      },
    });

    const data = scans.map((s) => ({
      id: s.id,
      employeeName: `${s.employee.firstName} ${s.employee.lastName}`.trim(),
      employeeCode: s.employee.qrCodeValue ?? null,
      siteName: s.site.name,
      scannedAt: s.scannedAt.toISOString(),
    }));

    return NextResponse.json({ data }, { headers: CORS_HEADERS });
  } catch (err: any) {
    console.error("[manual-scan] GET error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
