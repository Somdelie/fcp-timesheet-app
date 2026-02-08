import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildYearFortnightsUTC } from "@/lib/timesheetPeriods";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any)?.role;
  if (role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const year = Number(body?.year);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }

  // Get the anchor from TimesheetYear
  const yearConfig = await prisma.timesheetYear.findUnique({
    where: { year },
    select: { anchorSat: true },
  });

  if (!yearConfig) {
    return NextResponse.json(
      {
        error:
          "Year not configured. Use /admin/timesheets/generate-year first.",
      },
      { status: 400 },
    );
  }

  const periods = buildYearFortnightsUTC(year, yearConfig.anchorSat);

  // idempotent create (skipDuplicates works because of @@unique startDate+endDate)
  await prisma.timesheetPeriod.createMany({
    data: periods.map((p) => ({
      startDate: p.startDate,
      endDate: p.endDate,
      label: p.label,
    })),
    skipDuplicates: true,
  });

  return NextResponse.json({
    ok: true,
    year,
    createdOrExisting: periods.length,
  });
}
