import { prisma } from "./prisma";
import type { TeamType } from "@/generated/prisma/client";

// ─── helpers ───────────────────────────────────────────────────────

type OverrideRow = {
  siteId: string | null;
  startsOn: Date;
  endsOn: Date | null;
  dayRate: unknown;
};

/** Pick the override with the latest startsOn from a list. */
function pickLatest<T extends { startsOn: Date }>(list: T[]): T | null {
  return list.reduce<T | null>((acc, cur) => {
    if (!acc) return cur;
    return cur.startsOn > acc.startsOn ? cur : acc;
  }, null);
}

/** Safely convert a Prisma Decimal / string / number to a JS number (0 if falsy). */
function toNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const d = v as { toNumber?: () => number };
  if (typeof d.toNumber === "function") return d.toNumber();
  const n = Number(v as string);
  return Number.isFinite(n) ? n : 0;
}

// ─── public: team-default look-up ──────────────────────────────────

type CompanySettingsRow = {
  defaultPainterDayRate: unknown;
  defaultBuildingDayRate: unknown;
  defaultSpecialCoatingsDayRate: unknown;
  defaultCapeTownDayRate: unknown;
  defaultEmployeeDayRate: unknown;
};

/**
 * Return the team-specific default rate from CompanySettings.
 * Returns 0 if settings are missing or the team has no configured rate.
 */
export function getTeamDefaultRate(
  team: TeamType,
  settings: CompanySettingsRow | null | undefined,
): number {
  if (!settings) return 0;
  switch (team) {
    case "PAINTERS":
      return toNum(settings.defaultPainterDayRate);
    case "BUILDING":
      return toNum(settings.defaultBuildingDayRate);
    case "SPECIAL_COATINGS":
      return toNum(settings.defaultSpecialCoatingsDayRate);
    case "CAPE_TOWN":
      return toNum(settings.defaultCapeTownDayRate);
    default:
      return 0;
  }
}

// ─── public: compute rate at scan time ─────────────────────────────

export type ComputeDayRateResult = {
  dayRate: number;
  team: TeamType | null;
};

/**
 * Compute the effective day rate for an employee at scan time.
 *
 * Priority (highest → lowest):
 *   1. EmployeeDayRateOverride  (site-specific > global; latest startsOn)
 *   2. SiteForemanDayRateOverride (per-foreman per-site; latest startsOn)
 *   3. Team default from CompanySettings (based on Foreman.defaultTeam)
 *   4. Employee.defaultDayRate
 *   5. Foreman.defaultDayRate
 *   6. CompanySettings.defaultEmployeeDayRate
 *   7. 0  (final fallback — should not happen if settings exist)
 */
