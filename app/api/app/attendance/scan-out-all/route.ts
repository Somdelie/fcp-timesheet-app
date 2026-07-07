import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { resolveActingForeman } from "@/lib/resolveActingForeman";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

const BodySchema = z.object({
  siteDayId: z.string().min(1),
  photoId: z.string().min(1).optional(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  address: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const token = getBearer(req);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await verifyApiToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (payload.role !== "FOREMAN" && payload.role !== "EMPLOYEE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { siteDayId, photoId } = parsed.data;

  const actingForemanIdHeader =
    req.headers.get("x-acting-foreman-id")?.trim() || null;

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

  const siteDay = await prisma.siteDay.findFirst({
    where: {
      id: siteDayId,
      foremanId: actingForemanId,
    },
    select: {
      id: true,
    },
  });

  if (!siteDay) {
    return NextResponse.json(
      { error: "Site day not found or not yours" },
      { status: 404 },
    );
  }

  if (photoId) {
    const photo = await prisma.siteDayPhoto.findFirst({
      where: {
        id: photoId,
        siteDayId,
      },
      select: {
        id: true,
      },
    });

    if (!photo) {
      return NextResponse.json(
        { error: "Photo not found for this site day" },
        { status: 404 },
      );
    }
  }

  const now = new Date();

  const result = await prisma.attendanceScan.updateMany({
    where: {
      siteDayId,
      direction: "IN",
      scannedOutAt: null,
    },
    data: {
      scannedOutAt: now,
      scanOutPhotoId: photoId ?? null,
    },
  });

  return NextResponse.json({
    ok: true,
    scannedOutCount: result.count,
    scannedOutAt: now.toISOString(),
    message:
      result.count === 0
        ? "No employees to scan out"
        : `${result.count} employee(s) scanned out successfully`,
  });
}
