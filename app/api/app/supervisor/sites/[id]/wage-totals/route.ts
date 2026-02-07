import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { verifyApiToken } from "@/lib/jwt";
import { currentFortnightSatFri } from "@/lib/fortnight";
import { startOfDayUTC, addDaysUTC, decimalToNumber } from "@/lib/dateUtc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

async function getAuth(req: Request) {
  const token = getBearer(req);
  if (token) {
    const payload = await verifyApiToken(token);
    if (!payload) return { userId: null, role: null };
    return { userId: payload.sub as string, role: payload.role as string };
  }
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  return { userId: user?.id ?? null, role: user?.role ?? null };
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { userId, role } = await getAuth(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "SUPERVISOR")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sup = await prisma.supervisor.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!sup)
    return NextResponse.json(
      { error: "Supervisor not found" },
      { status: 404 },
    );

  const { id: siteId } = await ctx.params;
  const now = new Date();

  const access = await prisma.supervisorSiteAssignment.findFirst({
    where: {
      supervisorId: sup.id,
      siteId,
      startsOn: { lte: now },
      OR: [{ endsOn: null }, { endsOn: { gt: now } }],
    },
    select: { id: true },
  });
  if (!access)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const ft = currentFortnightSatFri(new Date());
  const start = startOfDayUTC(ft.startISO);
  const end = startOfDayUTC(ft.endISO);
  const endExclusive = addDaysUTC(end, 1);

  const scans = await prisma.attendanceScan.findMany({
    where: {
      siteId,
      workDate: { gte: start, lt: endExclusive },
    },
    select: { dayRateAtScan: true },
  });

  const totalDays = scans.length;
  const totalWages = scans.reduce(
    (s, r) => s + decimalToNumber(r.dayRateAtScan),
    0,
  );

  console.log(totalDays);
  console.log(totalWages);

  return NextResponse.json({
    ok: true,
    data: {
      siteId,
      startISO: ft.startISO,
      endISO: ft.endISO,
      totals: { totalDays, totalWages },
    },
  });
}
