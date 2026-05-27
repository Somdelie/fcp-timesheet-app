import { NextResponse } from "next/server";
import { deleteImage } from "@/lib/cloudinary";
import { verifyApiToken } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
import { resolveActingForeman } from "@/lib/resolveActingForeman";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const payload = await verifyApiToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
  if (payload.role !== "FOREMAN" && payload.role !== "EMPLOYEE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const resolved = await resolveActingForeman(
    payload.sub,
    req.headers.get("x-acting-foreman-id")?.trim() || null,
  );
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status },
    );
  }

  const { id } = await ctx.params;
  const photo = await prisma.siteDayPhoto.findFirst({
    where: { id, siteDay: { foremanId: resolved.foremanId } },
    select: {
      id: true,
      cloudinaryPublicId: true,
      verification: { select: { status: true } },
    },
  });

  if (!photo) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }
  if (photo.verification?.status === "VERIFIED") {
    return NextResponse.json(
      { error: "Verified photos cannot be deleted." },
      { status: 409 },
    );
  }

  if (photo.cloudinaryPublicId) {
    try {
      await deleteImage(photo.cloudinaryPublicId);
    } catch (error) {
      console.error("[foreman-delete-site-day-photo] cloud delete failed", error);
    }
  }

  await prisma.siteDayPhoto.delete({ where: { id: photo.id } });
  return NextResponse.json({ ok: true });
}
