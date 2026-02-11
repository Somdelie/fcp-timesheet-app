// actions/sites.ts
"use server";

import { prisma } from "@/lib/prisma";
import { requireServerAuth } from "@/lib/auth-server";
import { siteWhereFor } from "@/lib/site-scope";
import { parseWorkDate, toISODate } from "@/lib/workdate";
import { requireCanManageSite } from "@/lib/guards";
import { revalidatePath } from "next/cache";

function clean(v: unknown) {
  return String(v ?? "").trim();
}

function serializeSite(s: any) {
  return {
    id: s.id,
    name: s.name,
    code: s.code,
    location: s.location,
    isActive: s.isActive,
    createdAt:
      s.createdAt instanceof Date
        ? s.createdAt.toISOString()
        : String(s.createdAt),
  };
}

function serializeSiteDay(sd: any) {
  return {
    id: sd.id,
    siteId: sd.siteId,
    foremanId: sd.foremanId,
    workDate:
      sd.workDate instanceof Date
        ? toISODate(sd.workDate)
        : String(sd.workDate),
    isLocked: !!sd.isLocked,
    createdAt:
      sd.createdAt instanceof Date
        ? sd.createdAt.toISOString()
        : String(sd.createdAt),
    foremanName: sd.foremanName ?? null,
  };
}

