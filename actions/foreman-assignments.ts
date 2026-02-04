// actions/foreman-assignments.ts
"use server";

import { prisma } from "@/lib/prisma";
import { requireServerAuth } from "@/lib/auth-server";

function clean(v: unknown) {
  return String(v ?? "").trim();
}

/**
 * Supervisor adds a foreman under them.
 * ADMIN can also do it.
 */
export async function linkSupervisorToForeman(input: {
  supervisorUserId?: string; // if admin can specify, else auto
  foremanUserId: string; // user.id
}) {
  const auth = await requireServerAuth();
  const foremanUserId = clean(input.foremanUserId);

  let supervisorId: string | null = null;

  if (auth.role === "ADMIN") {
    const supervisorUserId = clean(input.supervisorUserId);
    if (!supervisorUserId) {
      return { ok: false as const, error: "supervisorUserId is required." };
    }
    const s = await prisma.supervisor.findUnique({
      where: { userId: supervisorUserId },
      select: { id: true },
    });
    if (!s) return { ok: false as const, error: "Supervisor not found." };
    supervisorId = s.id;
  } else if (auth.role === "SUPERVISOR") {
    const s = await prisma.supervisor.findUnique({
      where: { userId: auth.userId },
      select: { id: true },
    });
    if (!s) return { ok: false as const, error: "Supervisor not found." };
    supervisorId = s.id;
  } else {
    return { ok: false as const, error: "Not allowed." };
  }

  const foreman = await prisma.foreman.findUnique({
    where: { userId: foremanUserId },
    select: { id: true },
  });

  if (!foreman) return { ok: false as const, error: "Foreman not found." };

  await prisma.supervisorForeman.create({
    data: {
      supervisorId,
      foremanId: foreman.id,
      startsOn: new Date(),
    },
  });

  return { ok: true as const };
}

/**
 * Assign foreman to a site.
 * - ADMIN can assign anyone
 * - SUPERVISOR can assign only foremen linked to them AND only sites assigned to them
 */
export async function assignForemanToSite(input: {
  foremanUserId: string; // user.id
  siteId: string;
}) {
  const auth = await requireServerAuth();
  const foremanUserId = clean(input.foremanUserId);
  const siteId = clean(input.siteId);

  const foreman = await prisma.foreman.findUnique({
    where: { userId: foremanUserId },
    select: { id: true },
  });
  if (!foreman) return { ok: false as const, error: "Foreman not found." };

  if (auth.role === "SUPERVISOR") {
    // Must be linked to supervisor
    const allowedForeman = await prisma.supervisorForeman.findFirst({
      where: {
        supervisor: { userId: auth.userId },
        foremanId: foreman.id,
        endsOn: null,
      },
      select: { foremanId: true },
    });
    if (!allowedForeman) {
      return {
        ok: false as const,
        error: "Foreman not under this supervisor.",
      };
    }

    // Site must be assigned to supervisor
    const allowedSite = await prisma.supervisorSiteAssignment.findFirst({
      where: {
        supervisor: { userId: auth.userId },
        siteId,
        endsOn: null,
      },
      select: { siteId: true },
    });
    if (!allowedSite) {
      return { ok: false as const, error: "Site not under this supervisor." };
    }
  } else if (auth.role !== "ADMIN") {
    return { ok: false as const, error: "Not allowed." };
  }

  await prisma.foremanSiteAssignment.create({
    data: {
      foremanId: foreman.id,
      siteId,
      startsOn: new Date(),
    },
  });

  return { ok: true as const };
}
