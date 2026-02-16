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
  const year = Number(url.searchParams.get("year"));

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json(
      { error: "Invalid year" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const row = await prisma.timesheetYear.findUnique({
    where: { year },
    select: { year: true, anchorSat: true },
  });

  return NextResponse.json(
    {
      ok: true,
      year,
      anchorISO: row?.anchorSat ? toISODateUTC(row.anchorSat) : null,
    },
    { headers: CORS_HEADERS },
  );
}
