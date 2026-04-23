// actions/sites.ts
"use server";

import { prisma } from "@/lib/prisma";
import { requireServerAuth } from "@/lib/auth-server";
import { siteWhereFor } from "@/lib/site-scope";
import { parseWorkDate, toISODate } from "@/lib/workdate";
import { writeAuditEvent } from "@/lib/audit";
import { requireCanManageSite } from "@/lib/guards";
import { revalidatePath } from "next/cache";

function clean(v: unknown) {
  return String(v ?? "").trim();
}

function cleanNumber(v: unknown) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function isValidLatitude(n: number) {
  return Number.isFinite(n) && n >= -90 && n <= 90;
}

function isValidLongitude(n: number) {
  return Number.isFinite(n) && n >= -180 && n <= 180;
}

function serializeSite(s: any) {
  // Get supervisor name from first active assignment
  const supervisorName =
    s.supervisorAssignments?.[0]?.supervisor?.user?.name ?? null;
  // Calculate total wages from all attendance scans
  const totalWages = (s.attendanceScans ?? []).reduce(
    (sum: number, scan: { dayRateAtScan: unknown }) =>
      sum + (Number(scan.dayRateAtScan) || 0),
    0,
  );
  // Calculate total material cost from order items
  const totalMaterialCost = (s.siteProductOrders ?? []).reduce(
    (sum: number, order: any) =>
      sum +
      (order.items ?? []).reduce(
        (s2: number, item: any) =>
          s2 + (Number(item.unitPriceAtOrder) || 0) * (item.quantity || 0),
        0,
      ),
    0,
  );
  return {
    id: s.id,
    name: s.name,
    code: s.code,
    client: s.client ?? null,
    location: s.location,
    amountClaimed: Number(s.amountClaimed ?? 0),
    siteClaimDate:
      s.siteClaimDate instanceof Date
        ? s.siteClaimDate.toISOString()
        : s.siteClaimDate
          ? String(s.siteClaimDate)
          : null,
    address: s.address ?? null,
    latitude: typeof s.latitude === "number" ? s.latitude : null,
    longitude: typeof s.longitude === "number" ? s.longitude : null,
    isActive: s.isActive,
    jobStatus: (s.jobStatus ?? "NOT_STARTED") as "NOT_STARTED" | "ONGOING" | "COMPLETED" | "ON_HOLD",
    createdAt:
      s.createdAt instanceof Date
        ? s.createdAt.toISOString()
        : String(s.createdAt),
    supervisorName,
    totalWages,
    totalMaterialCost,
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
  dateFrom?: string;
  dateTo?: string;
}) {
  const auth = await requireServerAuth();
  const scope = siteWhereFor(auth);

  const q = clean(input?.q);
  const onlyActive = (input?.show ?? "active") !== "all";
  const take = input?.take ? Math.max(input.take, 1) : undefined;

  // Build date filter for attendance scans + product orders
  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (input?.dateFrom)
    dateFilter.gte = new Date(input.dateFrom + "T00:00:00.000Z");
  if (input?.dateTo) dateFilter.lte = new Date(input.dateTo + "T23:59:59.999Z");
  const hasDateFilter = Object.keys(dateFilter).length > 0;

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
    orderBy: [
      // Sites with a claim date should appear first; within that, newest sites first
      { siteClaimDate: "asc" },
      { createdAt: "desc" },
    ],
    take,
    select: {
      id: true,
      name: true,
      code: true,
      client: true,
      location: true,
      amountClaimed: true,
      siteClaimDate: true,
      address: true,
      latitude: true,
      longitude: true,
      isActive: true,
      jobStatus: true,
      createdAt: true,
      supervisorAssignments: {
        select: {
          supervisor: {
            select: {
              user: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: { startsOn: "desc" },
        take: 1,
      },
      attendanceScans: {
        where: hasDateFilter ? { workDate: dateFilter } : undefined,
        select: {
          dayRateAtScan: true,
        },
      },
      siteProductOrders: {
        where: hasDateFilter ? { createdAt: dateFilter } : undefined,
        select: {
          items: {
            select: {
              quantity: true,
              unitPriceAtOrder: true,
            },
          },
        },
      },
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
  client?: string | null;
  location?: string | null;
  address?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  isActive?: boolean;
}) {
  const auth = await requireServerAuth();
  if (auth.role !== "ADMIN") {
    return { ok: false as const, error: "Only admin can create sites." };
  }

  const name = clean(input.name);
  const code = clean(input.code) || null;
  const client = clean(input.client) || null;
  const location = clean(input.location) || null;
  const address = clean(input.address) || null;
  const latitude = cleanNumber(input.latitude);
  const longitude = cleanNumber(input.longitude);

  if (!name) return { ok: false as const, error: "Site name is required." };
  if (latitude !== null && !isValidLatitude(latitude)) {
    return {
      ok: false as const,
      error: "Latitude must be between -90 and 90.",
    };
  }
  if (longitude !== null && !isValidLongitude(longitude)) {
    return {
      ok: false as const,
      error: "Longitude must be between -180 and 180.",
    };
  }

  try {
    const site = await prisma.site.create({
      data: {
        name,
        code,
        client,
        location,
        address,
        latitude,
        longitude,
        isActive: input.isActive ?? true,
      },
      select: {
        id: true,
        name: true,
        code: true,
        client: true,
        location: true,
        address: true,
        latitude: true,
        longitude: true,
        isActive: true,
        createdAt: true,
      },
    });

    await writeAuditEvent({
      actorUserId: auth.userId,
      action: "SITE_CREATED",
      entity: "Site",
      entityId: site.id,
      metadata: {
        siteId: site.id,
        siteName: site.name,
        title: "New site created",
        description: site.name,
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

export async function updateSiteLocation(input: {
  siteId: string;
  name?: string;
  code?: string | null;
  client?: string | null;
  location?: string | null;
  address?: string | null;
  siteClaimDate?: string | null;
  amountClaimed?: number | string | null;
  jobStatus?: "NOT_STARTED" | "ONGOING" | "COMPLETED" | "ON_HOLD";
  latitude?: number | string | null;
  longitude?: number | string | null;
}) {
  const auth = await requireServerAuth();
  const siteId = clean(input.siteId);
  if (!siteId) return { ok: false as const, error: "Site is required." };

  await requireCanManageSite(auth, siteId);

  const name = input.name === undefined ? undefined : clean(input.name);
  const code = input.code === undefined ? undefined : clean(input.code) || null;
  const client =
    input.client === undefined ? undefined : clean(input.client) || null;
  const location =
    input.location === undefined ? undefined : clean(input.location) || null;
  const address =
    input.address === undefined ? undefined : clean(input.address) || null;
  const siteClaimDate =
    input.siteClaimDate === undefined
      ? undefined
      : input.siteClaimDate
        ? new Date(input.siteClaimDate + "T00:00:00.000Z")
        : null;
  const amountClaimed =
    input.amountClaimed === undefined
      ? undefined
      : cleanNumber(input.amountClaimed) ?? 0;
  const latitude =
    input.latitude === undefined ? undefined : cleanNumber(input.latitude);
  const longitude =
    input.longitude === undefined ? undefined : cleanNumber(input.longitude);

  if ((name !== undefined || code !== undefined) && auth.role !== "ADMIN") {
    return {
      ok: false as const,
      error: "Only admin can update site name or job number.",
    };
  }

  if (name !== undefined && !name) {
    return { ok: false as const, error: "Site name is required." };
  }

  if (
    latitude !== undefined &&
    latitude !== null &&
    !isValidLatitude(latitude)
  ) {
    return {
      ok: false as const,
      error: "Latitude must be between -90 and 90.",
    };
  }
  if (
    longitude !== undefined &&
    longitude !== null &&
    !isValidLongitude(longitude)
  ) {
    return {
      ok: false as const,
      error: "Longitude must be between -180 and 180.",
    };
  }

  try {
    const site = await prisma.site.update({
      where: { id: siteId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(code !== undefined ? { code } : {}),
        ...(client !== undefined ? { client } : {}),
        ...(location !== undefined ? { location } : {}),
        ...(address !== undefined ? { address } : {}),
        ...(siteClaimDate !== undefined ? { siteClaimDate } : {}),
        ...(amountClaimed !== undefined ? { amountClaimed } : {}),
        ...(input.jobStatus !== undefined ? { jobStatus: input.jobStatus } : {}),
        ...(latitude !== undefined ? { latitude } : {}),
        ...(longitude !== undefined ? { longitude } : {}),
      },
      select: {
        id: true,
        name: true,
        code: true,
        client: true,
        location: true,
        amountClaimed: true,
        siteClaimDate: true,
        address: true,
        latitude: true,
        longitude: true,
        isActive: true,
        jobStatus: true,
        createdAt: true,
      },
    });

    revalidatePath(`/sites/${siteId}`);
    revalidatePath(`/sites`);
    revalidatePath(`/sites/map`);

    return { ok: true as const, site: serializeSite(site) };
  } catch (e: any) {
    return { ok: false as const, error: "Failed to update site." };
  }
}

/**
 * Fetch only ONGOING sites — used by the Job Progress board.
 * Avoids loading completed/not-started sites entirely.
 */
export async function listOngoingSites() {
  const auth = await requireServerAuth();
  const scope = siteWhereFor(auth);

  const sites = await prisma.site.findMany({
    where: { ...scope, isActive: true, jobStatus: "ONGOING" },
    orderBy: [{ siteClaimDate: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      code: true,
      client: true,
      location: true,
      amountClaimed: true,
      siteClaimDate: true,
      isActive: true,
      jobStatus: true,
      createdAt: true,
      supervisorAssignments: {
        select: {
          supervisor: { select: { user: { select: { name: true } } } },
        },
        orderBy: { startsOn: "desc" },
        take: 1,
      },
      attendanceScans: { select: { dayRateAtScan: true } },
      siteProductOrders: {
        select: {
          items: { select: { quantity: true, unitPriceAtOrder: true } },
        },
      },
    },
  });

  return { ok: true as const, sites: sites.map(serializeSite) };
}

/**
 * Quickly update only the jobStatus of a site.
 */
export async function updateSiteJobStatus(input: {
  siteId: string;
  jobStatus: "NOT_STARTED" | "ONGOING" | "COMPLETED" | "ON_HOLD";
}) {
  const auth = await requireServerAuth();
  const siteId = clean(input.siteId);
  if (!siteId) return { ok: false as const, error: "Site is required." };
  await requireCanManageSite(auth, siteId);

  try {
    await prisma.site.update({
      where: { id: siteId },
      data: { jobStatus: input.jobStatus },
    });
    revalidatePath("/admin/job-progress");
    revalidatePath("/sites");
    revalidatePath(`/sites/${siteId}`);
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "Failed to update job status." };
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
      supervisor: { connect: { id: supervisor.id } },
      site: { connect: { id: siteId } },
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
        site: { connect: { id: siteId } },
        foreman: { connect: { id: foremanId } },
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
  try {
    const auth = await requireServerAuth();

    const siteId = String(input.siteId ?? "").trim();
    if (!siteId) {
      return { ok: false as const, error: "Site is required." };
    }

    try {
      await requireCanManageSite(auth, siteId);
    } catch {
      return {
        ok: false as const,
        error: "You don't have permission to manage this site.",
      };
    }

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
                    site: { connect: { id: siteId } },
                    foreman: { connect: { id: a.foremanId } },
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
            siteDay: { connect: { id: sd.id } },
            requestedByUser: { connect: { id: auth.userId } },
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
  } catch (e: any) {
    console.error("[requestSiteGroupPhoto] Error:", e);
    return {
      ok: false as const,
      error:
        e?.message === "Unauthorized"
          ? "Unauthorized"
          : "Failed to create photo request.",
    };
  }
}

/**
 * Mark a site as finished (set isActive = false)
 */
export async function markSiteFinished(siteId: string) {
  const auth = await requireServerAuth();
  if (auth.role !== "ADMIN") {
    return {
      ok: false as const,
      error: "Only admin can mark sites as finished.",
    };
  }

  const id = clean(siteId);
  if (!id) return { ok: false as const, error: "Site is required." };

  try {
    await prisma.site.update({
      where: { id },
      data: { isActive: false },
    });

    revalidatePath("/sites");
    revalidatePath(`/sites/${id}`);

    return { ok: true as const };
  } catch (e: any) {
    return { ok: false as const, error: "Failed to mark site as finished." };
  }
}

/**
 * Delete a site (hard delete; admin only).
 * Because the schema uses onDelete: Cascade on relations,
 * all related assignments, site-days, attendance scans, etc. will be removed.
 */
export async function deleteSite(siteId: string) {
  const auth = await requireServerAuth();
  if (auth.role !== "ADMIN") {
    return { ok: false as const, error: "Only admin can delete sites." };
  }

  const id = clean(siteId);
  if (!id) return { ok: false as const, error: "Site is required." };

  try {
    const site = await prisma.site.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!site) return { ok: false as const, error: "Site not found." };

    await prisma.site.delete({ where: { id } });

    await writeAuditEvent({
      actorUserId: auth.userId,
      action: "SITE_DELETED",
      entity: "Site",
      entityId: id,
      metadata: {
        siteId: id,
        siteName: site.name,
        title: "Site deleted",
        description: site.name,
      },
    });

    revalidatePath("/sites");

    return { ok: true as const };
  } catch (e: any) {
    console.error("[deleteSite] Error:", e);
    return { ok: false as const, error: "Failed to delete site." };
  }
}
