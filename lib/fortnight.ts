// lib/fortnight.ts
export type Fortnight = { startISO: string; endISO: string; id: string };

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

/**
 * Fortnight rules:
 * - Weeks run Sat..Fri
 * - Fortnight is 14 days: Sat..Fri, Sat..Fri
 * We anchor to "the most recent Saturday" then define start = that Saturday - (0 or 14) depending on parity.
 *
 * This makes "current fortnight" stable and predictable.
 */
export function currentFortnightSatFri(now = new Date()): Fortnight {
  // JS: Sunday=0, Saturday=6
  const day = now.getDay();

  // Distance back to Saturday (6)
  const backToSat = (day + 1) % 7; // Sat->0, Sun->1, Mon->2 ... Fri->6
  const sat = addDays(
    new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    -backToSat,
  );

  // Choose parity: build a repeating 14-day cycle based on a fixed anchor Saturday.
  // Pick any known Saturday as anchor (e.g., 2026-01-31 was a Saturday).
  // Using 2026-01-31 as the anchor ensures all fortnights run Saturday-Friday
  const anchor = new Date("2026-01-31T00:00:00");
  const daysSince = Math.floor(
    (sat.getTime() - anchor.getTime()) / (24 * 60 * 60 * 1000),
  );
  const mod14 = ((daysSince % 14) + 14) % 14;

  const start = addDays(sat, -mod14); // align to start of this 14-day cycle
  const end = addDays(start, 13); // inclusive end (Fri of week 2)

  const startISO = toISODate(start);
  const endISO = toISODate(end);
  return { startISO, endISO, id: `${startISO}_${endISO}` };
}
