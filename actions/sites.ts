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

const SPEC_STATUSES = [
  "NOT_REQUESTED",
  "NOT_NEEDED",
  "NOT_REQUIRED",
  "REQUESTED",
  "RECEIVED",
  "ACTIONED",
] as const;

type SiteSpecStatus = (typeof SPEC_STATUSES)[number];

function normalizeSpecStatus(value: unknown): SiteSpecStatus | undefined {
  if (value === undefined) return undefined;
  const status = clean(value).toUpperCase();
  if (status === "NOT_NEEDED") return "NOT_REQUIRED";
  return SPEC_STATUSES.includes(status as SiteSpecStatus)
    ? (status as SiteSpecStatus)
    : undefined;
}

function specAvailableFromStatus(status: SiteSpecStatus) {
  return status === "RECEIVED" || status === "ACTIONED";
}

function siteHasFinishingSchedule(s: {
  finishingSchedules?: unknown[] | null;
  finishingScheduleDone?: boolean | null;
}) {
  return (
    (s.finishingSchedules?.length ?? 0) > 0 || Boolean(s.finishingScheduleDone)
  );
}

function serializeSite(s: any) {
  const activeSupervisorAssignments = s.supervisorAssignments ?? [];

  const paintingSupervisor =
    activeSupervisorAssignments.find(
      (assignment: any) =>
        String(assignment.team ?? "").toUpperCase() === "PAINTERS",
    ) ?? activeSupervisorAssignments[0];

  const supervisorName = paintingSupervisor?.supervisor?.user?.name ?? null;

  const supervisorNames = activeSupervisorAssignments
    .map((assignment: any) => assignment.supervisor?.user?.name)
    .filter((name: unknown): name is string => Boolean(name));

  const supervisors = activeSupervisorAssignments.map((assignment: any) => ({
    name: assignment.supervisor?.user?.name ?? "Unknown",
    team: assignment.team ?? null,
  }));
  // Calculate total wages from all attendance scans
  const totalWages = (s.attendanceScans ?? []).reduce(
    (sum: number, scan: { dayRateAtScan: unknown }) =>
      sum + (Number(scan.dayRateAtScan) || 0),
    0,
  );
  const daysWorked = new Set(
    (s.attendanceScans ?? [])
      .map((scan: { workDate?: unknown }) => {
        const workDate = scan.workDate;
        if (workDate instanceof Date)
          return workDate.toISOString().slice(0, 10);
        if (workDate) return String(workDate).slice(0, 10);
        return null;
      })
      .filter(Boolean),
  ).size;
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
  const latestClaim = s.claims?.[0] ?? null;
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
    specStatus:
      (s.specStatus as SiteSpecStatus | null | undefined) ??
      (s.specAvailable ? "RECEIVED" : "NOT_REQUESTED"),
    specAvailable: Boolean(s.specAvailable),
    finishingScheduleDone: Boolean(s.finishingScheduleDone),
    hasFinishingScheduleInSystem: (s.finishingSchedules?.length ?? 0) > 0,
    hasFinishingSchedule: siteHasFinishingSchedule(s),
    finishingScheduleStatus: s.finishingSchedules?.[0]?.status ?? null,
    jobStatus: (s.jobStatus ?? "NOT_STARTED") as
      | "NOT_STARTED"
      | "ONGOING"
      | "COMPLETED"
      | "ON_HOLD",
    stageIndex: typeof s.stageIndex === "number" ? s.stageIndex : 0,
    stagePct: (() => {
      const raw = s.stagePct;
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        return raw as Record<string, number>;
      }
      return {} as Record<string, number>;
    })(),
    materials: Object.values(
      (s.siteProductOrders ?? []).reduce(
        (
          acc: Record<
            string,
            { name: string; quantity: number; unitPrice: number; total: number }
          >,
          order: any,
        ) => {
          for (const item of order.items ?? []) {
            const name: string = item.product?.name ?? "Unknown";
            if (!acc[name])
              acc[name] = { name, quantity: 0, unitPrice: 0, total: 0 };
            acc[name].quantity += Number(item.quantity) || 0;
            acc[name].unitPrice =
              Number(item.unitPriceAtOrder) || acc[name].unitPrice;
            acc[name].total +=
              (Number(item.unitPriceAtOrder) || 0) *
              (Number(item.quantity) || 0);
          }
          return acc;
        },
        {},
      ),
    ).sort((a: any, b: any) => b.total - a.total) as {
      name: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }[],
    createdAt:
      s.createdAt instanceof Date
        ? s.createdAt.toISOString()
        : String(s.createdAt),
    supervisorName,
    supervisorNames,
    supervisors,
    daysWorked,
    totalWages,
    totalMaterialCost,
    claimDate:
      latestClaim?.claimDate instanceof Date
        ? latestClaim.claimDate.toISOString()
        : null,
    claimAmountClaimed: latestClaim ? Number(latestClaim.amountClaimed) : 0,
    claimAmountReceived: latestClaim ? Number(latestClaim.amountReceived) : 0,
    claimOutstanding: latestClaim
      ? Math.max(
          0,
          Number(latestClaim.amountClaimed) -
            Number(latestClaim.amountReceived),
        )
      : 0,
    claimStatus: (latestClaim?.status ?? null) as
      | "DRAFT"
      | "SUBMITTED"
      | "PARTIALLY_RECEIVED"
      | "RECEIVED"
      | "CANCELLED"
      | null,
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
      specStatus: true,
      specAvailable: true,
      finishingScheduleDone: true,
      jobStatus: true,
      stageIndex: true,
      stagePct: true,
      createdAt: true,
      supervisorAssignments: {
        where: {
          endsOn: null,
        },
        select: {
          team: true,
          supervisor: {
            select: {
              user: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: { startsOn: "desc" },
      },
      attendanceScans: {
        where: hasDateFilter ? { workDate: dateFilter } : undefined,
        select: {
          workDate: true,
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
              product: { select: { name: true } },
            },
          },
        },
      },
      claims: {
        orderBy: { claimDate: "desc" },
        take: 1,
        select: {
          claimDate: true,
          amountClaimed: true,
          amountReceived: true,
          status: true,
        },
      },
      finishingSchedules: {
        where: { isActive: true },
        select: { id: true, status: true },
        take: 1,
      },
    },
  });

  // ── Historical costs from BuildSmart (grouped by site) ──
  const siteIds = sites.map((s) => s.id);
  const histDateWhere = hasDateFilter ? { transactionDate: dateFilter } : {};

  const [histWages, histMaterial, periodClaims, latestPeriodClaims] =
    await Promise.all([
      prisma.historicalSiteCost.groupBy({
        by: ["siteId"],
        where: {
          siteId: { in: siteIds },
          category: "LABOUR",
          ...histDateWhere,
        },
        _sum: { amount: true },
      }),
      prisma.historicalSiteCost.groupBy({
        by: ["siteId"],
        where: {
          siteId: { in: siteIds },
          category: { not: "LABOUR" },
          ...histDateWhere,
        },
        _sum: { amount: true },
      }),
      prisma.siteClaim.groupBy({
        by: ["siteId"],
        where: {
          siteId: { in: siteIds },
          ...(hasDateFilter ? { claimDate: dateFilter } : {}),
        },
        _sum: { amountClaimed: true, amountReceived: true },
      }),
      prisma.siteClaim.findMany({
        where: {
          siteId: { in: siteIds },
          ...(hasDateFilter ? { claimDate: dateFilter } : {}),
        },
        orderBy: { claimDate: "desc" },
        select: {
          siteId: true,
          claimDate: true,
          status: true,
        },
      }),
    ]);

  const histWagesMap = new Map(
    histWages.map((r) => [r.siteId, Number(r._sum.amount ?? 0)]),
  );
  const histMaterialMap = new Map(
    histMaterial.map((r) => [r.siteId, Number(r._sum.amount ?? 0)]),
  );
  const periodClaimMap = new Map(
    periodClaims.map((r) => [
      r.siteId,
      {
        amountClaimed: Number(r._sum.amountClaimed ?? 0),
        amountReceived: Number(r._sum.amountReceived ?? 0),
      },
    ]),
  );
  const latestPeriodClaimMap = new Map<
    string,
    {
      claimDate: Date;
      status:
        | "DRAFT"
        | "SUBMITTED"
        | "PARTIALLY_RECEIVED"
        | "RECEIVED"
        | "CANCELLED";
    }
  >();
  for (const claim of latestPeriodClaims) {
    if (!latestPeriodClaimMap.has(claim.siteId)) {
      latestPeriodClaimMap.set(claim.siteId, {
        claimDate: claim.claimDate,
        status: claim.status,
      });
    }
  }

  return {
    ok: true as const,
    sites: sites.map((s) => {
      const row = serializeSite(s);
      const periodClaim = periodClaimMap.get(s.id);
      const latestPeriodClaim = latestPeriodClaimMap.get(s.id);
      const amountClaimed = hasDateFilter
        ? (periodClaim?.amountClaimed ?? 0)
        : row.amountClaimed;
      const amountReceived = hasDateFilter
        ? (periodClaim?.amountReceived ?? 0)
        : row.claimAmountReceived;
      return {
        ...row,
        amountClaimed,
        totalWages: row.totalWages + (histWagesMap.get(s.id) ?? 0),
        totalMaterialCost:
          row.totalMaterialCost + (histMaterialMap.get(s.id) ?? 0),
        claimDate: hasDateFilter
          ? latestPeriodClaim?.claimDate.toISOString()
          : row.claimDate,
        claimAmountClaimed: hasDateFilter
          ? amountClaimed
          : row.claimAmountClaimed,
        claimAmountReceived: amountReceived,
        claimOutstanding: Math.max(0, amountClaimed - amountReceived),
        claimStatus: hasDateFilter
          ? (latestPeriodClaim?.status ?? null)
          : row.claimStatus,
      };
    }),
  };
}

