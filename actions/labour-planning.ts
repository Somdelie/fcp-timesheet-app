"use server";

import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/client";
import { prisma } from "@/lib/prisma";
import { requireServerAuth } from "@/lib/auth-server";
import { writeAuditEvent } from "@/lib/audit";
import { getTeamDefaultRate } from "@/lib/employeeDayRate";

const managementRoles = new Set(["ADMIN", "OFFICE"]);
const paths = ["/admin/labour-planning", "/admin/sites-operations"];
type DayInput = {
  workDate: string;
  peopleCount: number;
  expectedOvertime?: boolean;
};
type TeamInput = {
  teamCode: string;
  foremanId: string;
  overrideSupervisorId?: string | null;
  notes?: string | null;
  days: DayInput[];
};

const text = (value: unknown) => String(value ?? "").trim();
const dateAtMidnight = (value: string) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.valueOf()) ? null : date;
};
const number = (value: unknown) =>
  value instanceof Decimal ? value.toNumber() : Number(value) || 0;
const serialize = (value: unknown) =>
  JSON.parse(
    JSON.stringify(value, (_key, entry) =>
      entry instanceof Decimal
        ? entry.toNumber()
        : entry instanceof Date
          ? entry.toISOString()
          : entry,
    ),
  );
const revalidate = () => paths.forEach((path) => revalidatePath(path));
const activeOn = (row: { startsOn: Date; endsOn: Date | null }, date: Date) =>
  row.startsOn <= date && (!row.endsOn || row.endsOn >= date);
