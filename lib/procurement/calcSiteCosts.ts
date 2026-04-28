import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/client";

export interface SiteCostRow {
  siteId: string;
  siteName: string;
  siteCode: string | null;
  siteLocation: string | null;
  materialCost: number;
  wagesCost: number;
  overtimeCost: number;
  projectCost: number;
  scanCount: number;
  // Revenue / profit – placeholders for now
  revenueClaimed: number;
  revenueReceived: number;
  profitOrLoss: number;
  materialPct: number | null;
  wagesPct: number | null;
  profitPct: number | null;
}

export interface SiteCostSummary {
  rows: SiteCostRow[];
  totals: {
    totalMaterialCost: number;
    totalWagesCost: number;
    totalOvertimeCost: number;
    totalProjectCost: number;
    totalRevenueClaimed: number;
    totalRevenueReceived: number;
    totalProfitOrLoss: number;
  };
}

/**
 * Calculate material + wages costs for every active site in a date range.
 *
 * materialCost  = SUM(orderItem.quantity * orderItem.unitPriceAtOrder)
 *                 for orders linked to the site within the period
 * wagesCost     = SUM(attendanceScan.dayRateAtScan) within the period for that site
 * projectCost   = materialCost + wagesCost
 *
 * Revenue and profit fields are set to 0 for now.
 */
export async function calcSiteCosts(
  startDate: Date,
  endDateExclusive: Date,
  siteIds?: string[],
): Promise<SiteCostSummary> {
  // ── Material costs (via SiteProductOrderItem → SiteProductOrder) ──
  const materialWhere: Record<string, unknown> = {
    order: {
      createdAt: { gte: startDate, lt: endDateExclusive },
      ...(siteIds?.length ? { siteId: { in: siteIds } } : {}),
    },
  };

  const materialRows = await prisma.siteProductOrderItem.findMany({
    where: materialWhere,
    select: {
      quantity: true,
      unitPriceAtOrder: true,
      order: { select: { siteId: true } },
    },
  });

  // Group material cost by siteId
  const materialMap = new Map<string, Decimal>();
  for (const item of materialRows) {
    const siteId = item.order.siteId;
    const cost = new Decimal(item.quantity).mul(item.unitPriceAtOrder);
    materialMap.set(
      siteId,
      (materialMap.get(siteId) ?? new Decimal(0)).add(cost),
    );
  }

  // ── Wages costs (via AttendanceScan.dayRateAtScan) ──
  const wagesWhere: Record<string, unknown> = {
    workDate: { gte: startDate, lt: endDateExclusive },
    ...(siteIds?.length ? { siteId: { in: siteIds } } : {}),
  };

  const wageRows = await prisma.attendanceScan.findMany({
    where: wagesWhere,
    select: {
      siteId: true,
      dayRateAtScan: true,
    },
  });

  const wagesMap = new Map<string, Decimal>();
  const scanCountMap = new Map<string, number>();
  for (const scan of wageRows) {
    const siteId = scan.siteId;
    wagesMap.set(siteId, (wagesMap.get(siteId) ?? new Decimal(0)).add(scan.dayRateAtScan));
    scanCountMap.set(siteId, (scanCountMap.get(siteId) ?? 0) + 1);
  }

  // ── Overtime costs (via OvertimeEntry.totalCost) ──
  const overtimeWhere: Record<string, unknown> = {
    workDate: { gte: startDate, lt: endDateExclusive },
    ...(siteIds?.length ? { siteId: { in: siteIds } } : {}),
  };

  const overtimeRows = await prisma.overtimeEntry.findMany({
    where: overtimeWhere,
    select: {
      siteId: true,
      totalCost: true,
    },
  });

  const overtimeMap = new Map<string, Decimal>();
  for (const ot of overtimeRows) {
    const siteId = ot.siteId;
    overtimeMap.set(
      siteId,
      (overtimeMap.get(siteId) ?? new Decimal(0)).add(ot.totalCost),
    );
  }

  // ── Merge into unique siteId set ──
  const allSiteIds = new Set([
    ...materialMap.keys(),
    ...wagesMap.keys(),
    ...overtimeMap.keys(),
  ]);

  // If caller specified siteIds make sure they're all present even if 0
  if (siteIds?.length) {
    for (const id of siteIds) allSiteIds.add(id);
  }

  // Fetch site info
  const sites = await prisma.site.findMany({
    where: { id: { in: [...allSiteIds] } },
    select: { id: true, name: true, code: true, location: true },
  });
  const siteInfoMap = new Map(sites.map((s) => [s.id, s]));

  // ── Build rows ──
  const rows: SiteCostRow[] = [];
  let totalMaterialCost = new Decimal(0);
  let totalWagesCost = new Decimal(0);
  let totalOvertimeCost = new Decimal(0);
  let totalProjectCost = new Decimal(0);

  for (const siteId of allSiteIds) {
    const material = materialMap.get(siteId) ?? new Decimal(0);
    const wages = wagesMap.get(siteId) ?? new Decimal(0);
    const overtime = overtimeMap.get(siteId) ?? new Decimal(0);
    const project = material.add(wages).add(overtime);

    totalMaterialCost = totalMaterialCost.add(material);
    totalWagesCost = totalWagesCost.add(wages);
    totalOvertimeCost = totalOvertimeCost.add(overtime);
    totalProjectCost = totalProjectCost.add(project);

    const projectNum = project.toNumber();
    const info = siteInfoMap.get(siteId);

    rows.push({
      siteId,
      siteName: info?.name ?? "Unknown",
      siteCode: info?.code ?? null,
      siteLocation: info?.location ?? null,
      materialCost: material.toNumber(),
      wagesCost: wages.toNumber(),
      overtimeCost: overtime.toNumber(),
      projectCost: projectNum,
      scanCount: scanCountMap.get(siteId) ?? 0,
      // Revenue & profit — not implemented yet
      revenueClaimed: 0,
      revenueReceived: 0,
      profitOrLoss: 0,
      materialPct:
        projectNum > 0
          ? Math.round((material.toNumber() / projectNum) * 10000) / 100
          : null,
      wagesPct:
        projectNum > 0
          ? Math.round((wages.toNumber() / projectNum) * 10000) / 100
          : null,
      profitPct: null,
    });
  }

  return {
    rows,
    totals: {
      totalMaterialCost: totalMaterialCost.toNumber(),
      totalWagesCost: totalWagesCost.toNumber(),
      totalOvertimeCost: totalOvertimeCost.toNumber(),
      totalProjectCost: totalProjectCost.toNumber(),
      totalRevenueClaimed: 0,
      totalRevenueReceived: 0,
      totalProfitOrLoss: 0,
    },
  };
}
