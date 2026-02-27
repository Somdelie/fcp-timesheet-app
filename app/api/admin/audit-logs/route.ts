import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireServerAuth } from "@/lib/auth-server";
import { logApiRequest } from "@/lib/apiRequestLogger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireServerAuth();
  if (auth.role !== "ADMIN") {
    const res = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    logApiRequest("/api/admin/audit-logs", req.method, res.status);
    return res;
  }

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("limit") || "50")),
  );
  const search = url.searchParams.get("search")?.trim() || "";
  const actionFilter = url.searchParams.get("action")?.trim() || "";

  const where: any = {};
  if (search) {
    where.OR = [
      { entity: { contains: search, mode: "insensitive" } },
      { action: { contains: search, mode: "insensitive" } },
      { actor: { name: { contains: search, mode: "insensitive" } } },
      { actor: { email: { contains: search, mode: "insensitive" } } },
    ];
  }
  if (actionFilter) {
    where.action = actionFilter;
  }

  const [logs, total, actions] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        metadata: true,
        createdAt: true,
        actor: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    }),
    prisma.auditEvent.count({ where }),
    // Distinct actions for filter dropdown
    prisma.auditEvent.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
  ]);

  const res = NextResponse.json({
    logs,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    actions: actions.map((a) => a.action),
  });
  logApiRequest("/api/admin/audit-logs", req.method, res.status);
  return res;
}
