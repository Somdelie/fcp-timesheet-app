import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildYearFortnightsUTC } from "@/lib/timesheetPeriods";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

// POST /api/app/admin/timesheets/generate-year
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any)?.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const year = Number(body?.year);
  const anchorISO = String(body?.anchorISO ?? ""); // e.g. "2026-01-03"

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorISO)) {
    return NextResponse.json({ error: "Invalid anchorISO" }, { status: 400 });
  }

  const anchor = new Date(`${anchorISO}T00:00:00.000Z`);
  if (anchor.getUTCDay() !== 6) {
    return NextResponse.json(
      { error: "Anchor must be a Saturday" },
      { status: 400 },
    );
  }

  // persist anchor for the year (idempotent)
  await prisma.timesheetYear.upsert({
    where: { year },
    create: { year, anchorSat: anchor },
    update: { anchorSat: anchor },
  });

  const periods = buildYearFortnightsUTC(year, anchor);

  await prisma.timesheetPeriod.createMany({
    data: periods.map((p) => ({
      startDate: p.startDate,
      endDate: p.endDate,
      label: p.label,
    })),
    skipDuplicates: true,
  });

  return NextResponse.json({ ok: true, year, count: periods.length });
}
