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
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token)
      return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const payload = await verifyApiToken(token);
    if (!payload)
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    if (payload.role !== "FOREMAN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Resolve if user is real foreman or assistant
    // Note: assistants cannot list days without specifying a foreman
    // For now, we infer the foreman from the helper (will fail if multiple links)
    const resolved = await resolveActingForeman(payload.sub);
    if (!resolved.ok) {
      return NextResponse.json(
        { error: resolved.error },
        { status: resolved.status },
      );
    }

    const actingForemanId = resolved.foremanId!;

    // last 90 days (adjust if you want more/less)
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 90);
    since.setUTCHours(0, 0, 0, 0);

    /**
     * IMPORTANT:
     * If your relation name is NOT `attendanceScans`, rename it.
     * Common alternatives: `scans`, `AttendanceScan`, etc.
     */
    const days = await prisma.siteDay.findMany({
      where: {
        foremanId: actingForemanId,
        workDate: { gte: since },
      },
      orderBy: { workDate: "desc" },
      select: {
        id: true,
        workDate: true,
        site: { select: { id: true, name: true } },

        // if your relation is named `attendanceScans`, this will work:
        // _count: { select: { attendanceScans: true } },
        // If Prisma complains, replace with:
        _count: { select: { scans: true } },
      },
    });

    const dto = days.map((d) => ({
      id: d.id,
      dateISO: toISODateUTC(d.workDate),
      scannedCount:
        (d as any)._count?.attendanceScans ?? (d as any)._count?.scans ?? 0,
      site: d.site,
    }));

    return NextResponse.json({ days: dto });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 },
    );
  }
}
