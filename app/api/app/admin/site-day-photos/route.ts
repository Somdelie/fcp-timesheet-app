import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDaysUTC } from "@/lib/dateUtc";
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
  // 1) Prefer API Bearer token (mobile/desktop clients)
  const apiCtx = await requireApiAuth(req, ["ADMIN"]);
  if (apiCtx) {
    return { id: apiCtx.user.sub, role: apiCtx.user.role } as const;
  }

  // 2) Fallback to NextAuth web session (admin dashboard)
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;

  if (session?.user && role === "ADMIN") {
    return { id: (session.user as any).id as string, role } as const;
  }

  return null;
}

export async function GET(req: NextRequest) {
  const actor = await getAdminFromRequest(req);
  if (!actor) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const url = new URL(req.url);
  const supervisorId = url.searchParams.get("supervisorId");
  const foremanId = url.searchParams.get("foremanId");

  // Last 7 days window
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const sevenDaysAgo = addDaysUTC(todayStart, -7);

  // Build where clause
  const whereClause: any = {
    uploadedAt: { gte: sevenDaysAgo },
  };

  if (foremanId) {
    whereClause.siteDay = { foremanId };
  }

  // Get all photos uploaded in the last 7 days
  const photos = await prisma.siteDayPhoto.findMany({
    where: whereClause,
    include: {
      siteDay: {
        include: {
          site: {
            select: {
              id: true,
              name: true,
              supervisorAssignments: {
                where: {
                  startsOn: { lte: new Date() },
                  OR: [{ endsOn: null }, { endsOn: { gt: new Date() } }],
                },
                include: {
                  supervisor: {
                    include: {
                      user: { select: { id: true, name: true } },
                    },
                  },
                },
                take: 1,
              },
            },
          },
          foreman: {
            include: {
              user: { select: { id: true, name: true } },
            },
          },
        },
      },
      uploadedByUser: { select: { id: true, name: true } },
      verification: { select: { status: true } },
    },
    orderBy: { uploadedAt: "desc" },
  });

  // Map to the expected response format with supervisor info
  let result = photos.map((photo) => {
    const supervisorAssignment = photo.siteDay.site.supervisorAssignments[0];
    return {
      id: photo.id,
      imageUrl: photo.imageUrl,
      dateTakenISO: photo.siteDay.workDate.toISOString(),
      uploadedAtISO: photo.uploadedAt.toISOString(),
      siteName: photo.siteDay.site.name,
      siteId: photo.siteDay.site.id,
      foremanName: photo.siteDay.foreman.user.name ?? "Unknown Foreman",
      foremanId: photo.siteDay.foreman.id,
      supervisorName: supervisorAssignment?.supervisor.user.name ?? null,
      supervisorId: supervisorAssignment?.supervisor.id ?? null,
      verificationStatus: photo.verification?.status ?? "PENDING",
      latitude: photo.latitude,
      longitude: photo.longitude,
      address: photo.address,
    };
  });

  // Filter by supervisor if specified
  if (supervisorId) {
    result = result.filter((p) => p.supervisorId === supervisorId);
  }

  // Get unique foremen and supervisors for filter dropdowns
  const foremenMap = new Map<string, string>();
  const supervisorsMap = new Map<string, string>();

  for (const photo of result) {
    if (photo.foremanId && photo.foremanName) {
      foremenMap.set(photo.foremanId, photo.foremanName);
    }
    if (photo.supervisorId && photo.supervisorName) {
      supervisorsMap.set(photo.supervisorId, photo.supervisorName);
    }
  }

  const foremen = Array.from(foremenMap.entries()).map(([id, name]) => ({
    id,
    name,
  }));
  const supervisors = Array.from(supervisorsMap.entries()).map(
    ([id, name]) => ({ id, name }),
  );

  return NextResponse.json(
    { photos: result, foremen, supervisors },
    {
      headers: {
        ...CORS_HEADERS,
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
      },
    },
  );
}
