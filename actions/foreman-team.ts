"use server";

import { prisma } from "@/lib/prisma";
import { requireServerAuth } from "@/lib/auth-server";
import { writeAuditEvent } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { TeamType } from "@/generated/prisma/client";

const VALID_TEAMS: TeamType[] = ["PAINTERS", "BUILDING", "SPECIAL_COATINGS"];

/**
 * Switch a foreman's default team.
 *
 * Allowed callers: ADMIN or SUPERVISOR.
 * - Updates `Foreman.defaultTeam` to the new value.
 * - Does NOT retroactively change existing scans (they have immutable snapshots).
 * - Writes an AuditEvent for traceability.
 */
export async function switchForemanTeam(input: {
  foremanId: string;
  newTeam: TeamType;
}) {
  const auth = await requireServerAuth();

  if (auth.role !== "ADMIN" && auth.role !== "SUPERVISOR") {
    return {
      ok: false as const,
      error: "Forbidden. Admin or Supervisor only.",
    };
  }

  const foremanId = String(input.foremanId ?? "").trim();
  const newTeam = String(input.newTeam ?? "").trim() as TeamType;

  if (!foremanId) {
    return { ok: false as const, error: "foremanId is required." };
  }
  if (!VALID_TEAMS.includes(newTeam)) {
    return {
      ok: false as const,
      error: `Invalid team. Must be one of: ${VALID_TEAMS.join(", ")}`,
    };
  }

  const foreman = await prisma.foreman.findUnique({
    where: { id: foremanId },
    select: {
      id: true,
      defaultTeam: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });

  if (!foreman) {
    return { ok: false as const, error: "Foreman not found." };
  }

  const oldTeam = foreman.defaultTeam;

  if (oldTeam === newTeam) {
    return {
      ok: true as const,
      message: `Foreman is already on team ${newTeam}.`,
      foreman: { id: foreman.id, defaultTeam: newTeam },
    };
  }

  // Update the foreman's team
  await prisma.foreman.update({
    where: { id: foremanId },
    data: { defaultTeam: newTeam },
  });

  // Audit log (best-effort, never throws)
  await writeAuditEvent({
    actorUserId: auth.userId,
    action: "FOREMAN_TEAM_SWITCH",
    entity: "Foreman",
    entityId: foremanId,
    metadata: {
      title: "Foreman team switched",
      description: `${foreman.user.name ?? foreman.user.email} switched from ${oldTeam} to ${newTeam}`,
      foremanId,
      foremanName: foreman.user.name ?? foreman.user.email,
      oldTeam,
      newTeam,
      changedByUserId: auth.userId,
    },
  });

  revalidatePath("/foreman");
  revalidatePath("/admin");
  revalidatePath("/employees");

  return {
    ok: true as const,
    message: `Team switched from ${oldTeam} to ${newTeam}.`,
    foreman: { id: foreman.id, defaultTeam: newTeam },
  };
}

/**
 * Get a foreman's current team.
 */
export async function getForemanTeam(foremanId: string) {
  const auth = await requireServerAuth();

  if (!["ADMIN", "SUPERVISOR", "FOREMAN"].includes(auth.role)) {
    return { ok: false as const, error: "Forbidden." };
  }

  const foreman = await prisma.foreman.findUnique({
    where: { id: foremanId },
    select: {
      id: true,
      defaultTeam: true,
      user: { select: { name: true } },
    },
  });

  if (!foreman) {
    return { ok: false as const, error: "Foreman not found." };
  }

  return {
    ok: true as const,
    foreman: {
      id: foreman.id,
      defaultTeam: foreman.defaultTeam,
      name: foreman.user.name,
    },
  };
}
