import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toISODateUTC(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any)?.role;
  if (role !== "ADMIN" && role !== "SUPERVISOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const year = Number(url.searchParams.get("year") ?? "");
  const useYear = Number.isInteger(year) ? year : null;

  const where = useYear
    ? {
        startDate: {
          gte: new Date(Date.UTC(useYear, 0, 1)),
          lt: new Date(Date.UTC(useYear + 1, 0, 1)),
        },
      }
    : undefined;

  const periods = await prisma.timesheetPeriod.findMany({
    where,
    orderBy: [{ startDate: "desc" }],
    select: { startDate: true, endDate: true, label: true },
  });

  return NextResponse.json({
    ok: true,
    periods: periods.map((p) => ({
      id: `${toISODateUTC(p.startDate)}_${toISODateUTC(p.endDate)}`,
      startISO: toISODateUTC(p.startDate),
      endISO: toISODateUTC(p.endDate),
      label: p.label ?? null,
    })),
  });
}
