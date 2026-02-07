export function formatCurrency(n?: number | null) {
  const x = Number(n ?? 0);
  if (!Number.isFinite(x)) return "0.00";
  return x.toFixed(2);
}

// IMPORTANT: format in UTC so you don’t get “day shift”
export function prettyRangeUTC(startISO: string, endISO: string) {
  const a = new Date(`${startISO}T00:00:00.000Z`);
  const b = new Date(`${endISO}T00:00:00.000Z`);
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  return `${fmt(a)} – ${fmt(b)}`;
}

export function dayNumberUTC(iso: string) {
  const d = new Date(`${iso}T00:00:00.000Z`);
  return String(d.getUTCDate()).padStart(2, "0");
}

export function safeError(e: unknown) {
  if (e instanceof Error) return e.message;
  return "Request failed.";
}
