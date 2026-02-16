import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildYearFortnightsUTC } from "@/lib/timesheetPeriods";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { verifyApiToken } from "@/lib/jwt";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}

// POST /api/app/admin/timesheets/generate-year
export async function POST(req: Request) {
  // Try JWT Bearer token first (Electron app)
  let userId: string | null = null;
  let role: string | null = null;

  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const payload = await verifyApiToken(token);
    if (payload) {
      userId = payload.sub;
      role = payload.role;
    }
  }

  // Fall back to session auth (Next.js web)
  if (!userId) {
    const session = await getServerSession(authOptions);
    if (session?.user) {
      userId = (session.user as any).id;
      role = (session.user as any).role;
    }
  }

  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  if (role !== "ADMIN") {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: CORS_HEADERS },
    );
  }

  const body = await req.json().catch(() => ({}));
  const year = Number(body?.year);
  const anchorISO = String(body?.anchorISO ?? ""); // e.g. "2026-01-03"

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json(
      { error: "Invalid year" },
      { status: 400, headers: CORS_HEADERS },
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorISO)) {
    return NextResponse.json(
      { error: "Invalid anchorISO" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const anchor = new Date(`${anchorISO}T00:00:00.000Z`);
  if (anchor.getUTCDay() !== 6) {
    return NextResponse.json(
      { error: "Anchor must be a Saturday" },
      { status: 400, headers: CORS_HEADERS },
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

  return NextResponse.json(
    { ok: true, year, count: periods.length },
    { headers: CORS_HEADERS },
  );
}
