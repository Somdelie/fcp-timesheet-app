import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthFromRequest(req);
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS },
      );
    }

    const { id } = await params;

    const assignments = await prisma.supervisorSiteAssignment.findMany({
      where: { siteId: id, endsOn: null },
      include: {
        supervisor: {
          select: {
            id: true,
            userId: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
      orderBy: { startsOn: "desc" },
    });

    return NextResponse.json(
      {
        ok: true,
        assignments: assignments.map((a) => ({
          id: a.id,
          supervisorId: a.supervisorId,
          userId: a.supervisor.userId,
          name: a.supervisor.user.name,
          email: a.supervisor.user.email,
          startsOn: a.startsOn.toISOString(),
          endsOn: a.endsOn?.toISOString() ?? null,
        })),
      },
      { headers: CORS_HEADERS },
    );
  } catch (e: any) {
    console.error("Error listing supervisor assignments:", e);
    return NextResponse.json(
      { error: "Failed to list supervisor assignments" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthFromRequest(req);
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS },
      );
    }

    const { id: siteId } = await params;
    const body = await req.json();
    const { userId, startDate } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    // Check if site exists
    const site = await prisma.site.findUnique({
      where: { id: siteId },
    });

    if (!site) {
      return NextResponse.json(
        { error: "Site not found" },
        { status: 404, headers: CORS_HEADERS },
      );
    }

    // Find supervisor by userId
    const supervisor = await prisma.supervisor.findUnique({
      where: { userId },
      select: {
        id: true,
        userId: true,
        user: { select: { name: true, email: true } },
      },
    });

    if (!supervisor) {
      return NextResponse.json(
        { error: "Supervisor not found for this user" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    // Check for existing active assignment
    const existing = await prisma.supervisorSiteAssignment.findFirst({
      where: {
        siteId,
        supervisorId: supervisor.id,
        endsOn: null,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Supervisor already assigned to this site" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    // Create assignment
    const assignment = await prisma.supervisorSiteAssignment.create({
      data: {
        site: { connect: { id: siteId } },
        supervisor: { connect: { id: supervisor.id } },
        startsOn: startDate ? new Date(startDate) : new Date(),
      },
      include: {
        supervisor: {
          select: {
            id: true,
            userId: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
    });

    return NextResponse.json(
      {
        ok: true,
        assignment: {
          id: assignment.id,
          supervisorId: assignment.supervisorId,
          userId: assignment.supervisor.userId,
          name: assignment.supervisor.user.name,
          email: assignment.supervisor.user.email,
          startsOn: assignment.startsOn.toISOString(),
          endsOn: null,
        },
      },
      { status: 201, headers: CORS_HEADERS },
    );
  } catch (e: any) {
    console.error("Error assigning supervisor:", e);
    return NextResponse.json(
      { error: "Failed to assign supervisor" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
