import type { TimesheetGridModel } from "./gridModel";

type GridRow = TimesheetGridModel["rows"][number];
type Totals = TimesheetGridModel["totals"];

function safeStr(v: unknown) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function safeNum(v: unknown) {
  const n = Number((v as number | string | null | undefined) ?? 0);
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
function extractForemanName(detail: unknown): string {
  const anyDetail = detail as { timesheet?: unknown } | undefined;
  const d = (anyDetail?.timesheet as unknown) ?? detail;

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
  const raw = detail as { timesheet?: unknown } | undefined;
  const d = (raw?.timesheet as unknown) ?? raw;

  const foremanName = extractForemanName(d);

  const columns: TimesheetGridModel["columns"] = (d?.columns ?? []).map(
    (c: unknown) => {
      const col = c as {
        iso?: unknown;
        day?: unknown;
        dayLabel?: unknown;
        dateLabel?: unknown;
        date?: unknown;
      };
      const iso = safeStr(c?.iso);
      const fallbackDay = safeStr(c?.day);
      const fallbackDate = iso.includes("-") ? iso.split("-")[2] : "";

      return {
        iso,
        dayLabel: safeStr(col.dayLabel ?? fallbackDay),
        dateLabel: safeStr(col.dateLabel ?? col.date ?? fallbackDate),
      };
    },
  );

  const colLen = columns.length;

  const rows: TimesheetGridModel["rows"] = (d?.rows ?? []).map((r: unknown) => {
    const row = r as {
      id?: unknown;
      employeeId?: unknown;
      label?: unknown;
      fullName?: unknown;
      dayRate?: unknown;
      present?: unknown;
      daysWorked?: unknown;
      pay?: unknown;
      isForeman?: unknown;
    };

    const label = safeStr(row.label ?? row.fullName ?? "—").trim();

    // Decide foreman row:
    // 1) If API already flags it, use that.
    // 2) Else compare names to foremanName (your mobile logic).
    const isForeman =
      typeof row.isForeman === "boolean"
        ? row.isForeman
        : foremanName
          ? label === foremanName
          : false;

    return {
      id: safeStr(row.id ?? row.employeeId),
      label,
      dayRate: safeNum(row.dayRate),
      present: Array.isArray(row.present)
        ? (row.present as boolean[]).slice(0, colLen)
        : [],
      daysWorked: safeNum(row.daysWorked),
      pay: safeNum(row.pay),
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