export type SiteRow =
  Awaited<ReturnType<typeof listSites>> extends { sites: (infer T)[] }
    ? T
    : never;

export async function getNextSiteCode() {
  const auth = await requireServerAuth();
  if (auth.role !== "ADMIN") {
    return { ok: false as const, error: "Only admin can create sites." };
  }

  const sites = await prisma.site.findMany({
    where: { code: { not: null } },
    select: { code: true },
  });

  const maxCode = sites.reduce((max, site) => {
    const code = clean(site.code);
    if (!/^\d+$/.test(code)) return max;
    return Math.max(max, Number(code));
  }, 0);

  return {
    ok: true as const,
    code: maxCode > 0 ? String(maxCode + 1) : "",
  };
}

function formatClientName(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

export async function listSiteClients() {
  const auth = await requireServerAuth();
  if (auth.role !== "ADMIN") {
    return { ok: false as const, error: "Only admin can manage clients." };
  }

  const sites = await prisma.site.findMany({
    where: { client: { not: null } },
    select: { client: true },
  });

  const clientsByKey = new Map<string, string>();
  for (const site of sites) {
    const client = formatClientName(clean(site.client));
    if (!client) continue;

    const key = client.toLowerCase();
    if (!clientsByKey.has(key)) {
      clientsByKey.set(key, client);
    }
  }

  return {
    ok: true as const,
    clients: Array.from(clientsByKey.values()).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    ),
  };
}

