import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendExpoPush } from "@/lib/expoPush";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "ADMIN" && user.role !== "SUPERVISOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: photoId } = await ctx.params;

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const status = String(body?.status ?? "").toUpperCase();
  const notes = String(body?.notes ?? "").trim() || null;

  if (!["VERIFIED", "REJECTED"].includes(status)) {
    return NextResponse.json(
      { error: "status must be 'VERIFIED' or 'REJECTED'" },
      { status: 400 },
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
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    // Create or update PhotoVerification
    const verification = await prisma.photoVerification.upsert({
      where: { photoId },
      create: {
        photoId,
        status: status as "VERIFIED" | "REJECTED",
        verifiedByUserId: user.id,
        verifiedAt: new Date(),
        notes,
      },
      update: {
        status: status as "VERIFIED" | "REJECTED",
        verifiedByUserId: user.id,
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
          siteDayId: siteDay.id,
          requestedByUserId: user.id,
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

    return NextResponse.json({
      ok: true,
      verification: {
        id: verification.id,
        status: verification.status,
        verifiedAt: verification.verifiedAt?.toISOString() ?? null,
        notes: verification.notes,
      },
    });
  } catch (err: any) {
    console.error("[verify-site-day-photo] Error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 },
    );
  }
}
