import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendExpoPush } from "@/lib/expoPush";
import { requireApiAuth } from "@/lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}

async function getAdminOrSupervisorFromRequest(req: NextRequest) {
  // 1) Prefer API Bearer token (mobile/desktop clients)
  const apiCtx = await requireApiAuth(req, ["ADMIN", "SUPERVISOR"]);
  if (apiCtx) {
    return { id: apiCtx.user.sub, role: apiCtx.user.role } as const;
  }

  // 2) Fallback to NextAuth web session (admin dashboard)
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;

  if (session?.user && (role === "ADMIN" || role === "SUPERVISOR")) {
    return { id: (session.user as any).id as string, role } as const;
  }

  return null;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const actor = await getAdminOrSupervisorFromRequest(req);
  if (!actor) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { id: photoId } = await ctx.params;

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const status = String(body?.status ?? "").toUpperCase();
  const notes = String(body?.notes ?? "").trim() || null;

  if (!["VERIFIED", "REJECTED"].includes(status)) {
    return NextResponse.json(
      { error: "status must be 'VERIFIED' or 'REJECTED'" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  try {
    // Get the photo with site day info
    const photo = await prisma.siteDayPhoto.findUnique({
      where: { id: photoId },
      include: {
        siteDay: {
          include: {
            site: { select: { id: true, name: true, code: true } },
            foreman: {
              include: {
                user: { select: { id: true, name: true } },
              },
            },
          },
        },
        verification: true,
      },
    });

    if (!photo) {
      return NextResponse.json(
        { error: "Photo not found" },
        { status: 404, headers: CORS_HEADERS },
      );
    }

    // Create or update PhotoVerification
    const verification = await prisma.photoVerification.upsert({
      where: { photoId },
      create: {
        photoId,
        status: status as "VERIFIED" | "REJECTED",
        verifiedByUserId: actor.id,
        verifiedAt: new Date(),
        notes,
      },
      update: {
        status: status as "VERIFIED" | "REJECTED",
        verifiedByUserId: actor.id,
        verifiedAt: new Date(),
        notes,
      },
    });

    // If rejected, create a new photo request and notify the foreman
    if (status === "REJECTED") {
      const { siteDay } = photo;

      // Create a new photo request for this site day
      await prisma.siteDayPhotoRequest.create({
        data: {
          siteDay: { connect: { id: siteDay.id } },
          requestedByUser: { connect: { id: actor.id } },
          note: notes || "Previous photo was rejected. Please retake.",
          status: "REQUESTED",
        },
      });

      // Send push notification to foreman
      try {
        const foremanUserId = siteDay.foreman.user.id;
        const pushTokens = await prisma.pushToken.findMany({
          where: { userId: foremanUserId },
          select: { token: true },
        });

        if (pushTokens.length > 0) {
          const siteLabel = siteDay.site.code
            ? `${siteDay.site.code} • ${siteDay.site.name}`
            : siteDay.site.name;

          const workDateStr = siteDay.workDate.toISOString().split("T")[0];

          await sendExpoPush(
            pushTokens.map((t) => t.token),
            {
              title: "Photo Rejected - Retake Required",
              body: `Site: ${siteLabel} • Date: ${workDateStr}${notes ? ` • ${notes}` : ""}`,
              data: {
                type: "PHOTO_REJECTED",
                siteId: siteDay.site.id,
                siteDayId: siteDay.id,
                dateISO: workDateStr,
              },
            },
          );
        }
      } catch (e) {
        console.error("Failed to send rejection push notification:", e);
      }
    }

    return NextResponse.json(
      {
        ok: true,
        verification: {
          id: verification.id,
          status: verification.status,
          verifiedAt: verification.verifiedAt?.toISOString() ?? null,
          notes: verification.notes,
        },
      },
      { headers: CORS_HEADERS },
    );
  } catch (err: any) {
    console.error("[app-verify-site-day-photo] Error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
