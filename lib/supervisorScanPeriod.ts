import { prisma } from "@/lib/prisma";
import { isoFromDateUTC, joburgTodayISO, startOfDayUTC } from "@/lib/dateUtc";
import { getFortnightForDateUTC } from "@/lib/timesheetPeriods";

export async function validateSupervisorScanDate(workDateISO: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDateISO)) {
    return {
      ok: false as const,
      error: "Invalid work date.",
    };
  }

  let selectedDate: Date;
  try {
    selectedDate = startOfDayUTC(workDateISO);
  } catch {
    return {
      ok: false as const,
      error: "Invalid work date.",
    };
  }

  if (isoFromDateUTC(selectedDate) !== workDateISO) {
    return {
      ok: false as const,
      error: "Invalid work date.",
    };
  }

  const todayISO = joburgTodayISO();
  const today = startOfDayUTC(todayISO);

  const yearCfg = await prisma.timesheetYear.findUnique({
    where: { year: today.getUTCFullYear() },
    select: { anchorSat: true },
  });

  if (!yearCfg) {
    return {
      ok: false as const,
      error: "Current timesheet year is not configured.",
    };
  }

  const current = getFortnightForDateUTC(today, yearCfg.anchorSat);
  if (selectedDate < current.startDate || selectedDate > today) {
    return {
      ok: false as const,
      error: `Scans can only be added from ${current.startISO} through ${todayISO} in the current fortnight.`,
    };
  }

  return {
    ok: true as const,
    date: selectedDate,
    dateISO: workDateISO,
    current,
  };
}
