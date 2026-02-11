import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { uploadImageFile, getSecureUrl } from "@/lib/cloudinary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ siteDayId: string }> },
) {
  try {
    const token = getBearer(req);
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await verifyApiToken(token);
    if (!payload || payload.role !== "FOREMAN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const foreman = await prisma.foreman.findUnique({
      where: { userId: payload.sub },
      select: { id: true },
    });
    if (!foreman)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { siteDayId } = await ctx.params;

    const siteDay = await prisma.siteDay.findFirst({
      where: { id: siteDayId, foremanId: foreman.id },
      select: { id: true },
    });

    if (!siteDay) {
      return NextResponse.json(
        { error: "Site day not found" },
        { status: 404 },
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const requestId = String(formData.get("requestId") ?? "").trim() || null;

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing file field in form-data" },
        { status: 400 },
      );
    }

    const upload = await uploadImageFile(file, { folder: "site-day-photos" });
    const url = getSecureUrl(upload);

    const photo = await prisma.siteDayPhoto.create({
      data: {
        siteDayId: siteDay.id,
        imageUrl: url,
        cloudinaryPublicId: upload.public_id,
        uploadedByUserId: payload.sub,
        requestId: requestId ?? undefined,
      },
      select: {
        id: true,
        siteDayId: true,
        imageUrl: true,
        uploadedAt: true,
        requestId: true,
      },
    });

    return NextResponse.json({
      photo,
      upload: {
        url,
        publicId: upload.public_id,
        width: upload.width,
        height: upload.height,
        format: upload.format,
      },
    });
  } catch (e: any) {
    console.error("Foreman site-day photo upload error", e);
    return NextResponse.json(
      { error: e?.message ?? "Upload failed" },
      { status: 500 },
    );
  }
}
