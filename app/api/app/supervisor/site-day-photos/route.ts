import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { addDaysUTC } from "@/lib/dateUtc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

async function getAuth(req: Request) {
  let userId: string | null = null;
  let role: string | null = null;

  const token = getBearer(req);
  if (token) {
    const payload = await verifyApiToken(token);
    if (!payload) return { userId: null, role: null };
    userId = payload.sub;
    role = payload.role;
  } else {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    userId = user?.id ?? null;
    role = user?.role ?? null;
  }

  return { userId, role };
}

export async function GET(req: Request) {
  const { userId, role } = await getAuth(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "SUPERVISOR")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supervisor = await prisma.supervisor.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!supervisor)
    return NextResponse.json(
      { error: "Supervisor not found" },
      { status: 404 },
    );

  const now = new Date();

  // Get supervisor's active site assignments
  const assignments = await prisma.supervisorSiteAssignment.findMany({
    where: {
      supervisorId: supervisor.id,
      startsOn: { lte: now },
      OR: [{ endsOn: null }, { endsOn: { gt: now } }],
    },
    select: { siteId: true },
  });

  const siteIds = Array.from(new Set(assignments.map((a) => a.siteId)));
  if (siteIds.length === 0) return NextResponse.json({ photos: [] });

  // Last 7 days window
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const sevenDaysAgo = addDaysUTC(todayStart, -7);

  // Get photos uploaded in the last 7 days for supervisor's sites
  const photos = await prisma.siteDayPhoto.findMany({
    where: {
      siteDay: {
        siteId: { in: siteIds },
      },
      uploadedAt: { gte: sevenDaysAgo },
    },
    include: {
      siteDay: {
        include: {
          site: { select: { id: true, name: true } },
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

  // Map to the expected response format
  const result = photos.map((photo) => ({
    id: photo.id,
    imageUrl: photo.imageUrl,
    dateTakenISO: photo.siteDay.workDate.toISOString(),
    uploadedAtISO: photo.uploadedAt.toISOString(),
    siteName: photo.siteDay.site.name,
    siteId: photo.siteDay.site.id,
    foremanName: photo.siteDay.foreman.user.name ?? "Unknown Foreman",
    foremanId: photo.siteDay.foreman.id,
    verificationStatus: photo.verification?.status ?? "PENDING",
    latitude: photo.latitude,
    longitude: photo.longitude,
  }));

  return NextResponse.json({ photos: result });
}
