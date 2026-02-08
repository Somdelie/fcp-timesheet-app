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
  if ((session.user as any)?.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const year = Number(url.searchParams.get("year"));

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }

  const row = await prisma.timesheetYear.findUnique({
    where: { year },
    select: { year: true, anchorSat: true },
  });

  return NextResponse.json({
    ok: true,
    year,
    anchorISO: row?.anchorSat ? toISODateUTC(row.anchorSat) : null,
  });
}
