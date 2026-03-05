import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { uploadImageFile, getSecureUrl } from "@/lib/cloudinary";
import { resolveActingForeman } from "@/lib/resolveActingForeman";

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
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Allow FOREMAN and EMPLOYEE roles - assistants are employees who can act for foremen
    if (payload.role !== "FOREMAN" && payload.role !== "EMPLOYEE") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Support x-acting-foreman-id header for assistants
    const actingForemanIdHeader =
      req.headers.get("x-acting-foreman-id")?.trim() || null;

    // Resolve whether user is a real foreman or an assistant acting on behalf of a foreman
    const resolved = await resolveActingForeman(
      payload.sub,
      actingForemanIdHeader,
    );
    if (!resolved.ok) {
      return NextResponse.json(
        { error: resolved.error },
        { status: resolved.status },
      );
    }

    const actingForemanId = resolved.foremanId!;

    const { siteDayId } = await ctx.params;

    // Check siteDay ownership against the resolved foreman ID
    const siteDay = await prisma.siteDay.findFirst({
      where: { id: siteDayId, foremanId: actingForemanId },
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
    const latitudeStr = formData.get("latitude");
    const longitudeStr = formData.get("longitude");
    const addressStr = formData.get("address");

    const latitude = latitudeStr ? parseFloat(String(latitudeStr)) : null;
    const longitude = longitudeStr ? parseFloat(String(longitudeStr)) : null;
    const address = addressStr ? String(addressStr).trim() || null : null;

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
        siteDay: { connect: { id: siteDay.id } },
        imageUrl: url,
        cloudinaryPublicId: upload.public_id,
        uploadedByUser: { connect: { id: payload.sub } },
        request: requestId ? { connect: { id: requestId } } : undefined,
        latitude: Number.isFinite(latitude) ? latitude : null,
        longitude: Number.isFinite(longitude) ? longitude : null,
        address: address ?? undefined,
      },
      select: {
        id: true,
        siteDayId: true,
        imageUrl: true,
        uploadedAt: true,
        requestId: true,
        latitude: true,
        longitude: true,
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
