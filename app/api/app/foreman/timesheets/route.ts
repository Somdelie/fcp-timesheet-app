import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function startOfDayUTC(d: Date) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function toISODateUTC(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const EPOCH = new Date("2024-01-01T00:00:00.000Z"); // Monday, stable fortnight anchor
const MS_DAY = 24 * 60 * 60 * 1000;

function fortnightStart(workDate: Date) {
  const a = startOfDayUTC(workDate).getTime();
  const e = EPOCH.getTime();
  const diffDays = Math.floor((a - e) / MS_DAY);
  const idx = Math.floor(diffDays / 14);
  return new Date(e + idx * 14 * MS_DAY);
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

    const foreman = await prisma.foreman.findUnique({
      where: { userId: payload.sub },
      select: { id: true },
    });
    if (!foreman) {
      return NextResponse.json(
        { error: "Foreman profile missing" },
        { status: 403 },
      );
    }

    // Pull recent siteDays (enough to show history). You can widen this.
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 365);
    since.setUTCHours(0, 0, 0, 0);

    const days = await prisma.siteDay.findMany({
      where: { foremanId: foreman.id, workDate: { gte: since } },
      select: {
        id: true,
        workDate: true,
        // IMPORTANT: adjust relation name if needed (same as in /days)
        _count: { select: { scans: true } },
      },
      orderBy: { workDate: "desc" },
    });

    // group into fortnights
    type Agg = {
      start: Date;
      end: Date;
      totalScans: number;
      readyDays: number;
      flaggedDays: number;
      seenDays: Set<string>;
    };

    const byKey = new Map<string, Agg>();

    for (const d of days) {
      const start = fortnightStart(d.workDate);
      const end = new Date(start.getTime() + 13 * MS_DAY);

      const startISO = toISODateUTC(start);
      const endISO = toISODateUTC(end);
      const key = `${startISO}_${endISO}`;

      const scanCount =
        (d as any)._count?.attendanceScans ?? (d as any)._count?.scans ?? 0;

      const dayISO = toISODateUTC(d.workDate);

      let agg = byKey.get(key);
      if (!agg) {
        agg = {
          start,
          end,
          totalScans: 0,
          readyDays: 0,
          flaggedDays: 0,
          seenDays: new Set<string>(),
        };
        byKey.set(key, agg);
      }

      // protect against duplicates (shouldn’t happen, but safe)
      if (agg.seenDays.has(dayISO)) continue;
      agg.seenDays.add(dayISO);

      agg.totalScans += scanCount;
    }

    const today = startOfDayUTC(new Date());
    const todayMs = today.getTime();

    const timesheets = Array.from(byKey.entries())
      .map(([id, agg]) => {
        const startISO = toISODateUTC(agg.start);
        const endISO = toISODateUTC(agg.end);

        const isCurrent =
          todayMs >= agg.start.getTime() && todayMs <= agg.end.getTime();

        return {
          id, // matches your mobile routing
          startISO,
          endISO,
          isCurrent,
          daysCount: 14,
          totalScans: agg.totalScans,
          readyDays: agg.readyDays,
          flaggedDays: agg.flaggedDays,
        };
      })
      // current first, then newest start first
      .sort((a, b) => {
        if (Boolean(a.isCurrent) !== Boolean(b.isCurrent))
          return a.isCurrent ? -1 : 1;
        return String(b.startISO).localeCompare(String(a.startISO));
      });

    return NextResponse.json({ timesheets });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 },
    );
  }
}
