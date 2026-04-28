export function parseSupervisorTimesheetId(raw: string) {
  // Accepts both the old supervisor format (double underscore, no siteId)
  // and the current admin format (single underscore, with siteId).
  return parseTimesheetId(raw);
}

export function parseTimesheetId(raw: string) {
  // Accepts formats:
  // - YYYY-MM-DD_YYYY-MM-DD__FOREMANID (supervisor format with double underscore, no site)
  // - YYYY-MM-DD_YYYY-MM-DD_FOREMANID_SITEID (admin format with site)
  // - YYYY-MM-DD_YYYY-MM-DD_FOREMANID (legacy admin format without site)
  const str = String(raw ?? "").trim();

  // Try double underscore first (supervisor format, no site)
  const double = str.match(
    /^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})__([a-z0-9]+)$/i,
  );
  if (double)
    return {
      startISO: double[1],
      endISO: double[2],
      foremanId: double[3],
      siteId: null as string | null,
    };

  // Try admin format with site: YYYY-MM-DD_YYYY-MM-DD_FOREMANID_SITEID
  const withSite = str.match(
    /^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})_([a-z0-9]+)_([a-z0-9]+)$/i,
  );
  if (withSite)
    return {
      startISO: withSite[1],
      endISO: withSite[2],
      foremanId: withSite[3],
      siteId: withSite[4],
    };

  // Try legacy admin format without site: YYYY-MM-DD_YYYY-MM-DD_FOREMANID
  const single = str.match(
    /^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})_([a-z0-9]+)$/i,
  );
  if (single)
    return {
      startISO: single[1],
      endISO: single[2],
      foremanId: single[3],
      siteId: null as string | null,
    };

  return null;
}

export function makeSupervisorTimesheetId(
  startISO: string,
  endISO: string,
  foremanId: string,
) {
  return `${startISO}_${endISO}__${foremanId}`;
}
