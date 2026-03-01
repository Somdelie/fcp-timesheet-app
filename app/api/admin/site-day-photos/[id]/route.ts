import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteImage } from "@/lib/cloudinary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DELETE /api/admin/site-day-photos/[id]
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: photoId } = await ctx.params;

  const photo = await prisma.siteDayPhoto.findUnique({
    where: { id: photoId },
    select: { id: true, cloudinaryPublicId: true },
  });

  if (!photo) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  // Delete from Cloudinary if we have a public ID
  if (photo.cloudinaryPublicId) {
    try {
      await deleteImage(photo.cloudinaryPublicId);
    } catch (err) {
      console.error("[delete-site-day-photo] Cloudinary delete error:", err);
      // Continue with DB deletion even if Cloudinary fails
    }
  }

  // Cascade deletes will remove related PhotoVerification and PhotoDetection
  await prisma.siteDayPhoto.delete({
    where: { id: photoId },
  });

  return NextResponse.json({ ok: true });
}
