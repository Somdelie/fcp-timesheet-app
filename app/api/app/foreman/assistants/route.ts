import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

async function getForeman(req: Request) {
  const token = getBearer(req);
  let userId: string | null = null;
  let role: string | null = null;

  if (token) {
    const payload = await verifyApiToken(token);
    if (!payload) return null;
    userId = payload.sub;
    role = payload.role;
  } else {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    userId = user?.id ?? null;
    role = user?.role ?? null;
  }

  if (!userId || role !== "FOREMAN") return null;

  return await prisma.foreman.findUnique({
    where: { userId },
    select: { id: true },
  });
}

// GET: List current assistants for this foreman
export async function GET(req: Request) {
  const foreman = await getForeman(req);
  if (!foreman) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const assistants = await prisma.foremanAssistant.findMany({
    where: {
      foremanId: foreman.id,
      endsOn: null, // Only active assistants
    },
    select: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          qrCodeValue: true,
        },
      },
      startsOn: true,
    },
    orderBy: { employee: { firstName: "asc" } },
  });

  return NextResponse.json({ assistants });
}

// POST: Add a new assistant
export async function POST(req: Request) {
  const foreman = await getForeman(req);
  if (!foreman) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { employeeId } = await req.json();

    if (!employeeId) {
      return NextResponse.json(
        { error: "employeeId is required" },
        { status: 400 },
      );
    }

    // Verify employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    // Check if already an assistant (active or past)
    const existing = await prisma.foremanAssistant.findUnique({
      where: { foremanId_employeeId: { foremanId: foreman.id, employeeId } },
    });

    if (existing) {
      if (!existing.endsOn) {
        return NextResponse.json(
          { error: "Already an active assistant" },
          { status: 400 },
        );
      }
      // Reactivate if it was ended
      const updated = await prisma.foremanAssistant.update({
        where: { foremanId_employeeId: { foremanId: foreman.id, employeeId } },
        data: { endsOn: null },
      });
      return NextResponse.json({ assistant: updated });
    }

    // Create new assistant link
    const assistant = await prisma.foremanAssistant.create({
      data: {
        foremanId: foreman.id,
        employeeId,
        startsOn: new Date(),
      },
      select: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            qrCodeValue: true,
          },
        },
        startsOn: true,
      },
    });

    return NextResponse.json({ assistant });
  } catch (error: any) {
    console.error("POST /api/app/foreman/assistants", error);
    return NextResponse.json(
      { error: error.message || "Failed to add assistant" },
      { status: 500 },
    );
  }
}
