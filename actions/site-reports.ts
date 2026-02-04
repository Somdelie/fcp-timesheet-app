// actions/site-reports.ts
"use server";

import { prisma } from "@/lib/prisma";
import { requireServerAuth } from "@/lib/auth-server";
import { requireCanManageSite } from "@/lib/guards";
import { parseWorkDate, toISODate } from "@/lib/workdate";

function decimalToNumber(d: any) {
  if (d?.toNumber) return d.toNumber();
  const n = Number(String(d));
  return Number.isFinite(n) ? n : 0;
}

export async function getSiteWageTotals(input: {
  siteId: string;
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}) {
  const auth = await requireServerAuth();
  await requireCanManageSite(auth, input.siteId);

  const siteId = String(input.siteId);
  const from = parseWorkDate(input.from);
  const to = parseWorkDate(input.to);

  if (!from || !to) return { ok: false as const, error: "Invalid date range." };

  const toPlus = new Date(to.getTime() + 24 * 60 * 60 * 1000);

  // Pull SiteDays with scans so we can compute:
  // - daily totals
  // - foreman totals
  const siteDays = await prisma.siteDay.findMany({
    where: { siteId, workDate: { gte: from, lt: toPlus } },
    orderBy: { workDate: "asc" },
    select: {
      id: true,
      workDate: true,
      foremanId: true,
      foreman: { select: { user: { select: { name: true } } } },
      scans: {
        select: { id: true, employeeId: true, dayRateAtScan: true },
      },
    },
  });

  const byDay = new Map<
    string,
    { date: string; workers: number; wages: number }
  >();
  const byForeman = new Map<
    string,
    {
      foremanId: string;
      name: string;
      days: number;
      workers: number;
      wages: number;
    }
  >();

  for (const sd of siteDays) {
    const day = toISODate(sd.workDate);
    const scans = sd.scans ?? [];
    const wages = scans.reduce(
      (acc, s) => acc + decimalToNumber(s.dayRateAtScan),
      0,
    );
    const workers = scans.length;

    const dayRow = byDay.get(day) ?? { date: day, workers: 0, wages: 0 };
    dayRow.workers += workers;
    dayRow.wages += wages;
    byDay.set(day, dayRow);

    const fName = sd.foreman.user.name ?? "Foreman";
    const fRow = byForeman.get(sd.foremanId) ?? {
      foremanId: sd.foremanId,
      name: fName,
      days: 0,
      workers: 0,
      wages: 0,
    };
    fRow.days += 1;
    fRow.workers += workers;
    fRow.wages += wages;
    byForeman.set(sd.foremanId, fRow);
  }

  const daily = Array.from(byDay.values());
  const foremen = Array.from(byForeman.values()).sort(
    (a, b) => b.wages - a.wages,
  );

  const totalWages = daily.reduce((a, r) => a + r.wages, 0);
  const totalWorkers = daily.reduce((a, r) => a + r.workers, 0);
  const totalDays = siteDays.length;

  return {
    ok: true as const,
    range: { from: input.from, to: input.to },
    totals: {
      totalDays,
      totalWorkers,
      totalWages: Number(totalWages.toFixed(2)),
    },
    daily: daily.map((d) => ({ ...d, wages: Number(d.wages.toFixed(2)) })),
    foremen: foremen.map((f) => ({ ...f, wages: Number(f.wages.toFixed(2)) })),
  };
}