export async function computeDayRateAtScan(opts: {
  employeeId: string;
  foremanId: string;
  siteId: string;
  workDate: Date;
}): Promise<ComputeDayRateResult> {
  const { employeeId, foremanId, siteId, workDate } = opts;

  // Build the end-of-day and start-of-day boundaries for the work date.
  // workDate is assumed to be midnight UTC; we compare inclusively.
  const workDateStart = new Date(workDate);
  workDateStart.setUTCHours(0, 0, 0, 0);
  const workDateEnd = new Date(workDate);
  workDateEnd.setUTCHours(23, 59, 59, 999);

  // Parallel: fetch overrides, foreman, employee, company settings
  const [employeeOverrides, foremanSiteOverrides, foreman, employee, settings] =
    await Promise.all([
      // 1) All candidate EmployeeDayRateOverride rows
      (prisma as any).employeeDayRateOverride.findMany({
        where: {
          employeeId,
          startsOn: { lte: workDateEnd },
          OR: [{ endsOn: null }, { endsOn: { gte: workDateStart } }],
        },
        select: {
          siteId: true,
          startsOn: true,
          endsOn: true,
          dayRate: true,
        },
      }) as Promise<OverrideRow[]>,

      // 2) SiteForemanDayRateOverride rows for this foreman + site
      (prisma as any).siteForemanDayRateOverride.findMany({
        where: {
          foremanId,
          siteId,
          startsOn: { lte: workDateEnd },
          OR: [{ endsOn: null }, { endsOn: { gte: workDateStart } }],
        },
        select: {
          startsOn: true,
          dayRate: true,
        },
      }) as Promise<{ startsOn: Date; dayRate: unknown }[]>,

      // 3) Foreman data (defaultDayRate + defaultTeam + userId)
      (prisma as any).foreman.findUnique({
        where: { id: foremanId },
        select: { defaultDayRate: true, defaultTeam: true, userId: true },
      }) as Promise<{
        defaultDayRate: unknown;
        defaultTeam: TeamType;
        userId: string | null;
      } | null>,

      // 4) Employee defaultDayRate + userId
      (prisma as any).employee.findUnique({
        where: { id: employeeId },
        select: { defaultDayRate: true, userId: true },
      }) as Promise<{ defaultDayRate: unknown; userId: string | null } | null>,

      // 5) CompanySettings singleton
      (prisma as any).companySettings.findUnique({
        where: { id: "singleton" },
        select: {
          defaultEmployeeDayRate: true,
          defaultPainterDayRate: true,
          defaultBuildingDayRate: true,
          defaultSpecialCoatingsDayRate: true,
          defaultCapeTownDayRate: true,
        },
      }) as Promise<CompanySettingsRow | null>,
    ]);

  const team: TeamType | null = foreman?.defaultTeam ?? null;

  // Detect self-scan: the employee being scanned IS the foreman.
  // In this case skip the team default rate (Priority 3) — the foreman should
  // receive their personal Foreman.defaultDayRate (Priority 5), not the team
  // rate that applies to their workers.
  const isForemansOwnScan = !!(
    employee?.userId &&
    foreman?.userId &&
    employee.userId === foreman.userId
  );

  // --- Priority 1: EmployeeDayRateOverride ---
  if (employeeOverrides.length > 0) {
    const siteSpecific = employeeOverrides.filter(
      (o) => o.siteId !== null && o.siteId === siteId,
    );
    const global = employeeOverrides.filter((o) => o.siteId === null);

    const chosen = pickLatest(siteSpecific) ?? pickLatest(global);
    if (chosen) {
      const rate = toNum(chosen.dayRate);
      if (rate > 0) return { dayRate: rate, team };
      // If override dayRate is 0/null/invalid, ignore and continue fallback chain
    }
  }

  // --- Priority 2: SiteForemanDayRateOverride ---
  if (foremanSiteOverrides.length > 0) {
    const chosen = pickLatest(foremanSiteOverrides as { startsOn: Date }[]);
    if (chosen) {
      const rate = toNum(
        (chosen as { startsOn: Date; dayRate: unknown }).dayRate,
      );
      if (rate > 0) return { dayRate: rate, team };
    }
  }

  // --- Priority 3: Team default from CompanySettings ---
  // Skipped when the scanned employee is the foreman themselves — they get
  // their personal rate (Priority 4/5), not the team rate for their workers.
  if (team && settings && !isForemansOwnScan) {
    const teamRate = getTeamDefaultRate(team, settings);
    if (teamRate > 0) return { dayRate: teamRate, team };
  }

  // --- Priority 4: Employee.defaultDayRate ---
  if (employee) {
    const empRate = toNum(employee.defaultDayRate);
    if (empRate > 0) return { dayRate: empRate, team };
  }

  // --- Priority 5: Foreman.defaultDayRate ---
  if (foreman) {
    const foremanRate = toNum(foreman.defaultDayRate);
    if (foremanRate > 0) return { dayRate: foremanRate, team };
  }

  // --- Priority 6: CompanySettings.defaultEmployeeDayRate ---
  if (settings) {
    const companyRate = toNum(settings.defaultEmployeeDayRate);
    if (companyRate > 0) return { dayRate: companyRate, team };
  }

  // --- Priority 7: final fallback ---
  if (!settings) {
    console.error(
      "[computeDayRateAtScan] CompanySettings row missing — returning 0",
    );
  }
  return { dayRate: 0, team };
}

// ─── legacy wrapper (for callers that haven't migrated yet) ────────

/**
 * @deprecated Use `computeDayRateAtScan` instead. This wrapper exists only
 * so that call-sites that haven't been updated yet keep compiling.
 */
export async function resolveEmployeeDayRate(opts: {
  employeeId: string;
  workDate: Date;
  siteId?: string | null;
  foremanId?: string | null;
  employeeDefaultRate?: unknown | null;
  companyDefaultRate?: unknown | null;
}): Promise<unknown | null> {
  const { employeeId, workDate, siteId, foremanId } = opts;

  // If foremanId + siteId are available, delegate to the new function
  if (foremanId && siteId) {
    const result = await computeDayRateAtScan({
      employeeId,
      foremanId,
      siteId,
      workDate,
    });
    return result.dayRate > 0 ? result.dayRate : null;
  }

  // Minimal fallback when foreman context is missing (shouldn't happen in
  // production scan flows, but keeps existing admin APIs working).
  const overrides = (await (prisma as any).employeeDayRateOverride.findMany({
    where: {
      employeeId,
      startsOn: { lte: workDate },
      OR: [{ endsOn: null }, { endsOn: { gte: workDate } }],
    },
    select: { siteId: true, startsOn: true, endsOn: true, dayRate: true },
  })) as OverrideRow[];

  const targetSiteId = siteId ?? null;
  const siteSpecific = overrides.filter(
    (o) => o.siteId !== null && o.siteId === targetSiteId,
  );
  const global = overrides.filter((o) => o.siteId === null);
  const chosen = pickLatest(siteSpecific) ?? pickLatest(global);
  if (chosen) {
    const rate = toNum(chosen.dayRate);
    if (rate > 0) return rate;
  }

  // Fall back to supplied defaults
  const empRate = toNum(opts.employeeDefaultRate);
  if (empRate > 0) return empRate;

  const compRate = toNum(opts.companyDefaultRate);
  if (compRate > 0) return compRate;

  return null;
}
