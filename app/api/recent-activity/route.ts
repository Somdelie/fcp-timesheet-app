import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireServerAuth } from "@/lib/auth-server";
import { verifyApiToken } from "@/lib/jwt";
import { logApiRequest } from "@/lib/apiRequestLogger";

export const runtime = "nodejs";
export const revalidate = 60;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

type RecentActivityKind =
  | "TIMESHEET_SUBMITTED"
  | "TIMESHEET_APPROVED"
  | "TIMESHEET_REJECTED"
  | "TIMESHEET_PAID"
  | "EMPLOYEE_CREATED"
  | "SITE_CREATED"
  | "PHOTO_VERIFIED"
  | "PHOTO_FLAGGED"
  | "MANUAL_SCAN";

export type RecentActivityItem = {
  id: string;
  kind: RecentActivityKind;
  title: string;
  description: string;
  at: string; // ISO
  href?: string | null;
};

function defaultTitle(kind: RecentActivityKind) {
  switch (kind) {
    case "TIMESHEET_SUBMITTED":
      return "Timesheet submitted";
    case "TIMESHEET_APPROVED":
      return "Timesheet approved";
    case "TIMESHEET_REJECTED":
      return "Timesheet rejected";
    case "TIMESHEET_PAID":
      return "Timesheet marked as paid";
    case "EMPLOYEE_CREATED":
      return "New employee added";
    case "SITE_CREATED":
      return "New site created";
    case "PHOTO_VERIFIED":
      return "Photo verification completed";
    case "PHOTO_FLAGGED":
      return "Photo flagged for review";
    case "MANUAL_SCAN":
      return "Manual scan created";
    default:
      return "Recent activity";
  }
}