const today = () => {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

async function management() {
  const auth = await requireServerAuth();
  return managementRoles.has(auth.role) ? auth : null;
}
async function approver() {
  const auth = await requireServerAuth();
  return auth.role === "ADMIN" || auth.role === "OFFICE" ? auth : null;
}
async function rateContext() {
  return Promise.all([
    prisma.companyTeamRate.findMany({
      select: { code: true, name: true, dayRate: true },
    }),
    prisma.companySettings.findUnique({ where: { id: "singleton" } }),
  ]);
}
async function suggestedSupervisor(
  siteId: string,
  foremanId: string,
  teamCode: string,
  dates: Date[],
) {
  const min = new Date(Math.min(...dates.map((date) => date.valueOf())));
  const max = new Date(Math.max(...dates.map((date) => date.valueOf())));
  const [foremanLinks, siteLinks] = await Promise.all([
    prisma.supervisorForeman.findMany({
      where: {
        foremanId,
        startsOn: { lte: max },
        OR: [{ endsOn: null }, { endsOn: { gte: min } }],
      },
      select: { supervisorId: true, startsOn: true, endsOn: true },
    }),
    prisma.supervisorSiteAssignment.findMany({
      where: {
        siteId,
        startsOn: { lte: max },
        AND: [
          { OR: [{ team: null }, { team: teamCode }] },
          { OR: [{ endsOn: null }, { endsOn: { gte: min } }] },
        ],
      },
      select: { supervisorId: true, startsOn: true, endsOn: true },
    }),
  ]);
  return (
    foremanLinks.find((foremanLink) =>
      siteLinks.some(
        (siteLink) =>
          siteLink.supervisorId === foremanLink.supervisorId &&
          dates.some(
            (date) => activeOn(foremanLink, date) && activeOn(siteLink, date),
          ),
      ),
    )?.supervisorId ?? null
  );
}
function currentTeamCost(
  team: {
    teamCode: string;
    days: { workDate: Date; peopleCount: number; expectedOvertime: boolean }[];
    changeRequests?: {
      status: string;
      startDate: Date;
      endDate: Date;
      peopleDelta: number;
    }[];
  },
  settings: Parameters<typeof getTeamDefaultRate>[1],
  rates: Parameters<typeof getTeamDefaultRate>[2],
  includeChanges: boolean,
) {
  const rate = getTeamDefaultRate(team.teamCode, settings, rates);
  const currentDay = today();
  const days = team.days.map((day) => {
    const delta =
      includeChanges && day.workDate >= currentDay
        ? (team.changeRequests ?? []).reduce(
            (total, change) =>
              change.status === "APPROVED" &&
              change.startDate <= day.workDate &&
              change.endDate >= day.workDate
                ? total + change.peopleDelta
                : total,
            0,
          )
        : 0;
    const peopleCount = Math.max(0, day.peopleCount + delta);
    return {
      ...day,
      peopleCount,
      changeDelta: delta,
      rate,
      cost: peopleCount * rate,
    };
  });
  return {
    rate,
    days,
    peopleDays: days.reduce((total, day) => total + day.peopleCount, 0),
    cost: days.reduce((total, day) => total + day.cost, 0),
  };
}

export async function getLabourPlanningBootstrap() {
  const auth = await requireServerAuth();
  const [sites, teams, foremen, supervisors] = await Promise.all([
    prisma.site.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
    prisma.companyTeamRate.findMany({
      select: { code: true, name: true, dayRate: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.foreman.findMany({
      select: { id: true, defaultTeam: true, user: { select: { name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.supervisor.findMany({
      select: { id: true, user: { select: { name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
  ]);
  return {
    ok: true as const,
    canManage: managementRoles.has(auth.role),
    canApprove: auth.role === "ADMIN" || auth.role === "OFFICE",
    sites,
    teams: serialize(teams),
    foremen: foremen.map((foreman) => ({
      id: foreman.id,
      name: foreman.user.name ?? "Unnamed foreman",
      defaultTeam: foreman.defaultTeam,
    })),
    supervisors: supervisors.map((supervisor) => ({
      id: supervisor.id,
      name: supervisor.user.name ?? "Unnamed supervisor",
    })),
  };
}

export async function listLabourPlans() {
  await requireServerAuth();
  const plans = await prisma.labourPlan.findMany({
    include: {
      site: { select: { id: true, name: true, code: true } },
      teams: {
        include: {
          days: { orderBy: { workDate: "asc" } },
          foreman: { select: { user: { select: { name: true } } } },
          suggestedSupervisor: { select: { user: { select: { name: true } } } },
          overrideSupervisor: { select: { user: { select: { name: true } } } },
          changeRequests: { where: { status: "APPROVED" } },
        },
        orderBy: { teamNameSnapshot: "asc" },
      },
      approvalSnapshot: true,
    },
    orderBy: [{ startDate: "asc" }, { createdAt: "desc" }],
  });
  const [rates, settings] = await rateContext();
  const scans = plans.length
    ? await prisma.attendanceScan.findMany({
        where: {
          siteId: { in: [...new Set(plans.map((plan) => plan.siteId))] },
          direction: "IN",
          workDate: {
            gte: new Date(
              Math.min(...plans.map((plan) => plan.startDate.valueOf())),
            ),
            lte: new Date(
              Math.max(...plans.map((plan) => plan.endDate.valueOf())),
            ),
          },
        },
        select: { siteId: true, workDate: true, dayRateAtScan: true },
      })
    : [];
  return {
    ok: true as const,
    plans: serialize(
      plans.map((plan) => {
        const costs = plan.teams.map((team) =>
          currentTeamCost(team, settings, rates, true),
        );
        const plannedDates = new Set(
          plan.teams.flatMap((team) =>
            team.days.map((day) => day.workDate.toISOString()),
          ),
        );
        const actuals = new Map<string, { people: number; cost: number }>();
        scans
          .filter(
            (scan) =>
              scan.siteId === plan.siteId &&
              scan.workDate >= plan.startDate &&
              scan.workDate <= plan.endDate,
          )
          .forEach((scan) => {
            const row = actuals.get(scan.workDate.toISOString()) ?? {
              people: 0,
              cost: 0,
            };
            row.people += 1;
            row.cost += number(scan.dayRateAtScan);
            actuals.set(scan.workDate.toISOString(), row);
          });
        const dayCount = Math.max(plannedDates.size, 1);
        const actualPeopleDays = [...actuals.values()].reduce(
          (total, row) => total + row.people,
          0,
        );
        const actualCost = [...actuals.values()].reduce(
          (total, row) => total + row.cost,
          0,
        );
        return {
          ...plan,
          teams: plan.teams.map((team, index) => ({
            ...team,
            currentRate: costs[index].rate,
            plannedPeopleDays: costs[index].peopleDays,
            projectedCost: costs[index].cost,
            days: costs[index].days,
          })),
          plannedPeopleDays: costs.reduce(
            (total, cost) => total + cost.peopleDays,
            0,
          ),
          plannedPeople: Math.round(
            costs.reduce((total, cost) => total + cost.peopleDays, 0) /
              dayCount,
          ),
          projectedCost: costs.reduce((total, cost) => total + cost.cost, 0),
          averageActualPeople: Math.round(actualPeopleDays / dayCount),
          averageActualCost: actualCost / dayCount,
          actualCost,
        };
      }),
    ),
  };
}

export async function createLabourPlan(input: {
  siteId: string;
  title?: string | null;
  reason?: string | null;
  notes?: string | null;
  teams: TeamInput[];
}) {
  const auth = await management();
  if (!auth) return { ok: false as const, error: "Not authorized." };
  const siteId = text(input.siteId);
  const teams = (input.teams ?? []).map((team) => ({
    teamCode: text(team.teamCode),
    foremanId: text(team.foremanId),
    overrideSupervisorId: text(team.overrideSupervisorId) || null,
    notes: text(team.notes) || null,
    days: (team.days ?? []).map((day) => ({
      workDate: dateAtMidnight(day.workDate),
      peopleCount: Math.floor(Number(day.peopleCount)),
      expectedOvertime: Boolean(day.expectedOvertime),
    })),
  }));
  if (
    !siteId ||
    !teams.length ||
    teams.some(
      (team) =>
        !team.teamCode ||
        !team.foremanId ||
        !team.days.length ||
        team.days.some(
          (day) =>
            !day.workDate ||
            !Number.isInteger(day.peopleCount) ||
            day.peopleCount < 0,
        ) ||
        new Set(team.days.map((day) => day.workDate?.toISOString())).size !==
          team.days.length,
    )
  )
    return {
      ok: false as const,
      error:
        "Each team needs a configured team, foreman, and unique valid daily headcounts.",
    };
  const [site, companyTeams, foremen, overrides] = await Promise.all([
    prisma.site.findUnique({ where: { id: siteId }, select: { id: true } }),
    prisma.companyTeamRate.findMany({ select: { code: true, name: true } }),
    prisma.foreman.findMany({
      where: { id: { in: teams.map((team) => team.foremanId) } },
      select: { id: true },
    }),
    prisma.supervisor.findMany({
      where: {
        id: {
          in: teams.flatMap((team) =>
            team.overrideSupervisorId ? [team.overrideSupervisorId] : [],
          ),
        },
      },
      select: { id: true },
    }),
  ]);
  if (
    !site ||
    foremen.length !== new Set(teams.map((team) => team.foremanId)).size ||
    overrides.length !==
      new Set(
        teams.flatMap((team) =>
          team.overrideSupervisorId ? [team.overrideSupervisorId] : [],
        ),
      ).size ||
    teams.some(
      (team) =>
        !companyTeams.some((companyTeam) => companyTeam.code === team.teamCode),
    )
  )
    return {
      ok: false as const,
      error:
        "One or more selected site, team, foreman, or supervisor records no longer exist.",
    };
  const prepared = await Promise.all(
    teams.map(async (team) => ({
      ...team,
      suggestedSupervisorId: await suggestedSupervisor(
        siteId,
        team.foremanId,
        team.teamCode,
        team.days.map((day) => day.workDate!),
      ),
    })),
  );
  const allDays = prepared.flatMap((team) =>
    team.days.map((day) => day.workDate!.valueOf()),
  );
  const plan = await prisma.labourPlan.create({
    data: {
      siteId,
      startDate: new Date(Math.min(...allDays)),
      endDate: new Date(Math.max(...allDays)),
      title: text(input.title) || null,
      reason: text(input.reason) || null,
      notes: text(input.notes) || null,
      createdByUserId: auth.userId,
      teams: {
        create: prepared.map((team) => ({
          teamCode: team.teamCode,
          teamNameSnapshot: companyTeams.find(
            (companyTeam) => companyTeam.code === team.teamCode,
          )!.name,
          foremanId: team.foremanId,
          suggestedSupervisorId: team.suggestedSupervisorId,
          overrideSupervisorId: team.overrideSupervisorId,
          notes: team.notes,
          days: {
            create: team.days.map((day) => ({
              workDate: day.workDate!,
              peopleCount: day.peopleCount,
              expectedOvertime: day.expectedOvertime,
            })),
          },
        })),
      },
    },
  });
  await writeAuditEvent({
    actorUserId: auth.userId,
    action: "LABOUR_PLAN_CREATED",
    entity: "LabourPlan",
    entityId: plan.id,
    metadata: { siteId, teams: teams.length },
  });
  revalidate();
  return { ok: true as const, id: plan.id };
}

export async function transitionLabourPlanStatus(
  planId: string,
  nextStatus: "SUBMITTED" | "APPROVED" | "CANCELLED" | "COMPLETED",
) {
  const auth =
    nextStatus === "APPROVED" ? await approver() : await management();
  if (!auth) return { ok: false as const, error: "Not authorized." };
  const plan = await prisma.labourPlan.findUnique({
    where: { id: text(planId) },
    include: { teams: { include: { days: true } } },
  });
  if (!plan) return { ok: false as const, error: "Labour plan not found." };
  const allowed =
    (plan.status === "DRAFT" &&
      (nextStatus === "SUBMITTED" || nextStatus === "CANCELLED")) ||
    (plan.status === "SUBMITTED" &&
      (nextStatus === "APPROVED" || nextStatus === "CANCELLED")) ||
    (plan.status === "APPROVED" &&
      (nextStatus === "COMPLETED" || nextStatus === "CANCELLED"));
  if (!allowed)
    return { ok: false as const, error: "That status change is not allowed." };
  const [rates, settings] = await rateContext();
  const breakdown = plan.teams.map((team) => ({
    teamId: team.id,
    teamCode: team.teamCode,
    ...currentTeamCost(team, settings, rates, false),
  }));
  const plannedCost = breakdown.reduce((total, team) => total + team.cost, 0);
  const now = new Date();
  await prisma.$transaction(async (transaction) => {
    if (nextStatus === "APPROVED")
      await transaction.labourPlanApprovalSnapshot.create({
        data: {
          planId: plan.id,
          plannedCost,
          rateBreakdown: serialize(breakdown),
        },
      });
    await transaction.labourPlan.update({
      where: { id: plan.id },
      data: {
        status: nextStatus,
        ...(nextStatus === "SUBMITTED"
          ? { submittedByUserId: auth.userId, submittedAt: now }
          : {}),
        ...(nextStatus === "APPROVED"
          ? { approvedByUserId: auth.userId, approvedAt: now }
          : {}),
        ...(nextStatus === "CANCELLED"
          ? { cancelledByUserId: auth.userId, cancelledAt: now }
          : {}),
        ...(nextStatus === "COMPLETED"
          ? { completedByUserId: auth.userId, completedAt: now }
          : {}),
      },
    });
  });
  await writeAuditEvent({
    actorUserId: auth.userId,
    action: `LABOUR_PLAN_${nextStatus}`,
    entity: "LabourPlan",
    entityId: plan.id,
    metadata: { previousStatus: plan.status },
  });
  revalidate();
  return { ok: true as const };
}

export async function createLabourChangeRequest(input: {
  planId: string;
  teamId: string;
  startDate: string;
  endDate: string;
  peopleDelta: number;
  reason: string;
  notes?: string | null;
}) {
  const auth = await management();
  if (!auth) return { ok: false as const, error: "Not authorized." };
  const startDate = dateAtMidnight(input.startDate);
  const endDate = dateAtMidnight(input.endDate);
  const peopleDelta = Math.trunc(Number(input.peopleDelta));
  if (
    !startDate ||
    !endDate ||
    endDate < startDate ||
    !Number.isInteger(peopleDelta) ||
    !peopleDelta ||
    !text(input.reason)
  )
    return {
      ok: false as const,
      error: "Enter valid dates, a non-zero headcount change, and a reason.",
    };
  const plan = await prisma.labourPlan.findUnique({
    where: { id: text(input.planId) },
    include: {
      teams: { where: { id: text(input.teamId) }, include: { days: true } },
    },
  });
  if (
    !plan ||
    plan.status !== "APPROVED" ||
    plan.teams.length !== 1 ||
    !plan.teams[0].days.some(
      (day) => day.workDate >= startDate && day.workDate <= endDate,
    )
  )
    return {
      ok: false as const,
      error: "Changes must target planned days on an approved plan team.",
    };
  const request = await prisma.labourChangeRequest.create({
    data: {
      planId: plan.id,
      teamId: plan.teams[0].id,
      startDate,
      endDate,
      peopleDelta,
      reason: text(input.reason),
      notes: text(input.notes) || null,
      createdByUserId: auth.userId,
    },
  });
  await writeAuditEvent({
    actorUserId: auth.userId,
    action: "LABOUR_CHANGE_REQUEST_CREATED",
    entity: "LabourChangeRequest",
    entityId: request.id,
    metadata: { planId: plan.id, teamId: request.teamId, peopleDelta },
  });
  revalidate();
  return { ok: true as const, id: request.id };
}

export async function transitionLabourChangeRequestStatus(
  requestId: string,
  nextStatus: "SUBMITTED" | "APPROVED" | "REJECTED" | "CANCELLED",
) {
  const auth =
    nextStatus === "APPROVED" ? await approver() : await management();
  if (!auth) return { ok: false as const, error: "Not authorized." };
  const request = await prisma.labourChangeRequest.findUnique({
    where: { id: text(requestId) },
    include: { plan: { select: { status: true } } },
  });
  if (!request || request.plan.status !== "APPROVED")
    return { ok: false as const, error: "Labour change request not found." };
  const allowed =
    (request.status === "DRAFT" &&
      (nextStatus === "SUBMITTED" || nextStatus === "CANCELLED")) ||
    (request.status === "SUBMITTED" &&
      (nextStatus === "APPROVED" ||
        nextStatus === "REJECTED" ||
        nextStatus === "CANCELLED"));
  if (!allowed)
    return {
      ok: false as const,
      error: "That change request status is not allowed.",
    };
  const now = new Date();
  await prisma.labourChangeRequest.update({
    where: { id: request.id },
    data: {
      status: nextStatus,
      ...(nextStatus === "SUBMITTED" ? { submittedAt: now } : {}),
      ...(nextStatus === "APPROVED"
        ? { approvedByUserId: auth.userId, approvedAt: now }
        : {}),
      ...(nextStatus === "REJECTED"
        ? { rejectedByUserId: auth.userId, rejectedAt: now }
        : {}),
    },
  });
  await writeAuditEvent({
    actorUserId: auth.userId,
    action: `LABOUR_CHANGE_REQUEST_${nextStatus}`,
    entity: "LabourChangeRequest",
    entityId: request.id,
    metadata: { previousStatus: request.status },
  });
  revalidate();
  return { ok: true as const };
}
