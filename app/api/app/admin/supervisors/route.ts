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

  try {
    const supervisors = await prisma.user.findMany({
      where: { role: "SUPERVISOR" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        supervisor: {
          select: {
            id: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      {
        ok: true,
        supervisors: supervisors.map((s) => ({
          id: s.id,
          email: s.email,
          name: s.name,
          role: s.role,
          createdAt: s.createdAt.toISOString(),
          supervisor: s.supervisor,
        })),
      },
      { headers: CORS_HEADERS },
    );
  } catch (e: any) {
    console.error("Error fetching supervisors:", e);
    return NextResponse.json(
      { error: "Failed to fetch supervisors" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
