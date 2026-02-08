import type { TimesheetGridModel } from "./gridModel";

type GridRow = TimesheetGridModel["rows"][number];
type Totals = TimesheetGridModel["totals"];

function safeStr(v: any) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function safeNum(v: any) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Tries hard to find foreman name across ADMIN + SUPERVISOR detail payloads.
 * Supports:
 * - detail.foreman.name
 * - detail.foreman.user.name
 * - detail.timesheet.foreman...
 * - detail.foremanName
 */
function extractForemanName(detail: any): string {
  const d = detail?.timesheet ?? detail;

  const candidates = [
    d?.foreman?.name,
    d?.foreman?.user?.name,
    d?.foremanName,
    d?.foreman?.user?.displayName, // if you ever add it
  ];

  const name = candidates.map(safeStr).find((s) => s.trim().length > 0);
  return (name ?? "").trim();
}

export function normalizeTimesheetToGrid(detail: unknown): TimesheetGridModel {
  const raw = detail as any;
  const d = raw?.timesheet ?? raw;

  const foremanName = extractForemanName(d);

  const columns: TimesheetGridModel["columns"] = (d?.columns ?? []).map(
    (c: any) => {
      const iso = safeStr(c?.iso);
      const fallbackDay = safeStr(c?.day);
      const fallbackDate = iso.includes("-") ? iso.split("-")[2] : "";

      return {
        iso,
        dayLabel: safeStr(c?.dayLabel ?? fallbackDay),
        dateLabel: safeStr(c?.dateLabel ?? c?.date ?? fallbackDate),
      };
    },
  );

  const colLen = columns.length;

  const rows: TimesheetGridModel["rows"] = (d?.rows ?? []).map((r: any) => {
    const label = safeStr(r?.label ?? r?.fullName ?? "—").trim();

    // Decide foreman row:
    // 1) If API already flags it, use that.
    // 2) Else compare names to foremanName (your mobile logic).
    const isForeman =
      typeof r?.isForeman === "boolean"
        ? r.isForeman
        : foremanName
          ? label === foremanName
          : false;

    return {
      id: safeStr(r?.id ?? r?.employeeId),
      label,
      dayRate: safeNum(r?.dayRate),
      present: Array.isArray(r?.present) ? r.present.slice(0, colLen) : [],
      daysWorked: safeNum(r?.daysWorked),
      pay: safeNum(r?.pay),
      isForeman,
    };
  });

  const totals = rows.reduce<Totals>(
    (acc: Totals, r: GridRow) => {
      const days = safeNum(r.daysWorked);
      const pay = safeNum(r.pay);

      acc.totalDays += days;
      acc.totalPay += pay;

      if (r.isForeman) {
        acc.foremanDays += days;
        acc.foremanPay += pay;
      } else {
        acc.teamDays += days;
        acc.teamPay += pay;
      }

      return acc;
    },
    {
      // keep existing totals
      totalDays: 0,
      totalPay: 0,

      // add the mobile totals
      foremanDays: 0,
      foremanPay: 0,
      teamDays: 0,
      teamPay: 0,
    } as Totals,
  );

  return {
    columns,
    rows,
    totals,
    foremanName,
  };
}
