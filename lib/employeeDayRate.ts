import { prisma } from "./prisma";

// Resolve effective day rate for an employee on a given date/site.
// Rules:
// - Base rate = employee.defaultDayRate ?? companyDefaultRate
// - Active overrides: startsOn <= workDate && (endsOn is null || endsOn >= workDate)
// - If multiple overrides:
//     * Prefer site-specific (siteId matches) over global (siteId null)
//     * Within each group, pick the one with the latest startsOn

type EmployeeOverrideRow = {
  siteId: string | null;
  startsOn: Date;
  endsOn: Date | null;
  dayRate: unknown;
};

export async function resolveEmployeeDayRate(opts: {
  employeeId: string;
  workDate: Date;
  siteId?: string | null;
  foremanId?: string | null;
  employeeDefaultRate?: unknown | null;
  companyDefaultRate?: unknown | null;
}): Promise<unknown | null> {
  const {
    employeeId,
    workDate,
    siteId,
    foremanId,
    employeeDefaultRate,
    companyDefaultRate,
  } = opts;

  const baseRate =
    (employeeDefaultRate as any) ?? (companyDefaultRate as any) ?? null;

  // Fetch active employee-specific overrides for this employee on this date
  const employeeOverrides = (await (
    prisma as any
  ).employeeDayRateOverride.findMany({
    where: {
      employeeId,
      startsOn: { lte: workDate },
      OR: [{ endsOn: null }, { endsOn: { gte: workDate } }],
    },
    select: {
      siteId: true,
      startsOn: true,
      endsOn: true,
      dayRate: true,
    },
  })) as EmployeeOverrideRow[];

  const targetSiteId = siteId ?? null;

  const siteSpecific = employeeOverrides.filter(
    (o) => o.siteId !== null && o.siteId === targetSiteId,
  );
  const global = employeeOverrides.filter((o) => o.siteId === null);

  const pickLatest = <T extends { startsOn: Date }>(list: T[]): T | null =>
    list.reduce<T | null>((acc, cur) => {
      if (!acc) return cur;
      return cur.startsOn > acc.startsOn ? cur : acc;
    }, null);

  // 1) Check for site + foreman overrides (applies to all employees under that foreman on this site)
  if (targetSiteId && foremanId) {
    const sfOverrides = (await (
      prisma as any
    ).siteForemanDayRateOverride.findMany({
      where: {
        siteId: targetSiteId,
        foremanId,
        startsOn: { lte: workDate },
        OR: [{ endsOn: null }, { endsOn: { gte: workDate } }],
      },
      select: {
        startsOn: true,
        endsOn: true,
        dayRate: true,
      },
    })) as { startsOn: Date; endsOn: Date | null; dayRate: unknown }[];

    if (sfOverrides.length) {
      const chosenSiteForeman = pickLatest(sfOverrides);
      if (chosenSiteForeman) {
        return (chosenSiteForeman.dayRate as any) ?? baseRate;
      }
    }
  }

  // 2) Otherwise, fall back to employee-specific overrides (site-specific, then global)
  if (!employeeOverrides.length) return baseRate;

  const chosenEmployee = pickLatest(siteSpecific) ?? pickLatest(global);

  return (chosenEmployee?.dayRate as any) ?? baseRate;
}
