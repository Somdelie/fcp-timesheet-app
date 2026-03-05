// actions/site-days.ts
"use server";

import { prisma } from "@/lib/prisma";
import { requireServerAuth } from "@/lib/auth-server";

function clean(v: unknown) {
  return String(v ?? "").trim();
}

function toWorkDate(dateISO: string) {
  // Normalize to start-of-day (UTC) to keep uniqueness consistent
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Create a SiteDay booking (foreman booked to one site for a day).
 * - ADMIN can book any foreman
 * - SUPERVISOR can book only foremen under them and sites under them
 * - FOREMAN can only book themselves and only sites assigned to them
 */
export async function createSiteDay(input: {
  siteId: string;
  foremanUserId?: string; // if supervisor/admin booking someone; foreman can omit
  workDateISO: string; // "2026-02-03" or full ISO
}) {
  const auth = await requireServerAuth();

  const siteId = clean(input.siteId);
  const workDate = toWorkDate(input.workDateISO);
  if (!siteId) return { ok: false as const, error: "siteId is required." };
  if (!workDate) return { ok: false as const, error: "Invalid work date." };

  // Resolve foreman
  let foremanUserId = clean(input.foremanUserId);

  if (auth.role === "FOREMAN") {
    foremanUserId = auth.userId;
  } else if (!foremanUserId) {
    return { ok: false as const, error: "foremanUserId is required." };
  }

  const foreman = await prisma.foreman.findUnique({
    where: { userId: foremanUserId },
    select: { id: true },
  });
  if (!foreman) return { ok: false as const, error: "Foreman not found." };

  // Authorization checks
  if (auth.role === "SUPERVISOR") {
    const okForeman = await prisma.supervisorForeman.findFirst({
      where: {
        supervisor: { userId: auth.userId },
        foremanId: foreman.id,
        endsOn: null,
      },
      select: { foremanId: true },
    });
    if (!okForeman)
      return { ok: false as const, error: "Foreman not allowed." };

    const okSite = await prisma.supervisorSiteAssignment.findFirst({
      where: {
        supervisor: { userId: auth.userId },
        siteId,
        endsOn: null,
      },
      select: { siteId: true },
    });
    if (!okSite) return { ok: false as const, error: "Site not allowed." };
  }

  if (auth.role === "FOREMAN") {
    const okSite = await prisma.foremanSiteAssignment.findFirst({
      where: {
        foreman: { userId: auth.userId },
        siteId,
        endsOn: null,
      },
      select: { siteId: true },
    });
    if (!okSite)
      return { ok: false as const, error: "Site not assigned to you." };
  }

  try {
    const siteDay = await prisma.siteDay.create({
      data: {
        site: { connect: { id: siteId } },
        foreman: { connect: { id: foreman.id } },
        workDate,
      },
      select: {
        id: true,
        siteId: true,
        foremanId: true,
        workDate: true,
        isLocked: true,
        createdAt: true,
      },
    });

    return {
      ok: true as const,
      siteDay: {
        ...siteDay,
        workDate: siteDay.workDate.toISOString(),
        createdAt: siteDay.createdAt.toISOString(),
      },
    };
  } catch (e: any) {
    if (String(e?.code) === "P2002") {
      const target = Array.isArray(e?.meta?.target)
        ? e.meta.target.join(",")
        : String(e?.meta?.target ?? "");

      if (target.includes("siteId") && target.includes("workDate")) {
        return {
          ok: false as const,
          error: "This site already has a sheet for that day.",
        };
      }
      if (target.includes("foremanId") && target.includes("workDate")) {
        return {
          ok: false as const,
          error: "Foreman already booked for that day.",
        };
      }
      return {
        ok: false as const,
        error: "Booking violates a unique constraint.",
      };
    }

    return { ok: false as const, error: "Failed to create site day." };
  }
}
