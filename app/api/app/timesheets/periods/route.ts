import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}

function toISODateUTC(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
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

  if (role !== "ADMIN" && role !== "SUPERVISOR") {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: CORS_HEADERS },
    );
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

  return NextResponse.json(
    {
      ok: true,
      periods: periods.map((p) => ({
        id: `${toISODateUTC(p.startDate)}_${toISODateUTC(p.endDate)}`,
        startISO: toISODateUTC(p.startDate),
        endISO: toISODateUTC(p.endDate),
        label: p.label ?? null,
      })),
    },
    { headers: CORS_HEADERS },
  );
}
