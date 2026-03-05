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

/**
 * POST /api/app/attendance/scan-out-all
 *
 * Scan out all employees for a given site day.
 * This is triggered when the foreman uploads the end-of-day site photo.
 * The site day photo serves as proof of the work day ending.
 *
 * Body: { siteDayId, photoId?, latitude?, longitude?, address? }
 * Returns: { ok: true, scannedOutCount: number }
 */
export async function POST(req: Request) {
  const token = getBearer(req);
  if (!token)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await verifyApiToken(token);
  if (!payload)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Allow FOREMAN and EMPLOYEE roles (assistants are employees acting for foremen)
  if (payload.role !== "FOREMAN" && payload.role !== "EMPLOYEE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = BodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { siteDayId, photoId } = body.data;

  // Resolve acting foreman (supports assistants)
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

  // Verify the site day belongs to this foreman
  const siteDay = await prisma.siteDay.findFirst({
    where: { id: siteDayId, foremanId: actingForemanId },
    select: { id: true, siteId: true, workDate: true },
  });

  if (!siteDay) {
    return NextResponse.json(
      { error: "Site day not found or not yours" },
      { status: 404 },
    );
  }

  // If photoId provided, verify it belongs to this site day
  if (photoId) {
    const photo = await prisma.siteDayPhoto.findFirst({
      where: { id: photoId, siteDayId },
      select: { id: true },
    });
    if (!photo) {
      return NextResponse.json(
        { error: "Photo not found for this site day" },
        { status: 404 },
      );
    }
  }

  const now = new Date();

  // Find all scans for this site day that haven't been scanned out yet
  const scansToUpdate = await prisma.attendanceScan.findMany({
    where: {
      siteDayId,
      direction: "IN",
      scannedOutAt: null,
    },
    select: { id: true, employeeId: true },
  });

  if (scansToUpdate.length === 0) {
    return NextResponse.json({
      ok: true,
      scannedOutCount: 0,
      message:
        "No employees to scan out (all already scanned out or none scanned in)",
    });
  }

  // Batch update all scans to mark them as scanned out
  const result = await prisma.attendanceScan.updateMany({
    where: {
      id: { in: scansToUpdate.map((s) => s.id) },
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
    message: `${result.count} employee(s) scanned out successfully`,
  });
}
