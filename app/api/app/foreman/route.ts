import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";

// get all foremen
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

export async function GET(req: Request) {
  const token = getBearer(req);
  if (!token)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await verifyApiToken(token);
  if (!payload)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ✅ supervisors (and admin if you want) can fetch all foremen
  if (payload.role !== "SUPERVISOR" && payload.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Return FOREMAN users (User table), plus foremanId (Foreman table)
  // Filter to only include users with role FOREMAN and exclude those who are also assistants
  const foremen = await prisma.foreman.findMany({
    where: {
      user: {
        role: "FOREMAN",
        // Exclude users who have an employee with assistantLinks
        NOT: {
          employee: {
            assistantLinks: { some: {} },
          },
        },
      },
    },
    select: {
      id: true, // Foreman.id
      userId: true, // User.id
      user: { select: { name: true, email: true, role: true } },
    },
    orderBy: { user: { name: "asc" } },
  });

  return NextResponse.json({
    ok: true,
    foremen: foremen.map((f) => ({
      foremanId: f.id,
      userId: f.userId,
      name: f.user.name ?? f.user.email ?? "Foreman",
      email: f.user.email,
    })),
  });
}
