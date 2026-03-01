import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteImage } from "@/lib/cloudinary";
import { requireApiAuth } from "@/lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "DELETE, OPTIONS",
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

// DELETE /api/app/admin/site-day-photos/[id]
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const actor = await getAdminFromRequest(req);
  if (!actor) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { id: photoId } = await ctx.params;

  const photo = await prisma.siteDayPhoto.findUnique({
    where: { id: photoId },
    select: { id: true, cloudinaryPublicId: true },
  });

  if (!photo) {
    return NextResponse.json(
      { error: "Photo not found" },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  // Delete from Cloudinary if we have a public ID
  if (photo.cloudinaryPublicId) {
    try {
      await deleteImage(photo.cloudinaryPublicId);
    } catch (err) {
      console.error(
        "[app-admin-delete-site-day-photo] Cloudinary delete error:",
        err,
      );
      // Continue with DB deletion even if Cloudinary fails
    }
  }

  // Cascade deletes will remove related PhotoVerification and PhotoDetection
  await prisma.siteDayPhoto.delete({
    where: { id: photoId },
  });

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
