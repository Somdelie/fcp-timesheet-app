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
    const foremen = await prisma.user.findMany({
      where: { role: "FOREMAN" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        foreman: {
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
      foremen: foremen.map((f) => ({
        id: f.id,
        email: f.email,
        name: f.name,
        role: f.role,
        createdAt: f.createdAt.toISOString(),
        foreman: f.foreman,
      })),
    });
  } catch (e: any) {
    console.error("Error fetching foremen:", e);
    return NextResponse.json(
      { error: "Failed to fetch foremen" },
      { status: 500 },
    );
  }
}