function clampLimit(raw: string | null) {
  const n = Number(raw ?? "10");
  if (!Number.isFinite(n)) return 10;
  return Math.max(1, Math.min(50, Math.floor(n)));
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

async function getAuthFromRequest(
  req: Request,
): Promise<{ userId: string; role: string } | null> {
  // First try Bearer token (for Electron/API clients)
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const payload = await verifyApiToken(token);
      if (payload) {
        return { userId: payload.sub, role: payload.role };
      }
    } catch {
      // Fall through to session auth
    }
  }

  // Fall back to session auth (for web dashboard)
  try {
    const sessionAuth = await requireServerAuth();
    return sessionAuth;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const auth = await getAuthFromRequest(req);
  if (!auth) {
    const res = NextResponse.json(
      { error: "Unauthorized" },
      {
        status: 401,
        headers: {
          ...corsHeaders,
          "Cache-Control": "private, max-age=30",
        },
      },
    );
    logApiRequest("/api/recent-activity", req.method, res.status);
    return res;
  }

  // This endpoint is used by the web dashboard.
  if (auth.role === "FOREMAN") {
    const res = NextResponse.json(
      { error: "Forbidden" },
      {
        status: 403,
        headers: {
          ...corsHeaders,
          "Cache-Control": "private, max-age=30",
        },
      },
    );
    logApiRequest("/api/recent-activity", req.method, res.status);
    return res;
  }

  const url = new URL(req.url);
  const limit = clampLimit(url.searchParams.get("limit"));

  // Supervisor scoping (optional): only include activity tied to supervisor sites where possible.
  let supervisorSiteIds: string[] | null = null;
  if (auth.role === "SUPERVISOR") {
    const supervisor = await prisma.supervisor.findUnique({
      where: { userId: auth.userId },
      select: {
        siteAssignments: {
          where: {
            OR: [{ endsOn: null }, { endsOn: { gt: new Date() } }],
          },
          select: { siteId: true },
        },
      },
    });
    supervisorSiteIds = supervisor?.siteAssignments.map((a) => a.siteId) ?? [];
  }

  // --- Prefer true audit trail (AuditEvent) ---
  const allowedAuditActions: RecentActivityKind[] =
    auth.role === "SUPERVISOR"
      ? [
          "TIMESHEET_SUBMITTED",
          "TIMESHEET_APPROVED",
          "TIMESHEET_REJECTED",
          "TIMESHEET_PAID",
          "PHOTO_VERIFIED",
          "PHOTO_FLAGGED",
        ]
      : [
          "TIMESHEET_SUBMITTED",
          "TIMESHEET_APPROVED",
          "TIMESHEET_REJECTED",
          "TIMESHEET_PAID",
          "EMPLOYEE_CREATED",
          "SITE_CREATED",
          "PHOTO_VERIFIED",
          "PHOTO_FLAGGED",
          "MANUAL_SCAN",
        ];

  const auditEvents = await prisma.auditEvent.findMany({
    where: { action: { in: allowedAuditActions } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      action: true,
      metadata: true,
      createdAt: true,
      actorUserId: true,
    },
  });

  const scopedAuditEvents =
    auth.role === "SUPERVISOR"
      ? auditEvents.filter((e) => {
          const md = (e.metadata ?? {}) as any;
          const siteId = md?.siteId ? String(md.siteId) : null;
          if (siteId && supervisorSiteIds && supervisorSiteIds.includes(siteId))
            return true;
          // Always include actions the supervisor performed
          return e.actorUserId === auth.userId;
        })
      : auditEvents;

  const auditItems: RecentActivityItem[] = scopedAuditEvents
    .map((e) => {
      const kind = e.action as RecentActivityKind;
      if (!allowedAuditActions.includes(kind)) return null;

      const md = (e.metadata ?? {}) as any;

      const title = String(md.title ?? defaultTitle(kind));
      const description = String(md.description ?? "");

      let href: string | null | undefined = md.href ?? null;
      if (!href) {
        if (kind === "EMPLOYEE_CREATED" && md.employeeId)
          href = `/employees/${encodeURIComponent(String(md.employeeId))}`;
        else if (kind === "SITE_CREATED" && md.siteId)
          href = `/sites/${encodeURIComponent(String(md.siteId))}`;
        else if (
          (kind === "PHOTO_VERIFIED" || kind === "PHOTO_FLAGGED") &&
          md.siteId
        )
          href = `/sites/${encodeURIComponent(String(md.siteId))}`;
        else if (kind === "MANUAL_SCAN") href = "/admin/attendance-scans";
        else if (kind.startsWith("TIMESHEET_"))
          href =
            auth.role === "SUPERVISOR"
              ? "/supervisor/timesheets"
              : "/timesheets";
      }

      return {
        id: `audit:${e.id}`,
        kind,
        title,
        description: description || title,
        at: e.createdAt.toISOString(),
        href,
      } satisfies RecentActivityItem;
    })
    .filter(Boolean) as RecentActivityItem[];

  const hasAnyAudit = auditItems.length > 0;
  const hasPhotoAudit = auditItems.some(
    (x) => x.kind === "PHOTO_VERIFIED" || x.kind === "PHOTO_FLAGGED",
  );

  const [employees, sites, timesheets, verifications] = await Promise.all([
    !hasAnyAudit && auth.role === "ADMIN"
      ? prisma.employee.findMany({
          orderBy: { createdAt: "desc" },
          take: Math.min(20, limit * 2),
          select: {
            id: true,
            firstName: true,
            lastName: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),

    !hasAnyAudit && auth.role === "ADMIN"
      ? prisma.site.findMany({
          orderBy: { createdAt: "desc" },
          take: Math.min(10, limit),
          select: { id: true, name: true, createdAt: true },
        })
      : Promise.resolve([]),

    !hasAnyAudit
      ? prisma.timesheet.findMany({
          where:
            auth.role === "SUPERVISOR"
              ? {
                  approvedBySupervisor: { userId: auth.userId },
                }
              : undefined,
          orderBy: { updatedAt: "desc" },
          take: Math.min(20, limit * 2),
          select: {
            id: true,
            status: true,
            submittedAt: true,
            approvedAt: true,
            rejectedAt: true,
            paidAt: true,
            updatedAt: true,
            foremanId: true,
            foreman: { select: { user: { select: { name: true } } } },
            period: { select: { startDate: true, endDate: true } },
          },
        })
      : Promise.resolve([]),

    !hasPhotoAudit
      ? prisma.photoVerification.findMany({
          where: {
            verifiedAt: { not: null },
            status: { in: ["VERIFIED", "FLAGGED"] },
            ...(supervisorSiteIds
              ? {
                  photo: {
                    siteDay: {
                      siteId: { in: supervisorSiteIds },
                    },
                  },
                }
              : {}),
          },
          orderBy: { verifiedAt: "desc" },
          take: 50,
          select: {
            id: true,
            status: true,
            verifiedAt: true,
            photo: {
              select: {
                siteDay: {
                  select: {
                    id: true,
                    site: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const derivedItems: RecentActivityItem[] = [];

  for (const e of employees) {
    const fullName = `${e.firstName} ${e.lastName}`.trim();
    derivedItems.push({
      id: `employee:${e.id}`,
      kind: "EMPLOYEE_CREATED",
      title: "New employee added",
      description: `${fullName} - QR code generated`,
      at: e.createdAt.toISOString(),
      href: `/employees/${encodeURIComponent(e.id)}`,
    });
  }

  for (const s of sites) {
    derivedItems.push({
      id: `site:${s.id}`,
      kind: "SITE_CREATED",
      title: "New site created",
      description: s.name,
      at: s.createdAt.toISOString(),
      href: `/sites/${encodeURIComponent(s.id)}`,
    });
  }

  // Timesheet events (best-effort).
  // Note: Timesheets are per foreman+period. We infer a "primary" site by selecting the latest SiteDay in the period.
  const siteNameCache = new Map<string, string | null>();
  for (const t of timesheets) {
    const status = String(t.status);
    let kind: RecentActivityKind | null = null;
    let title: string | null = null;
    let at: Date | null = null;

    if (status === "APPROVED") {
      kind = "TIMESHEET_APPROVED";
      title = "Timesheet approved";
      at = t.approvedAt ?? t.updatedAt;
    } else if (status === "SUBMITTED") {
      kind = "TIMESHEET_SUBMITTED";
      title = "Timesheet submitted";
      at = t.submittedAt ?? t.updatedAt;
    } else if (status === "REJECTED") {
      kind = "TIMESHEET_REJECTED";
      title = "Timesheet rejected";
      at = t.rejectedAt ?? t.updatedAt;
    } else if (status === "PAID") {
      kind = "TIMESHEET_PAID";
      title = "Timesheet marked as paid";
      at = t.paidAt ?? t.updatedAt;
    }

    if (!kind || !title || !at) continue;

    const foremanName = t.foreman?.user?.name?.trim() || "Foreman";

    const cacheKey = `${t.foremanId}:${t.period.startDate.toISOString()}:${t.period.endDate.toISOString()}`;
    let siteName = siteNameCache.get(cacheKey) ?? null;
    if (!siteNameCache.has(cacheKey)) {
      const endExclusive = addDays(t.period.endDate, 1);
      const siteDay = await prisma.siteDay.findFirst({
        where: {
          foremanId: t.foremanId,
          workDate: { gte: t.period.startDate, lt: endExclusive },
        },
        orderBy: { workDate: "desc" },
        select: { site: { select: { name: true } } },
      });
      siteName = siteDay?.site?.name ?? null;
      siteNameCache.set(cacheKey, siteName);
    }

    derivedItems.push({
      id: `timesheet:${t.id}:${kind}`,
      kind,
      title,
      description: siteName ? `${siteName} - ${foremanName}` : foremanName,
      at: at.toISOString(),
      href: "/timesheets",
    });
  }

  // Photo verification activity, aggregated per SiteDay+status
  type Group = {
    status: "VERIFIED" | "FLAGGED";
    siteDayId: string;
    siteId: string;
    siteName: string;
    count: number;
    latestAt: Date;
  };

  const groups = new Map<string, Group>();
  for (const v of verifications) {
    const verifiedAt = v.verifiedAt ?? null;
    const sd = v.photo?.siteDay;
    const site = sd?.site;
    if (!verifiedAt || !sd?.id || !site?.id) continue;

    const status = v.status as "VERIFIED" | "FLAGGED";
    const key = `${status}:${sd.id}`;
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        status,
        siteDayId: sd.id,
        siteId: site.id,
        siteName: site.name,
        count: 1,
        latestAt: verifiedAt,
      });
      continue;
    }

    existing.count += 1;
    if (verifiedAt > existing.latestAt) existing.latestAt = verifiedAt;
  }

  for (const g of groups.values()) {
    if (g.status === "VERIFIED") {
      derivedItems.push({
        id: `photo:${g.siteDayId}:verified`,
        kind: "PHOTO_VERIFIED",
        title: "Photo verification completed",
        description: `${g.siteName} - ${g.count} photo${g.count === 1 ? "" : "s"} verified`,
        at: g.latestAt.toISOString(),
        href: `/sites/${encodeURIComponent(g.siteId)}`,
      });
    } else {
      derivedItems.push({
        id: `photo:${g.siteDayId}:flagged`,
        kind: "PHOTO_FLAGGED",
        title: "Photo flagged for review",
        description: `${g.siteName} - ${g.count} photo${g.count === 1 ? "" : "s"} flagged`,
        at: g.latestAt.toISOString(),
        href: `/sites/${encodeURIComponent(g.siteId)}`,
      });
    }
  }

  const items = [...auditItems, ...derivedItems];

  const deduped = new Map<string, RecentActivityItem>();
  for (const it of items) {
    // Prefer the most recent if duplicated keys sneak in
    const prev = deduped.get(it.id);
    if (!prev || String(it.at).localeCompare(String(prev.at)) > 0) {
      deduped.set(it.id, it);
    }
  }

  const out = Array.from(deduped.values())
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, limit);

  const res = NextResponse.json(
    { items: out },
    {
      headers: {
        ...corsHeaders,
        // User-scoped; cache briefly in the browser only.
        "Cache-Control": "private, max-age=30",
      },
    },
  );
  logApiRequest("/api/recent-activity", req.method, res.status);
  return res;
}
