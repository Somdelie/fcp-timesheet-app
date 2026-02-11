import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { resolveActingForeman } from "@/lib/resolveActingForeman";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toISODateUTC(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    const payload = await verifyApiToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    if (payload.role !== "FOREMAN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const forForemanId = url.searchParams.get("forForemanId");

    const resolved = await resolveActingForeman(
      payload.sub,
      forForemanId || undefined,
    );
    if (!resolved.ok) {
      return NextResponse.json(
        { error: resolved.error },
        { status: resolved.status },
      );
    }

    const actingForemanId = resolved.foremanId!;

    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - 5);
    cutoff.setUTCHours(0, 0, 0, 0);

    const photos = await prisma.siteDayPhoto.findMany({
      where: {
        uploadedAt: { gte: cutoff },
        siteDay: { foremanId: actingForemanId },
      },
      orderBy: [{ siteDay: { workDate: "desc" } }, { uploadedAt: "desc" }],
      select: {
        imageUrl: true,
        uploadedAt: true,
        siteDay: {
          select: {
            workDate: true,
          },
        },
      },
    });

    const dto = photos.map((p) => ({
      imageUrl: p.imageUrl,
      dateTakenISO: toISODateUTC(p.siteDay.workDate),
    }));

    return NextResponse.json({ photos: dto });
  } catch (e: any) {
    console.error("Foreman recent site-day photos error", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 },
    );
  }
}
