import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAdminFromRequest(req: Request) {
  // 1) Try mobile API token (Bearer JWT)
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (token) {
    const payload = await verifyApiToken(token);
    if (payload && payload.role === "ADMIN") {
      return { id: payload.sub, role: "ADMIN" as const };
    }
  }

  // 2) Fallback to NextAuth session (web admin)
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;

  if (session?.user && role === "ADMIN") {
    return { id: (session.user as any).id as string, role: "ADMIN" as const };
  }

  return null;
}

export async function GET(req: Request) {
  try {
    const admin = await getAdminFromRequest(req);

    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [totalEmployees, activeSites, totalForemen, totalSupervisors] =
      await Promise.all([
        prisma.employee.count({ where: { isActive: true } }),
        prisma.site.count({ where: { isActive: true } }),
        prisma.foreman.count(),
        prisma.supervisor.count(),
      ]);

    return NextResponse.json({
      totalEmployees,
      activeSites,
      totalForemen,
      totalSupervisors,
    });
  } catch (error: any) {
    console.error("Error fetching admin dashboard metrics:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
