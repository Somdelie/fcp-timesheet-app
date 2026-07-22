// actions/site-assignments.ts
"use server";

import { prisma } from "@/lib/prisma";
import { requireServerAuth } from "@/lib/auth-server";
import { requireCanManageSite } from "@/lib/guards";
import { revalidatePath } from "next/cache";

function serializeAssignment(a: any) {
  return {
    id: a.id,
    startsOn:
      a.startsOn instanceof Date
        ? a.startsOn.toISOString()
        : String(a.startsOn),
    endsOn: a.endsOn
      ? a.endsOn instanceof Date
        ? a.endsOn.toISOString()
        : String(a.endsOn)
      : null,
    siteId: a.siteId,
    person: a.person,
  };
}

function revalidateSiteAssignmentPaths(siteId: string) {
  revalidatePath(`/sites/${siteId}`);
  revalidatePath("/sites");
  revalidatePath("/admin/job-progress");
  revalidatePath("/sites/map");
}

/** ========= Supervisor ↔ Site ========= */

export async function listSupervisorSiteAssignments(siteId: string) {
  const auth = await requireServerAuth();
  await requireCanManageSite(auth, siteId);

  const rows = await prisma.supervisorSiteAssignment.findMany({
    where: { siteId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      startsOn: true,
      endsOn: true,
      siteId: true,
      team: true,
      supervisor: {
        select: {
          id: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  return {
    ok: true as const,
    assignments: rows.map((r) =>
      serializeAssignment({
        ...r,
        person: {
          supervisorId: r.supervisor.id,
          userId: r.supervisor.user.id,
          name: r.supervisor.user.name,
          email: r.supervisor.user.email,
          team: r.team,
        },
      }),
    ),
  };
}

export async function assignSupervisorToSite(input: {
  siteId: string;
  supervisorUserId: string;
  team?: string;
}) {
  const auth = await requireServerAuth();
  if (auth.role !== "ADMIN") {
    return {
      ok: false as const,
      error: "Only admin can assign supervisors to sites.",
    };
  }

  const siteId = String(input.siteId ?? "").trim();
  const supervisorUserId = String(input.supervisorUserId ?? "").trim();
  const team = String(input.team ?? "").trim() || null;

  if (!siteId) {
    return { ok: false as const, error: "Site is required." };
  }
  if (!supervisorUserId) {
    return { ok: false as const, error: "Supervisor is required." };
  }

  const [site, supervisor] = await Promise.all([
    prisma.site.findUnique({ where: { id: siteId }, select: { id: true } }),
    prisma.supervisor.findUnique({
      where: { userId: supervisorUserId },
      select: { id: true },
    }),
  ]);

  if (!site) return { ok: false as const, error: "Site not found." };
  if (!supervisor) {
    return { ok: false as const, error: "Supervisor not found." };
  }

  const existing = await prisma.supervisorSiteAssignment.findFirst({
    where: { siteId, supervisorId: supervisor.id, endsOn: null },
    select: { id: true },
  });

  if (existing) {
    return {
      ok: false as const,
      error: "Supervisor is already assigned to this site.",
    };
  }

  await prisma.supervisorSiteAssignment.create({
    data: {
      site: { connect: { id: siteId } },
      supervisor: { connect: { id: supervisor.id } },
      startsOn: new Date(),
      endsOn: null,
      team,
    },
  });

  revalidateSiteAssignmentPaths(siteId);
  return { ok: true as const };
}

export async function endSupervisorSiteAssignment(input: {
  assignmentId: string;
  siteId: string;
}) {
  const auth = await requireServerAuth();
  if (auth.role !== "ADMIN") {
    return {
      ok: false as const,
      error: "Only admin can end supervisor assignments.",
    };
  }

  const assignmentId = String(input.assignmentId ?? "").trim();
  const siteId = String(input.siteId ?? "").trim();

  if (!assignmentId || !siteId) {
    return { ok: false as const, error: "Assignment and site are required." };
  }

  const assignment = await prisma.supervisorSiteAssignment.findFirst({
    where: { id: assignmentId, siteId },
    select: { id: true },
  });

  if (!assignment) {
    return { ok: false as const, error: "Supervisor assignment not found." };
  }

  await prisma.supervisorSiteAssignment.update({
    where: { id: assignmentId },
    data: { endsOn: new Date() },
  });

  revalidateSiteAssignmentPaths(siteId);
  return { ok: true as const };
}

/** ========= Foreman ↔ Site ========= */

export async function listForemanSiteAssignments(siteId: string) {
  const auth = await requireServerAuth();
  await requireCanManageSite(auth, siteId);

  const rows = await prisma.foremanSiteAssignment.findMany({
    where: { siteId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      startsOn: true,
      endsOn: true,
      siteId: true,
      foreman: {
        select: {
          id: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  return {
    ok: true as const,
    assignments: rows.map((r) =>
      serializeAssignment({
        ...r,
        person: {
          foremanId: r.foreman.id,
          userId: r.foreman.user.id,
          name: r.foreman.user.name,
          email: r.foreman.user.email,
        },
      }),
    ),
  };
}

export async function assignForemanToSite(input: {
  siteId: string;
  foremanUserId: string;
}) {
  const auth = await requireServerAuth();
  await requireCanManageSite(auth, input.siteId);

  const siteId = String(input.siteId ?? "").trim();
  const foremanUserId = String(input.foremanUserId ?? "").trim();

  if (!siteId) return { ok: false as const, error: "Site is required." };
  if (!foremanUserId) {
    return { ok: false as const, error: "Foreman is required." };
  }

  const activeSupervisorAssignments =
    await prisma.supervisorSiteAssignment.findMany({
      where: { siteId, endsOn: null },
      select: { supervisorId: true },
    });

  if (activeSupervisorAssignments.length === 0) {
    return {
      ok: false as const,
      error:
        "Cannot assign foreman: site must have a supervisor first. Please assign a supervisor to this site before adding foremen.",
    };
  }

  const foreman = await prisma.foreman.findUnique({
    where: { userId: foremanUserId },
    select: { id: true },
  });
  if (!foreman) return { ok: false as const, error: "Foreman not found." };

  const existing = await prisma.foremanSiteAssignment.findFirst({
    where: { siteId, foremanId: foreman.id, endsOn: null },
    select: { id: true },
  });

  if (existing) {
    return {
      ok: false as const,
      error: "Foreman is already assigned to this site.",
    };
  }

  await prisma.$transaction(async (tx) => {
    const startsOn = new Date();

    await tx.foremanSiteAssignment.create({
      data: {
        site: { connect: { id: siteId } },
        foreman: { connect: { id: foreman.id } },
        startsOn,
        endsOn: null,
      },
    });

    for (const { supervisorId } of activeSupervisorAssignments) {
      const existingLink = await tx.supervisorForeman.findFirst({
        where: {
          supervisorId,
          foremanId: foreman.id,
          endsOn: null,
        },
        select: { foremanId: true },
      });

      if (!existingLink) {
        await tx.supervisorForeman.create({
          data: {
            supervisor: { connect: { id: supervisorId } },
            foreman: { connect: { id: foreman.id } },
            startsOn,
          },
        });
      }
    }
  });

  revalidateSiteAssignmentPaths(siteId);
  return { ok: true as const };
}

export async function endForemanSiteAssignment(input: {
  assignmentId: string;
  siteId: string;
}) {
  const auth = await requireServerAuth();
  await requireCanManageSite(auth, input.siteId);

  const assignmentId = String(input.assignmentId ?? "").trim();
  const siteId = String(input.siteId ?? "").trim();

  const assignment = await prisma.foremanSiteAssignment.findFirst({
    where: { id: assignmentId, siteId },
    select: { id: true },
  });

  if (!assignment) {
    return { ok: false as const, error: "Foreman assignment not found." };
  }

  await prisma.foremanSiteAssignment.update({
    where: { id: assignmentId },
    data: { endsOn: new Date() },
  });

  revalidateSiteAssignmentPaths(siteId);
  return { ok: true as const };
}

/** ========= Admin ↔ Site ========= */

export async function listAdminSiteAssignments(siteId: string) {
  const auth = await requireServerAuth();
  await requireCanManageSite(auth, siteId);

  const rows = await prisma.adminSiteAssignment.findMany({
    where: { siteId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      startsOn: true,
      endsOn: true,
      siteId: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return {
    ok: true as const,
    assignments: rows.map((r) =>
      serializeAssignment({
        ...r,
        person: {
          userId: r.user.id,
          name: r.user.name,
          email: r.user.email,
        },
      }),
    ),
  };
}

export async function assignAdminToSite(input: {
  siteId: string;
  adminUserId: string;
}) {
  const auth = await requireServerAuth();
  if (auth.role !== "ADMIN") {
    return {
      ok: false as const,
      error: "Only admin can assign admins to sites.",
    };
  }

  const siteId = String(input.siteId ?? "").trim();
  const userId = String(input.adminUserId ?? "").trim();

  if (!siteId) return { ok: false as const, error: "Site is required." };
  if (!userId) return { ok: false as const, error: "Admin is required." };

  const [site, user] = await Promise.all([
    prisma.site.findUnique({ where: { id: siteId }, select: { id: true } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    }),
  ]);

  if (!site) return { ok: false as const, error: "Site not found." };
  if (!user || !["ADMIN", "OFFICE"].includes(user.role)) {
    return { ok: false as const, error: "Admin user not found." };
  }

  const existing = await prisma.adminSiteAssignment.findFirst({
    where: { siteId, userId, endsOn: null },
    select: { id: true },
  });

  if (existing) {
    return {
      ok: false as const,
      error: "Admin is already assigned to this site.",
    };
  }

  await prisma.adminSiteAssignment.create({
    data: {
      site: { connect: { id: siteId } },
      user: { connect: { id: userId } },
      startsOn: new Date(),
      endsOn: null,
    },
  });

  revalidateSiteAssignmentPaths(siteId);
  return { ok: true as const };
}

export async function endAdminSiteAssignment(input: {
  assignmentId: string;
  siteId: string;
}) {
  const auth = await requireServerAuth();
  if (auth.role !== "ADMIN") {
    return {
      ok: false as const,
      error: "Only admin can end admin assignments.",
    };
  }

  const assignmentId = String(input.assignmentId ?? "").trim();
  const siteId = String(input.siteId ?? "").trim();

  const assignment = await prisma.adminSiteAssignment.findFirst({
    where: { id: assignmentId, siteId },
    select: { id: true },
  });

  if (!assignment) {
    return { ok: false as const, error: "Admin assignment not found." };
  }

  await prisma.adminSiteAssignment.update({
    where: { id: assignmentId },
    data: { endsOn: new Date() },
  });

  revalidateSiteAssignmentPaths(siteId);
  return { ok: true as const };
}
