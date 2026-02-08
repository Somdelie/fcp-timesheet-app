import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { verifyApiToken } from "@/lib/jwt";
import { currentFortnightSatFri } from "@/lib/fortnight";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

function utcDateFromISO(iso: string) {
  // always interpret as UTC midnight
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${iso}`);
  return d;
}

export async function GET(req: Request) {
  try {
    let userId: string | null = null;
    let role: string | null = null;

    const token = getBearer(req);

    if (token) {
      const payload = await verifyApiToken(token);
      if (!payload)
        return NextResponse.json(
          { ok: false, error: "Unauthorized" },
          { status: 401 },
        );

      userId = payload.sub;
      role = payload.role;
    } else {
      const session = await getServerSession(authOptions);
      const user = session?.user as any;
      userId = user?.id ?? null;
      role = user?.role ?? null;
    }

    if (!userId)
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );

    if (role !== "SUPERVISOR")
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 },
      );

    // ✅ No DB query needed here. This endpoint only provides dropdown periods.
    const current = currentFortnightSatFri(new Date());

    const periods: { id: string; startISO: string; endISO: string }[] = [];

    let start = utcDateFromISO(current.startISO);

    for (let i = 0; i < 6; i++) {
      const s = new Date(start);
      const e = new Date(start);

      e.setUTCDate(e.getUTCDate() + 13);

      const startISO = s.toISOString().slice(0, 10);
      const endISO = e.toISOString().slice(0, 10);

      periods.push({ id: `${startISO}_${endISO}`, startISO, endISO });

      start.setUTCDate(start.getUTCDate() - 14);
    }

    return NextResponse.json({
      ok: true,
      periods,
      currentId: current.id,
    });
  } catch (e: any) {
    console.error("Error fetching supervisor timesheet periods:", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 },
    );
  }
}