export async function listSites(input?: {
  q?: string;
  show?: "active" | "all";
  take?: number;
}) {
  const auth = await requireServerAuth();
  const scope = siteWhereFor(auth);

  const q = clean(input?.q);
  const onlyActive = (input?.show ?? "active") !== "all";
  const take = Math.min(Math.max(input?.take ?? 200, 1), 500);

  const sites = await prisma.site.findMany({
    where: {
      ...scope,
      ...(onlyActive ? { isActive: true } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { code: { contains: q, mode: "insensitive" } },
              { location: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      name: true,
      code: true,
      location: true,
      isActive: true,
      createdAt: true,
    },
  });

  return { ok: true as const, sites: sites.map(serializeSite) };
}

export type SiteRow =
  Awaited<ReturnType<typeof listSites>> extends { sites: (infer T)[] }
    ? T
    : never;

export async function createSite(input: {
  name: string;
  code?: string | null;
  location?: string | null;
  isActive?: boolean;
}) {
  const auth = await requireServerAuth();
  if (auth.role !== "ADMIN") {
    return { ok: false as const, error: "Only admin can create sites." };
  }

  const name = clean(input.name);
  const code = clean(input.code) || null;
  const location = clean(input.location) || null;

  if (!name) return { ok: false as const, error: "Site name is required." };

  try {
    const site = await prisma.site.create({
      data: {
        name,
        code,
        location,
        isActive: input.isActive ?? true,
      },
      select: {
        id: true,
        name: true,
        code: true,
        location: true,
        isActive: true,
        createdAt: true,
      },
    });

    return {
      ok: true as const,
      site: { ...site, createdAt: site.createdAt.toISOString() },
    };
  } catch (e: any) {
    if (String(e?.code) === "P2002") {
      return { ok: false as const, error: "Site code must be unique." };
    }
    return { ok: false as const, error: "Failed to create site." };
  }
}

/**
 * Assign supervisor to a site (ADMIN only)
 */
export async function assignSupervisorToSite(input: {
  supervisorUserId: string; // user.id
  siteId: string;
}) {
  const auth = await requireServerAuth();
  if (auth.role !== "ADMIN") {
    return { ok: false as const, error: "Only admin can assign supervisors." };
  }

  const supervisorUserId = clean(input.supervisorUserId);
  const siteId = clean(input.siteId);

  const supervisor = await prisma.supervisor.findUnique({
    where: { userId: supervisorUserId },
    select: { id: true },
  });

  if (!supervisor) {
    return { ok: false as const, error: "Supervisor not found." };
  }

  // Close any active assignment first (optional hygiene)
  await prisma.supervisorSiteAssignment.updateMany({
    where: {
      supervisorId: supervisor.id,
      siteId,
      endsOn: null,
    },
    data: { endsOn: new Date() },
  });

  await prisma.supervisorSiteAssignment.create({
    data: {
      supervisorId: supervisor.id,
      siteId,
      startsOn: new Date(),
    },
  });

  return { ok: true as const };
}

export async function listSiteDays(input: {
  siteId: string;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
}) {
  const auth = await requireServerAuth();
  await requireCanManageSite(auth, input.siteId);

  const siteId = String(input.siteId);
  const from = input.from ? parseWorkDate(input.from) : null;
  const to = input.to ? parseWorkDate(input.to) : null;

  const where: any = { siteId };
  if (from && to) {
    // inclusive end day: add 1 day, use lt
    const toPlus = new Date(to.getTime() + 24 * 60 * 60 * 1000);
    where.workDate = { gte: from, lt: toPlus };
  }

  const rows = await prisma.siteDay.findMany({
    where,
    orderBy: { workDate: "desc" },
    select: {
      id: true,
      siteId: true,
      foremanId: true,
      workDate: true,
      isLocked: true,
      createdAt: true,
      foreman: { select: { user: { select: { name: true } } } },
    },
  });

  return {
    ok: true as const,
    siteDays: rows.map((r) =>
      serializeSiteDay({
        ...r,
        foremanName: r.foreman.user.name ?? "Foreman",
      }),
    ),
  };
}

export async function bookForemanForDay(input: {
  siteId: string;
  foremanId: string; // Foreman.id (not userId)
  workDate: string; // YYYY-MM-DD
}) {
  const auth = await requireServerAuth();
  await requireCanManageSite(auth, input.siteId);

  const siteId = String(input.siteId);
  const foremanId = String(input.foremanId);
  const workDate = parseWorkDate(input.workDate);
  if (!workDate)
    return { ok: false as const, error: "Invalid date. Use YYYY-MM-DD." };

  // Must be actively assigned to the site
  const assigned = await prisma.foremanSiteAssignment.findFirst({
    where: { siteId, foremanId, endsOn: null },
    select: { id: true },
  });
  if (!assigned)
    return {
      ok: false as const,
      error: "Foreman is not assigned to this site.",
    };

  try {
    const sd = await prisma.siteDay.create({
      data: {
        siteId,
        foremanId,
        workDate,
        isLocked: false,
      },
      select: {
        id: true,
        siteId: true,
        foremanId: true,
        workDate: true,
        isLocked: true,
        createdAt: true,
        foreman: { select: { user: { select: { name: true } } } },
      },
    });

    revalidatePath(`/sites/${siteId}`);
    return {
      ok: true as const,
      siteDay: serializeSiteDay({ ...sd, foremanName: sd.foreman.user.name }),
    };
  } catch (e: any) {
    // Prisma unique constraint
    if (String(e?.code) === "P2002") {
      const t = Array.isArray(e?.meta?.target)
        ? e.meta.target.join(",")
        : String(e?.meta?.target ?? "");
      if (t.includes("siteId") && t.includes("workDate")) {
        return {
          ok: false as const,
          error: "This site already has a booking for that day.",
        };
      }
      if (t.includes("foremanId") && t.includes("workDate")) {
        return {
          ok: false as const,
          error: "Foreman is already booked on that day (another site).",
        };
      }
      return {
        ok: false as const,
        error: "Booking violates a unique constraint.",
      };
    }
    return { ok: false as const, error: "Failed to book foreman." };
  }
}

/**
 * Create random group photo request(s) for a site on a given work date.
 *
 * - ADMIN and SUPERVISOR can call this (via requireCanManageSite).
 * - It finds all foremen assigned to the site on that date (based on
 *   ForemanSiteAssignment.startsOn/endsOn), ensures SiteDay rows exist
 *   for each, then creates SiteDayPhotoRequest records.
 */
export async function requestSiteGroupPhoto(input: {
  siteId: string;
  workDate: string; // YYYY-MM-DD
  note?: string;
  dueDate?: string; // optional YYYY-MM-DD for due-at date
}) {
  const auth = await requireServerAuth();

  const siteId = String(input.siteId ?? "").trim();
  if (!siteId) {
    return { ok: false as const, error: "Site is required." };
  }

  await requireCanManageSite(auth, siteId);

  const workDate = parseWorkDate(input.workDate);
  if (!workDate) {
    return {
      ok: false as const,
      error: "Invalid work date. Use format YYYY-MM-DD.",
    };
  }

  const note = String(input.note ?? "").trim() || null;
  const dueDate = String(input.dueDate ?? "").trim();
  const dueAt = dueDate ? new Date(`${dueDate}T17:00:00.000Z`) : null;

  // Find all foremen assigned to this site on that work date
  const assignments = await prisma.foremanSiteAssignment.findMany({
    where: {
      siteId,
      startsOn: { lte: workDate },
      OR: [{ endsOn: null }, { endsOn: { gte: workDate } }],
    },
    select: { foremanId: true },
  });

  if (assignments.length === 0) {
    return {
      ok: false as const,
      error: "No foreman assigned to this site on that day.",
    };
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
          requestedByUserId: auth.userId,
          note,
          dueAt,
        },
        select: { id: true, siteDayId: true },
      }),
    ),
  );

  return {
    ok: true as const,
    count: created.length,
    requests: created.map((r) => ({ id: r.id, siteDayId: r.siteDayId })),
  };
}
