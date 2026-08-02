export function joburgTodayISO() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function startOfDayUTC(iso: string) {
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${iso}`);
  return d;
}

export function addDaysUTC(d: Date, days: number) {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

export function isoFromDateUTC(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function weekdayShortLocal(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

export function decimalToNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const maybeDecimal = v as { toNumber?: () => number };
  if (typeof maybeDecimal.toNumber === "function") {
    return maybeDecimal.toNumber();
  }
  const n = Number(v as number | string);
  return Number.isFinite(n) ? n : 0;
}
