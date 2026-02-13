import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { parseWorkDate } from "@/lib/workdate";
import { notifyForemenSiteDayPhotoRequested } from "@/lib/notifySitePhotoRequest";
import { sendExpoPush } from "@/lib/expoPush";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAdminFromRequest(req: Request) {
  // 1) Try mobile/API Bearer token
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (token) {
    const payload = await verifyApiToken(token);
    if (payload && payload.role === "ADMIN") {
      return { id: payload.sub as string, role: "ADMIN" as const };
    }
  }

  // 2) Fallback to NextAuth web session (web admin)
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;

  if (session?.user && role === "ADMIN") {
    return { id: (session.user as any).id as string, role: "ADMIN" as const };
  }

  return null;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: siteId } = await ctx.params;

  const url = new URL(req.url);
  const dateISO =
    String(url.searchParams.get("dateISO") ?? "") ||
    String(url.searchParams.get("workDateISO") ?? "");

  if (!dateISO) {
    return NextResponse.json(
      { error: "dateISO (YYYY-MM-DD) is required" },
      { status: 400 },
    );
  }

  const workDate = parseWorkDate(dateISO);
  if (!workDate) {
    return NextResponse.json(
      { error: "Invalid dateISO. Use format YYYY-MM-DD." },
      { status: 400 },
    );
  }

  const siteDays = await prisma.siteDay.findMany({
    where: { siteId, workDate },
    select: { id: true },
  });

  if (siteDays.length === 0) {
    return NextResponse.json({ ok: true, requests: [] });
  }

  const siteDayIds = siteDays.map((s) => s.id);

  const requests = await prisma.siteDayPhotoRequest.findMany({
    where: { siteDayId: { in: siteDayIds } },
    select: {
      id: true,
      siteDayId: true,
      status: true,
      requestedAt: true,
      dueAt: true,
      note: true,
      requestedByUser: { select: { id: true, name: true, email: true } },
      siteDayPhotos: { select: { id: true } },
    },
    orderBy: { requestedAt: "desc" },
  });

  const now = new Date();

  const foremanAssignments = await prisma.foremanSiteAssignment.findMany({
    where: {
      siteId,
      startsOn: { lte: workDate },
      OR: [{ endsOn: null }, { endsOn: { gte: workDate } }],
    },
    select: {
      foremanId: true,
      foreman: {
        select: { user: { select: { id: true, name: true, email: true } } },
      },
      startsOn: true,
      endsOn: true,
    },
    orderBy: [{ startsOn: "desc" }],
  });

  const supervisorAssignments = await prisma.supervisorSiteAssignment.findMany({
    where: {
      siteId,
      startsOn: { lte: workDate },
      OR: [{ endsOn: null }, { endsOn: { gte: workDate } }],
    },
    select: {
      supervisor: {
        select: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      startsOn: true,
      endsOn: true,
    },
    orderBy: [{ startsOn: "desc" }],
  });

  console.log("[admin.site-photo-requests] assignments", {
    siteId,
    dateISO,
    workDate: workDate.toISOString(),
    foremanAssignmentsCount: foremanAssignments.length,
    supervisorAssignmentsCount: supervisorAssignments.length,
    foremanAssignments,
    supervisorAssignments,
  });

  return NextResponse.json({
    ok: true,
    requests: requests.map((r) => ({
      id: r.id,
      siteDayId: r.siteDayId,
      status: r.status,
      requestedAt: r.requestedAt.toISOString(),
      dueAt: r.dueAt ? r.dueAt.toISOString() : null,
      note: r.note ?? null,
      requestedBy: r.requestedByUser
        ? {
            id: r.requestedByUser.id,
            name: r.requestedByUser.name ?? r.requestedByUser.email ?? "User",
          }
        : null,
      photoCount: r.siteDayPhotos.length,
    })),
    foremen: foremanAssignments.map((a) => ({
      foremanId: a.foremanId,
      userId: a.foreman.user.id,
      name: a.foreman.user.name ?? a.foreman.user.email ?? "Foreman",
      email: a.foreman.user.email ?? null,
      startsOn: a.startsOn.toISOString(),
      endsOn: a.endsOn ? a.endsOn.toISOString() : null,
    })),
    supervisors: supervisorAssignments.map((a) => ({
      userId: a.supervisor.user.id,
      name: a.supervisor.user.name ?? a.supervisor.user.email ?? "Supervisor",
      email: a.supervisor.user.email ?? null,
      startsOn: a.startsOn.toISOString(),
      endsOn: a.endsOn ? a.endsOn.toISOString() : null,
    })),
  });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: siteId } = await ctx.params;

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const workDateStr = String(body?.workDate ?? "").trim();
  const note = String(body?.note ?? "").trim() || null;
  const dueDateStr = String(body?.dueDate ?? "").trim();

  if (!workDateStr) {
    return NextResponse.json(
      { error: "workDate is required (YYYY-MM-DD)." },
      { status: 400 },
    );
  }

  const workDate = parseWorkDate(workDateStr);
  if (!workDate) {
    return NextResponse.json(
      { error: "Invalid workDate. Use format YYYY-MM-DD." },
      { status: 400 },
    );
  }

  const dueAt = dueDateStr ? new Date(`${dueDateStr}T17:00:00.000Z`) : null;

  try {
    // Find all foremen assigned to this site on that work date
    const assignments = await prisma.foremanSiteAssignment.findMany({
      where: {
        siteId,
        startsOn: { lte: workDate },
        OR: [{ endsOn: null }, { endsOn: { gte: workDate } }],
      },
      select: {
        foremanId: true,
        foreman: {
          select: {
            user: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (assignments.length === 0) {
      return NextResponse.json(
        {
          error: "No foreman assigned to this site on that day.",
        },
        { status: 400 },
      );
    }

    // Ensure SiteDay exists for each foreman on that date
    const siteDays = await Promise.all(
      assignments.map((a) =>
        prisma.siteDay
          .findFirst({
            where: { siteId, foremanId: a.foremanId, workDate },
            select: { id: true },
          })
          .then((existing) =>
            existing
              ? existing
              : prisma.siteDay.create({
                  data: {
                    siteId,
                    foremanId: a.foremanId,
                    workDate,
                  },
                  select: { id: true },
                }),
          ),
      ),
    );

    // Create photo requests for each SiteDay
    const created = await Promise.all(
      siteDays.map((sd) =>
        prisma.siteDayPhotoRequest.create({
          data: {
            siteDayId: sd.id,
            requestedByUserId: admin.id,
            note,
            dueAt,
          },
          select: { id: true, siteDayId: true },
        }),
      ),
    );

    // Best-effort WhatsApp notification (free text; may fail outside 24h window)
    try {
      await notifyForemenSiteDayPhotoRequested({
        siteId,
        dateISO: workDateStr,
        note,
      });
    } catch (e) {
      console.error("Photo-request WhatsApp notify error:", e);
    }

    // Best-effort Expo push notifications to assigned foremen and assistants
    try {
      // Map foreman user IDs
      const foremanUserIds = new Set(
        assignments
          .map((a) => a.foreman.user?.id)
          .filter((id): id is string => Boolean(id)),
      );

      const foremanIds = assignments.map((a) => a.foremanId);

      // Assistants linked to these foremen, active on this date
      const assistantLinks = await prisma.foremanAssistant.findMany({
        where: {
          foremanId: { in: foremanIds },
          startsOn: { lte: workDate },
          OR: [{ endsOn: null }, { endsOn: { gte: workDate } }],
        },
        select: {
          foremanId: true,
          employee: {
            select: { userId: true },
          },
        },
      });

      const assistantsByForeman = new Map<string, string[]>();
      const assistantUserIds = new Set<string>();

      for (const link of assistantLinks) {
        const userId = link.employee.userId;
        if (!userId) continue;
        assistantUserIds.add(userId);

        const arr = assistantsByForeman.get(link.foremanId) ?? [];
        arr.push(userId);
        assistantsByForeman.set(link.foremanId, arr);
      }

      const userIds = Array.from(
        new Set<string>([...foremanUserIds, ...assistantUserIds]),
      );

      if (userIds.length > 0) {
        const [site, pushTokens] = await Promise.all([
          prisma.site.findUnique({
            where: { id: siteId },
            select: { name: true, code: true },
          }),
          prisma.pushToken.findMany({
            where: { userId: { in: userIds } },
            select: { token: true, userId: true },
          }),
        ]);

        const siteLabel = site?.code
          ? `${site.code} • ${site.name}`
          : (site?.name ?? "Site");

        const tokensByUser = new Map<string, string[]>();
        for (const pt of pushTokens) {
          const arr = tokensByUser.get(pt.userId) ?? [];
          arr.push(pt.token);
          tokensByUser.set(pt.userId, arr);
        }

        // created[i] corresponds to assignments[i]
        await Promise.all(
          created.map(async (reqRow, index) => {
            const foremanUserId = assignments[index]?.foreman.user?.id;
            if (!foremanUserId) return;

            const tokensForForeman = tokensByUser.get(foremanUserId) ?? [];

            const assistantUserIdsForForeman =
              assistantsByForeman.get(assignments[index].foremanId) ?? [];

            const tokensForAssistants = assistantUserIdsForForeman.flatMap(
              (uid) => tokensByUser.get(uid) ?? [],
            );

            const tokens = [...tokensForForeman, ...tokensForAssistants];
            if (tokens.length === 0) return;

            const title = "Site day photo requested";
            const body = `Site: ${siteLabel} • Date: ${workDateStr}`;
            const data = {
              type: "PHOTO_REQUEST" as const,
              requestId: reqRow.id,
              siteId,
              dateISO: workDateStr,
            };

            await sendExpoPush(tokens, { title, body, data });
          }),
        );
      }
    } catch (e) {
      console.error("Photo-request Expo push notify error:", e);
    }

    return NextResponse.json({
      ok: true,
      count: created.length,
      requests: created,
    });
  } catch (e: any) {
    console.error("Error creating photo requests:", e);
    return NextResponse.json(
      { error: "Failed to create photo requests" },
      { status: 500 },
    );
  }
}
