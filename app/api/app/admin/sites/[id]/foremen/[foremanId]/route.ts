import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

async function getAuthFromRequest(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (token) {
    const payload = await verifyApiToken(token);
    if (payload && payload.role === "ADMIN") {
      return { id: payload.sub, role: payload.role as "ADMIN" };
    }
  }

  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;

  if (session?.user && role === "ADMIN") {
    return {
      id: (session.user as any).id as string,
      role: role as "ADMIN",
    };
  }

  return null;
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; foremanId: string }> },
) {
  try {
    const auth = await getAuthFromRequest(req);
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS },
      );
    }

    const { id: siteId, foremanId } = await params;

    const url = new URL(req.url);
    const endDate = url.searchParams.get("endDate");

    // Find the active assignment
    const assignment = await prisma.foremanSiteAssignment.findFirst({
      where: {
        siteId,
        foremanId,
        endsOn: null,
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: "No active assignment found" },
        { status: 404, headers: CORS_HEADERS },
      );
    }

    // Update with end date
    await prisma.foremanSiteAssignment.update({
      where: { id: assignment.id },
      data: {
        endsOn: endDate ? new Date(endDate) : new Date(),
      },
    });

    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
  } catch (e: any) {
    console.error("Error ending foreman assignment:", e);
    return NextResponse.json(
      { error: "Failed to end foreman assignment" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