export async function createSite(input: {
  name: string;
  code?: string | null;
  client?: string | null;
  location?: string | null;
  address?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  isActive?: boolean;
  assignmentType?: "SUPERVISOR" | "ADMIN" | null;
  assignmentUserId?: string | null;
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
  const assignmentType = input.assignmentType ?? null;
  const assignmentUserId = clean(input.assignmentUserId) || null;

  if (!name) return { ok: false as const, error: "Site name is required." };
  if (assignmentType && !["SUPERVISOR", "ADMIN"].includes(assignmentType)) {
    return { ok: false as const, error: "Invalid assignment type." };
  }
  if (assignmentType && !assignmentUserId) {
    return {
      ok: false as const,
      error: "Please select who manages this site.",
    };
  }
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
    const site = await prisma.$transaction(async (tx) => {
      const created = await tx.site.create({
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

      if (assignmentType === "SUPERVISOR" && assignmentUserId) {
        const supervisor = await tx.supervisor.findUnique({
          where: { userId: assignmentUserId },
          select: { id: true },
        });

        if (!supervisor) {
          throw new Error("SUPERVISOR_NOT_FOUND");
        }

        await tx.supervisorSiteAssignment.create({
          data: {
            site: { connect: { id: created.id } },
            supervisor: { connect: { id: supervisor.id } },
            startsOn: new Date(),
          },
        });
      }

      if (assignmentType === "ADMIN" && assignmentUserId) {
        const user = await tx.user.findUnique({
          where: { id: assignmentUserId },
          select: { id: true, role: true },
        });

        if (!user || !["ADMIN", "OFFICE"].includes(user.role)) {
          throw new Error("ADMIN_NOT_FOUND");
        }

        await tx.adminSiteAssignment.create({
          data: {
            site: { connect: { id: created.id } },
            user: { connect: { id: user.id } },
            startsOn: new Date(),
          },
        });
      }

      return created;
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
    if (e?.message === "SUPERVISOR_NOT_FOUND") {
      return { ok: false as const, error: "Supervisor not found." };
    }
    if (e?.message === "ADMIN_NOT_FOUND") {
      return { ok: false as const, error: "Admin user not found." };
    }
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
  specStatus?: SiteSpecStatus | null;
  specAvailable?: boolean | null;
  finishingScheduleDone?: boolean | null;
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
      : (cleanNumber(input.amountClaimed) ?? 0);
  const latitude =
    input.latitude === undefined ? undefined : cleanNumber(input.latitude);
  const longitude =
    input.longitude === undefined ? undefined : cleanNumber(input.longitude);
  const specAvailable =
    input.specAvailable === undefined
      ? undefined
      : Boolean(input.specAvailable);
  const finishingScheduleDone =
    input.finishingScheduleDone === undefined
      ? undefined
      : Boolean(input.finishingScheduleDone);
  const specStatus =
    input.specStatus !== undefined
      ? normalizeSpecStatus(input.specStatus)
      : specAvailable !== undefined
        ? specAvailable
          ? "RECEIVED"
          : "NOT_REQUESTED"
        : undefined;

  if (input.specStatus !== undefined && !specStatus) {
    return { ok: false as const, error: "Invalid spec status." };
  }

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
        ...(input.jobStatus !== undefined
          ? { jobStatus: input.jobStatus }
          : {}),
        ...(specStatus !== undefined
          ? {
              specStatus,
              specAvailable: specAvailableFromStatus(specStatus),
            }
          : specAvailable !== undefined
            ? { specAvailable }
            : {}),
        ...(finishingScheduleDone !== undefined
          ? { finishingScheduleDone }
          : {}),
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
        specStatus: true,
        specAvailable: true,
        finishingScheduleDone: true,
        jobStatus: true,
        createdAt: true,
        finishingSchedules: {
          where: { isActive: true },
          select: { id: true, status: true },
          take: 1,
        },
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
function shouldExcludeLowJobWithoutCosts(site: any) {
  const jobNumber = Number(String(site.code ?? "").trim());
  if (!Number.isFinite(jobNumber)) return false;
  if (jobNumber >= 6000) return false;
  return (site.totalWages ?? 0) === 0 && (site.totalMaterialCost ?? 0) === 0;
}

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
      specStatus: true,
      specAvailable: true,
      finishingScheduleDone: true,
      jobStatus: true,
      stageIndex: true,
      stagePct: true,
      createdAt: true,
      supervisorAssignments: {
        where: {
          endsOn: null,
        },
        select: {
          team: true,
          supervisor: {
            select: {
              user: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: { startsOn: "desc" },
      },
      attendanceScans: { select: { dayRateAtScan: true } },
      siteProductOrders: {
        select: {
          items: {
            select: {
              quantity: true,
              unitPriceAtOrder: true,
              product: { select: { name: true } },
            },
          },
        },
      },
      finishingSchedules: {
        where: { isActive: true },
        select: { id: true, status: true },
        take: 1,
      },
    },
  });

  const filteredSites = sites
    .map(serializeSite)
    .filter((site) => !shouldExcludeLowJobWithoutCosts(site));

  return { ok: true as const, sites: filteredSites };
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
 * List progress notes for a site (newest first).
 */
export async function listSiteProgressNotes(siteId: string) {
  await requireServerAuth();
  const notes = await prisma.siteProgressNote.findMany({
    where: { siteId: clean(siteId) },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      content: true,
      createdAt: true,
      author: { select: { name: true } },
    },
  });
  return {
    ok: true as const,
    notes: notes.map((n) => ({
      id: n.id,
      content: n.content,
      authorName: n.author?.name ?? "Unknown",
      createdAt: n.createdAt.toISOString(),
    })),
  };
}

/**
 * Add a progress note to a site.
 */
export async function addSiteProgressNote(input: {
  siteId: string;
  content: string;
}) {
  const auth = await requireServerAuth();
  const content = input.content.trim();
  if (!content) return { ok: false as const, error: "Note cannot be empty." };

  const note = await prisma.siteProgressNote.create({
    data: {
      siteId: input.siteId,
      content,
      authorId: auth.userId,
    },
    select: {
      id: true,
      content: true,
      createdAt: true,
      author: { select: { name: true } },
    },
  });

  revalidatePath("/admin/job-progress");
  return {
    ok: true as const,
    note: {
      id: note.id,
      content: note.content,
      authorName: note.author?.name ?? "Unknown",
      createdAt: note.createdAt.toISOString(),
    },
  };
}

/**
 * Update per-stage completion percentages for a site.
 */
export async function updateSiteStagePercent(input: {
  siteId: string;
  stagePct: Record<string, number>;
}) {
  const auth = await requireServerAuth();
  const siteId = clean(input.siteId);
  if (!siteId) return { ok: false as const, error: "Site is required." };
  await requireCanManageSite(auth, siteId);

  try {
    await prisma.site.update({
      where: { id: siteId },
      data: { stagePct: input.stagePct },
    });
    revalidatePath("/admin/job-progress");
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "Failed to update stage percentages." };
  }
}

/**
 * Update the current painting stage index for a site.
 */
export async function updateSiteStageIndex(input: {
  siteId: string;
  stageIndex: number;
}) {
  const auth = await requireServerAuth();
  const siteId = clean(input.siteId);
  if (!siteId) return { ok: false as const, error: "Site is required." };
  await requireCanManageSite(auth, siteId);

  const idx = Math.max(0, Math.floor(input.stageIndex));

  try {
    await prisma.site.update({
      where: { id: siteId },
      data: { stageIndex: idx },
    });
    revalidatePath("/admin/job-progress");
    revalidatePath(`/sites/${siteId}`);
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "Failed to update stage." };
  }
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
