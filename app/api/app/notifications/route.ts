import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/apiAuth";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}

async function getUserId(req: NextRequest): Promise<string | null> {
  const apiCtx = await requireApiAuth(req);
  if (apiCtx) return apiCtx.user.sub;

  const session = await getServerSession(authOptions);
  return (session?.user as any)?.id ?? null;
}

// GET /api/app/notifications — list unread (and recent read) notifications for current user
export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }

  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: [{ isRead: "asc" }, { createdAt: "desc" }],
    take: 50,
    select: {
      id: true,
      type: true,
      title: true,
      message: true,
      isRead: true,
      createdAt: true,
      siteId: true,
      linkUrl: true,
    },
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return NextResponse.json(
    { notifications, unreadCount },
    { headers: CORS_HEADERS },
  );
}

// POST /api/app/notifications — mark notifications as read
// Body: { all: true } OR { ids: string[] }
export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // empty body = mark all
  }

  if (body?.ids && Array.isArray(body.ids)) {
    await prisma.notification.updateMany({
      where: { userId, id: { in: body.ids } },
      data: { isRead: true },
    });
  } else {
    // mark all
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
