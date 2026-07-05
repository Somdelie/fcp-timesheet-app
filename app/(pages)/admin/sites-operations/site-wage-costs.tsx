import { addDays, currentFortnightSatFri, toISODate } from "@/lib/fortnight";
import { prisma } from "@/lib/prisma";
import { calcSiteCosts } from "@/lib/procurement";
import { addDaysUTC, decimalToNumber, startOfDayUTC } from "@/lib/dateUtc";
import SiteWageCostsClient from "./site-wage-costs-client";

export const dynamic = "force-dynamic";

export type SiteWageCostPeriod = {
  label: string;
  startISO: string;
  endISO: string;
};

export type SiteWageCostRow = {
  id: string;
  code: string | null;
  name: string;
  client: string | null;
  isActive: boolean;
  jobStatus: "NOT_STARTED" | "ONGOING" | "COMPLETED" | "ON_HOLD";
  supervisorName: string | null;
  previousWages: number;
  currentWages: number;
  previousUnpaidOvertime: number;
  currentUnpaidOvertime: number;
  totalWages: number;
  previousScans: number;
  currentScans: number;
};

function previousFortnight(currentStartISO: string): SiteWageCostPeriod {
  const currentStart = new Date(`${currentStartISO}T00:00:00`);
  const previousStart = addDays(currentStart, -14);
  const previousEnd = addDays(currentStart, -1);

  return {
    label: "Previous fortnight",
    startISO: toISODate(previousStart),
    endISO: toISODate(previousEnd),
  };
}

async function periodCosts(period: SiteWageCostPeriod, siteIds: string[]) {
  const start = startOfDayUTC(period.startISO);
  const endExclusive = addDaysUTC(startOfDayUTC(period.endISO), 1);
  return calcSiteCosts(start, endExclusive, siteIds);
}

async function unpaidOvertimeCosts(
  period: SiteWageCostPeriod,
  siteIds: string[],
) {
  if (siteIds.length === 0) return new Map<string, number>();

  const start = startOfDayUTC(period.startISO);
  const endExclusive = addDaysUTC(startOfDayUTC(period.endISO), 1);
  const rows = await prisma.overtimeEntry.groupBy({
    by: ["siteId"],
    where: {
      siteId: { in: siteIds },
      workDate: { gte: start, lt: endExclusive },
      paidAt: null,
    },
    _sum: { totalCost: true },
  });

  return new Map(
    rows.map((row) => [row.siteId, decimalToNumber(row._sum.totalCost)]),
  );
}

export default async function SiteWageCostsPage() {
  const current = currentFortnightSatFri(new Date());
  const periods = {
    previous: previousFortnight(current.startISO),
    current: {
      label: "Current fortnight",
      startISO: current.startISO,
      endISO: current.endISO,
    },
  } satisfies Record<string, SiteWageCostPeriod>;

  const sites = await prisma.site.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      client: true,
      isActive: true,
      jobStatus: true,
      supervisorAssignments: {
        select: {
          supervisor: {
            select: {
              user: { select: { name: true } },
            },
          },
        },
        orderBy: { startsOn: "desc" },
        take: 1,
      },
    },
    orderBy: [{ isActive: "desc" }, { code: "asc" }, { name: "asc" }],
  });

  const siteIds = sites.map((site) => site.id);
  const [
    previousCosts,
    currentCosts,
    previousUnpaidOvertimeBySite,
    currentUnpaidOvertimeBySite,
  ] = await Promise.all([
    periodCosts(periods.previous, siteIds),
    periodCosts(periods.current, siteIds),
    unpaidOvertimeCosts(periods.previous, siteIds),
    unpaidOvertimeCosts(periods.current, siteIds),
  ]);

  const previousBySite = new Map(
    previousCosts.rows.map((row) => [row.siteId, row]),
  );
  const currentBySite = new Map(currentCosts.rows.map((row) => [row.siteId, row]));

  const rows: SiteWageCostRow[] = sites
    .map((site) => {
      const previous = previousBySite.get(site.id);
      const currentRow = currentBySite.get(site.id);
      const previousWages = previous?.wagesCost ?? 0;
      const currentWages = currentRow?.wagesCost ?? 0;
      const previousUnpaidOvertime =
        previousUnpaidOvertimeBySite.get(site.id) ?? 0;
      const currentUnpaidOvertime =
        currentUnpaidOvertimeBySite.get(site.id) ?? 0;

      return {
        id: site.id,
        code: site.code,
        name: site.name,
        client: site.client,
        isActive: site.isActive,
        jobStatus: site.jobStatus,
        supervisorName:
          site.supervisorAssignments[0]?.supervisor.user.name ?? null,
        previousWages,
        currentWages,
        previousUnpaidOvertime,
        currentUnpaidOvertime,
        totalWages: previousWages + currentWages,
        previousScans: previous?.scanCount ?? 0,
        currentScans: currentRow?.scanCount ?? 0,
      };
    })
    .filter(
      (row) =>
        row.previousWages +
          row.currentWages +
          row.previousUnpaidOvertime +
          row.currentUnpaidOvertime >
        0,
    )
    .sort((a, b) => {
      const byWages = b.totalWages - a.totalWages;
      if (byWages !== 0) return byWages;
      return (a.code ?? a.name).localeCompare(b.code ?? b.name);
    });

  return (
    <SiteWageCostsClient
      rows={rows}
      previousPeriod={periods.previous}
      currentPeriod={periods.current}
    />
  );
}
