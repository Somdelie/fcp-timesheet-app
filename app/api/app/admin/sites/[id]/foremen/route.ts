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

    const assignments = await prisma.foremanSiteAssignment.findMany({
      where: { siteId: id, endsOn: null },
      include: {
        foreman: {
          select: { id: true, user: { select: { name: true } } },
        },
      },
      orderBy: { startsOn: "desc" },
    });

    return NextResponse.json(
      {
        ok: true,
        assignments: assignments.map((a) => ({
          id: a.id,
          foremanId: a.foremanId,
          name: a.foreman.user.name,
          startsOn: a.startsOn.toISOString(),
          endsOn: a.endsOn?.toISOString() ?? null,
        })),
      },
      { headers: CORS_HEADERS },
    );
  } catch (e: any) {
    console.error("Error listing foreman assignments:", e);
    return NextResponse.json(
      { error: "Failed to list foreman assignments" },
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
    // Accept either userId (User.id) or foremanId (Foreman.id)
    const { userId, foremanId: directForemanId, startDate } = body;

    if (!userId && !directForemanId) {
      return NextResponse.json(
        { error: "userId or foremanId is required" },
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

    // Check if the site has at least one active supervisor
    const activeSupervisorAssignments =
      await prisma.supervisorSiteAssignment.findMany({
        where: { siteId, endsOn: null },
        select: { supervisorId: true },
      });

    if (activeSupervisorAssignments.length === 0) {
      return NextResponse.json(
        {
          error:
            "Cannot assign foreman: site must have a supervisor first. Please assign a supervisor to this site before adding foremen.",
        },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    // Find foreman - by userId first, then by direct foremanId
    let foreman;
    if (userId) {
      foreman = await prisma.foreman.findUnique({
        where: { userId },
        select: { id: true, user: { select: { name: true } } },
      });
    } else {
      foreman = await prisma.foreman.findUnique({
        where: { id: directForemanId },
        select: { id: true, user: { select: { name: true } } },
      });
    }

    if (!foreman) {
      return NextResponse.json(
        { error: "Foreman not found" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    // Check for existing active assignment
    const existing = await prisma.foremanSiteAssignment.findFirst({
      where: {
        siteId,
        foremanId: foreman.id,
        endsOn: null,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Foreman already assigned to this site" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    // Create foreman site assignment AND link foreman to all active supervisors at this site
    const assignment = await prisma.$transaction(async (tx) => {
      // 1. Create the site assignment
      const newAssignment = await tx.foremanSiteAssignment.create({
        data: {
          siteId,
          foremanId: foreman.id,
          startsOn: startDate ? new Date(startDate) : new Date(),
          endsOn: null,
        },
        include: {
          foreman: {
            select: { id: true, user: { select: { name: true } } },
          },
        },
      });

      // 2. Link foreman to each active supervisor at this site (if not already linked)
      for (const { supervisorId } of activeSupervisorAssignments) {
        const existingLink = await tx.supervisorForeman.findFirst({
          where: {
            supervisorId,
            foremanId: foreman.id,
            endsOn: null,
          },
        });

        if (!existingLink) {
          await tx.supervisorForeman.create({
            data: {
              supervisorId,
              foremanId: foreman.id,
              startsOn: new Date(),
              endsOn: null,
            },
          });
        }
      }

      return newAssignment;
    });

    return NextResponse.json(
      {
        ok: true,
        assignment: {
          id: assignment.id,
          foremanId: assignment.foremanId,
          name: assignment.foreman.user.name,
          startDate: assignment.startsOn.toISOString(),
          endDate: null,
        },
      },
      { status: 201, headers: CORS_HEADERS },
    );
  } catch (e: any) {
    console.error("Error assigning foreman:", e);
    return NextResponse.json(
      { error: "Failed to assign foreman" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
