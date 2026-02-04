// lib/workdate.ts
export function parseWorkDate(input: string) {
  // Expect "YYYY-MM-DD"
  const s = String(input ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;

  // Store as midnight UTC for consistency across servers/timezones
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function toISODate(d: Date) {
  // "YYYY-MM-DD"
  return d.toISOString().slice(0, 10);
}
