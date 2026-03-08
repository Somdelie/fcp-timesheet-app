import { prisma } from "@/lib/prisma";
import { calcSiteCosts, type SiteCostRow } from "./calcSiteCosts";

export interface FortnightMeetingResult {
  meetingId: string;
  startDate: string;
  endDate: string;
  meetingOn: string;
  rows: FortnightMeetingRowResult[];
  totals: {
    totalMaterialCost: number;
    totalWagesCost: number;
    totalOvertimeCost: number;
    totalProjectCost: number;
  };
}

export interface FortnightMeetingRowResult {
  siteId: string;
  siteName: string;
  materialCost: number;
  wagesCost: number;
  overtimeCost: number;
  projectCost: number;
  materialPct: number | null;
  wagesPct: number | null;
  // Previous meeting comparison
  prevMaterialCost: number | null;
  prevWagesCost: number | null;
  prevProjectCost: number | null;
  materialCostDeltaPct: number | null;
  wagesCostDeltaPct: number | null;
  projectCostDeltaPct: number | null;
}

function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 10000) / 100;
}

/**
 * Generate (or re-generate) a FortnightMeeting snapshot for a custom date range.
 *
 * - Calculates material + wages costs for all active sites in the date range.
 * - Looks up the previous meeting (by endDate) for comparison deltas.
 * - Upserts meeting, rows, and totals atomically.
 */
export async function generateFortnightMeeting(opts: {
  startDate: Date;
  endDate: Date;
  meetingOn: Date;
  createdByUserId?: string;
}): Promise<FortnightMeetingResult> {
  const { startDate, endDate, meetingOn, createdByUserId } = opts;

  // 1. Compute costs for the date range
  const endExclusive = new Date(endDate);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

  const costs = await calcSiteCosts(startDate, endExclusive);

  // 2. Find the previous meeting for comparison (most recent meeting whose endDate < startDate)
  let prevRowMap = new Map<
    string,
    { materialCost: number; wagesCost: number; projectCost: number }
  >();

  const prevMeeting = await prisma.fortnightMeeting.findFirst({
    where: { endDate: { lt: startDate } },
    orderBy: { endDate: "desc" },
    include: { rows: true },
  });
  if (prevMeeting) {
    for (const row of prevMeeting.rows) {
      prevRowMap.set(row.siteId, {
        materialCost: Number(row.materialCost),
        wagesCost: Number(row.wagesCost),
        projectCost: Number(row.projectCost),
      });
    }
  }

  // 3. Build rows with deltas
  const rows: FortnightMeetingRowResult[] = costs.rows.map((r) => {
    const prev = prevRowMap.get(r.siteId);
    return {
      siteId: r.siteId,
      siteName: r.siteName,
      materialCost: r.materialCost,
      wagesCost: r.wagesCost,
      overtimeCost: r.overtimeCost,
      projectCost: r.projectCost,
      materialPct: r.materialPct,
      wagesPct: r.wagesPct,
      prevMaterialCost: prev?.materialCost ?? null,
      prevWagesCost: prev?.wagesCost ?? null,
      prevProjectCost: prev?.projectCost ?? null,
      materialCostDeltaPct: prev
        ? deltaPct(r.materialCost, prev.materialCost)
        : null,
      wagesCostDeltaPct: prev ? deltaPct(r.wagesCost, prev.wagesCost) : null,
      projectCostDeltaPct: prev
        ? deltaPct(r.projectCost, prev.projectCost)
        : null,
    };
  });

  // 4. Upsert meeting + rows + totals in a transaction
  const meeting = await prisma.$transaction(async (tx) => {
    // Delete existing meeting for this date range (if re-generating)
    await tx.fortnightMeeting.deleteMany({
      where: { startDate, endDate },
    });

    // Create meeting with nested rows + totals in one call
    const m = await tx.fortnightMeeting.create({
      data: {
        startDate,
        endDate,
        meetingOn,
        createdByUser: createdByUserId
          ? { connect: { id: createdByUserId } }
          : undefined,
        rows: {
          create: rows.map((row) => ({
            site: { connect: { id: row.siteId } },
            materialCost: row.materialCost,
            wagesCost: row.wagesCost,
            overtimeCost: row.overtimeCost,
            projectCost: row.projectCost,
            materialPct: row.materialPct,
            wagesPct: row.wagesPct,
            prevMaterialCost: row.prevMaterialCost,
            prevWagesCost: row.prevWagesCost,
            prevProjectCost: row.prevProjectCost,
            materialCostDeltaPct: row.materialCostDeltaPct,
            wagesCostDeltaPct: row.wagesCostDeltaPct,
            projectCostDeltaPct: row.projectCostDeltaPct,
          })),
        },
        totals: {
          create: {
            totalMaterialCost: costs.totals.totalMaterialCost,
            totalWagesCost: costs.totals.totalWagesCost,
            totalOvertimeCost: costs.totals.totalOvertimeCost,
            totalProjectCost: costs.totals.totalProjectCost,
          },
        },
      },
    });

    return m;
  });

  return {
    meetingId: meeting.id,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    meetingOn: meetingOn.toISOString(),
    rows,
    totals: {
      totalMaterialCost: costs.totals.totalMaterialCost,
      totalWagesCost: costs.totals.totalWagesCost,
      totalOvertimeCost: costs.totals.totalOvertimeCost,
      totalProjectCost: costs.totals.totalProjectCost,
    },
  };
}
