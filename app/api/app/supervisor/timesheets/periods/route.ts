import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { currentFortnightSatFri } from "@/lib/fortnight";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

export async function GET(req: Request) {
  try {
    let userId: string | null = null;
    let role: string | null = null;

    const token = getBearer(req);

    if (token) {
      const payload = await verifyApiToken(token);
      if (!payload)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

      userId = payload.sub;
      role = payload.role;
    } else {
      const session = await getServerSession(authOptions);
      const user = session?.user as any;
      userId = user?.id ?? null;
      role = user?.role ?? null;
    }

    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (role !== "SUPERVISOR")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const supervisor = await prisma.supervisor.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!supervisor)
      return NextResponse.json(
        { error: "Supervisor not found" },
        { status: 404 },
      );

    // Active foremen this supervisor manages
    const now = new Date();
    const links = await prisma.supervisorForeman.findMany({
      where: {
        supervisorId: supervisor.id,
        startsOn: { lte: now },
        OR: [{ endsOn: null }, { endsOn: { gt: now } }],
      },
      select: { foremanId: true },
    });

    const foremanIds = links.map((l) => l.foremanId);
    if (foremanIds.length === 0)
      return NextResponse.json({ periods: [], currentId: null });

    // Use the shared Saturday-based fortnight helper to build
    // the current period plus a few previous ones, independent
    // of whether TimesheetPeriod rows already exist.
    const current = currentFortnightSatFri(new Date());

    const periods: { id: string; startISO: string; endISO: string }[] = [];
    let start = new Date(`${current.startISO}T00:00:00`);
    for (let i = 0; i < 6; i++) {
      const s = new Date(start);
      const e = new Date(s);
      e.setDate(e.getDate() + 13);
      const startISO = s.toISOString().slice(0, 10);
      const endISO = e.toISOString().slice(0, 10);
      periods.push({ id: `${startISO}_${endISO}`, startISO, endISO });
      start.setDate(start.getDate() - 14);
    }
    return NextResponse.json({
      periods,
      currentId: current.id,
    });
  } catch (e: any) {
    console.error("Error fetching supervisor timesheet periods:", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 },
    );
  }
}
