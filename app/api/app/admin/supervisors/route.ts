import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (user?.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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

    return NextResponse.json({
      ok: true,
      supervisors: supervisors.map((s) => ({
        id: s.id,
        email: s.email,
        name: s.name,
        role: s.role,
        createdAt: s.createdAt.toISOString(),
        supervisor: s.supervisor,
      })),
    });
  } catch (e: any) {
    console.error("Error fetching supervisors:", e);
    return NextResponse.json(
      { error: "Failed to fetch supervisors" },
      { status: 500 },
    );
  }
}
