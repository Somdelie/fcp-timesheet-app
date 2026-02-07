export function parseSupervisorTimesheetId(raw: string) {
  // YYYY-MM-DD_YYYY-MM-DD__FOREMANID
  const m = String(raw ?? "")
    .trim()
    .match(/^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})__([a-z0-9]+)$/i);

  if (!m) return null;
  return { startISO: m[1], endISO: m[2], foremanId: m[3] };
}

export function makeSupervisorTimesheetId(
  startISO: string,
  endISO: string,
  foremanId: string,
) {
  return `${startISO}_${endISO}__${foremanId}`;
}
