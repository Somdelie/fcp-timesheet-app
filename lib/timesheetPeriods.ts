// lib/timesheetPeriods.ts

const MS_DAY = 24 * 60 * 60 * 1000;

function startOfDayUTC(d: Date) {
  const x = new Date(d.getTime());
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function addDaysUTC(d: Date, days: number) {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function toISODateUTC(d: Date) {
  return d.toISOString().slice(0, 10);
}

function isSaturdayUTC(d: Date) {
  return d.getUTCDay() === 6;
}

/**
 * Build all 14-day Sat->Fri periods for a given year, based on that year's anchorSat.
 * Rules:
 * - anchorSat must be a Saturday (UTC midnight)
 * - anchorSat must be in the same year you are generating (recommended & enforced here)
 * - periods: anchorSat, anchorSat+14, ... while startDate <= Dec 31 (UTC)
 */
export function buildYearFortnightsUTC(year: number, anchorSat: Date) {
  const anchor = startOfDayUTC(anchorSat);

  if (!isSaturdayUTC(anchor)) {
    throw new Error("Anchor must be a Saturday (UTC)");
  }

  const anchorYear = anchor.getUTCFullYear();
  if (anchorYear !== year) {
    throw new Error(
      `Anchor year mismatch: anchor is ${anchorYear} but requested year is ${year}`,
    );
  }

  const yearStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const yearEnd = new Date(Date.UTC(year, 11, 31, 0, 0, 0, 0));

  // Start exactly at anchor (admin decides where the year schedule starts)
  let start = new Date(anchor.getTime());

  // If anchor is before Jan 1 (shouldn't happen due to year check), push forward
  while (start.getTime() < yearStart.getTime()) {
    start = addDaysUTC(start, 14);
  }

  const periods: Array<{
    startDate: Date;
    endDate: Date;
    startISO: string;
    endISO: string;
    label: string;
  }> = [];

  while (start.getTime() <= yearEnd.getTime()) {
    const end = addDaysUTC(start, 13); // Friday
    const startISO = toISODateUTC(start);
    const endISO = toISODateUTC(end);

    periods.push({
      startDate: start,
      endDate: end,
      startISO,
      endISO,
      label: `${startISO}_${endISO}`,
    });

    start = addDaysUTC(start, 14);
  }

  return periods;
}

/**
 * Resolve the fortnight for a date using the year's anchorSat.
 * Returns the fortnight START (Saturday) and END (Friday).
 */
export function getFortnightForDateUTC(date: Date, anchorSat: Date) {
  const anchor = startOfDayUTC(anchorSat);
  if (!isSaturdayUTC(anchor)) throw new Error("Anchor must be Saturday (UTC)");

  const d = startOfDayUTC(date);

  // diffDays can be negative
  const diffDays = Math.floor((d.getTime() - anchor.getTime()) / MS_DAY);

  // if date is inside anchor fortnight => k=0, start=anchor
  // if date before anchor => k negative
  const k = Math.floor(diffDays / 14);
  const start = addDaysUTC(anchor, k * 14);
  const end = addDaysUTC(start, 13);

  return {
    startDate: start,
    endDate: end,
    startISO: toISODateUTC(start),
    endISO: toISODateUTC(end),
    id: `${toISODateUTC(start)}_${toISODateUTC(end)}`,
  };
}

/**
 * Resolve the "current" 14-day fortnight window (end exclusive) as of `today`.
 * Uses the year's anchorSat when available; falls back to the most recent
 * Saturday when it isn't configured. `today` must already be UTC-midnight.
 *
 * This fallback is intentionally lenient (dashboard/reporting use only) —
 * period-generation routes require anchorSat and throw instead of guessing.
 */
export function getCurrentFortnightRange(
  today: Date,
  anchorSat: Date | null | undefined,
) {
  if (anchorSat) {
    const fortnight = getFortnightForDateUTC(today, anchorSat);
    return {
      startDate: fortnight.startDate,
      endDate: addDaysUTC(fortnight.startDate, 14),
    };
  }

  const backToSat = (today.getUTCDay() + 1) % 7; // Sat->0, Sun->1, Mon->2 ... Fri->6
  const startDate = addDaysUTC(today, -backToSat);
  return { startDate, endDate: addDaysUTC(startDate, 14) };
}

/**
 * Resolve the "current week" start (Sat) within the current fortnight, for
 * the weekly attendance chart: week 2 once `today` reaches its start, else
 * week 1. `today` must already be UTC-midnight.
 */
export function getCurrentWeekStart(
  today: Date,
  anchorSat: Date | null | undefined,
) {
  const { startDate: fnStart } = getCurrentFortnightRange(today, anchorSat);
  if (!anchorSat) return fnStart;

  const week2Start = addDaysUTC(fnStart, 7);
  return today.getTime() >= week2Start.getTime() ? week2Start : fnStart;
}
