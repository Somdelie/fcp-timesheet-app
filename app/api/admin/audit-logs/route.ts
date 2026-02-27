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
    Math.max(1, Number(url.searchParams.get("limit") || "20")),
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

  const [logs, total, actions, recentLogins] = await Promise.all([
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
    // Last 10 web logins (LOGIN + APP_OPEN)
    prisma.auditEvent.findMany({
      where: { action: { in: ["LOGIN", "APP_OPEN"] } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        action: true,
        createdAt: true,
        actor: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    }),
  ]);

  // Collect IDs from metadata/entityId to resolve names
  const siteIds = new Set<string>();
  const employeeIds = new Set<string>();
  const foremanIds = new Set<string>();

  for (const log of logs) {
    const meta = log.metadata as Record<string, any> | null;
    if (meta?.siteId) siteIds.add(meta.siteId);
    if (meta?.employeeId) employeeIds.add(meta.employeeId);
    if (meta?.foremanId) foremanIds.add(meta.foremanId);
    // Also resolve entity references
    if (log.entity === "Site" && log.entityId) siteIds.add(log.entityId);
    if (log.entity === "Employee" && log.entityId)
      employeeIds.add(log.entityId);
    if (log.entity === "Foreman" && log.entityId) foremanIds.add(log.entityId);
  }

  const [siteMap, employeeMap, foremanMap] = await Promise.all([
    siteIds.size > 0
      ? prisma.site
          .findMany({
            where: { id: { in: [...siteIds] } },
            select: { id: true, name: true },
          })
          .then((rows) => new Map(rows.map((r) => [r.id, r.name])))
      : Promise.resolve(new Map<string, string>()),
    employeeIds.size > 0
      ? prisma.employee
          .findMany({
            where: { id: { in: [...employeeIds] } },
            select: { id: true, firstName: true, lastName: true },
          })
          .then(
            (rows) =>
              new Map(
                rows.map((r) => [r.id, `${r.firstName} ${r.lastName}`.trim()]),
              ),
          )
      : Promise.resolve(new Map<string, string>()),
    foremanIds.size > 0
      ? prisma.foreman
          .findMany({
            where: { id: { in: [...foremanIds] } },
            select: { id: true, user: { select: { name: true } } },
          })
          .then(
            (rows) =>
              new Map(rows.map((r) => [r.id, r.user.name ?? "Foreman"])),
          )
      : Promise.resolve(new Map<string, string>()),
  ]);

  const enrichedLogs = logs.map((log) => {
    const meta = log.metadata as Record<string, any> | null;
    const enrichedMeta = meta ? { ...meta } : null;
    if (enrichedMeta?.siteId && siteMap.has(enrichedMeta.siteId)) {
      enrichedMeta.siteName = siteMap.get(enrichedMeta.siteId);
    }
    if (enrichedMeta?.employeeId && employeeMap.has(enrichedMeta.employeeId)) {
      enrichedMeta.employeeName = employeeMap.get(enrichedMeta.employeeId);
    }
    if (enrichedMeta?.foremanId && foremanMap.has(enrichedMeta.foremanId)) {
      enrichedMeta.foremanName = foremanMap.get(enrichedMeta.foremanId);
    }

    let entityName: string | undefined;
    if (log.entity === "Site" && log.entityId)
      entityName = siteMap.get(log.entityId);
    if (log.entity === "Employee" && log.entityId)
      entityName = employeeMap.get(log.entityId);
    if (log.entity === "Foreman" && log.entityId)
      entityName = foremanMap.get(log.entityId);

    return {
      ...log,
      metadata: enrichedMeta,
      entityName: entityName ?? null,
    };
  });

  const res = NextResponse.json({
    logs: enrichedLogs,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    actions: actions.map((a) => a.action),
    recentLogins,
  });
  logApiRequest("/api/admin/audit-logs", req.method, res.status);
  return res;
}
