"use client";

import * as React from "react";
import { useMemo } from "react";
import { CircleCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatCurrency";

// ✅ Use the real normalized model shape
type GridColumn = {
  iso: string;
  dayLabel: string;
  dateLabel: string;
};

type GridRow = {
  id: string;
  label: string;
  present: boolean[];
  daysWorked: number;
  pay: number;
  isForeman?: boolean;
};

type GridTotals = {
  totalDays: number;
  totalPay: number;
  foremanDays: number;
  foremanPay: number;
  teamDays: number;
  teamPay: number;
};

export type TimesheetGridModel = {
  columns: GridColumn[];
  rows: GridRow[];
  totals: GridTotals;
  foremanName?: string;
};

function toNum(v: any) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function safeStr(v: any) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function ZeroCell({ text = "0" }: { text?: string }) {
  return (
    <span className="font-extrabold text-rose-600 dark:text-rose-400">
      {text}
    </span>
  );
}

function cellBase(cls?: string) {
  return [
    "px-3 py-2 text-sm whitespace-nowrap border-r border-muted-foreground border-2",
    cls ?? "",
  ].join(" ");
}

function headBase(cls?: string) {
  return [
    "px-3 py-2 text-xs font-semibold uppercase tracking-wide whitespace-nowrap border-r border-muted-foreground border-2",
    "bg-sky-50/60 dark:bg-zinc-800/30 text-zinc-700 dark:text-zinc-200 text-left",
    cls ?? "",
  ].join(" ");
}

/**
 * Accepts either:
 * - { model: TimesheetGridModel }
 * - { data: TimesheetGridModel } (legacy)
 */
export default function TimesheetGrid({
  model,
  data,
}: {
  model?: TimesheetGridModel | null;
  data?: any;
}) {
  const m = (model ?? data ?? null) as TimesheetGridModel | null;

  const columns = Array.isArray(m?.columns) ? m!.columns : [];
  const rowsRaw = Array.isArray(m?.rows) ? m!.rows : [];
  const totals = m?.totals;

  const foremanName = safeStr(m?.foremanName).trim();
  const colLen = columns.length;

  const rows = useMemo(() => {
    const list = [...rowsRaw];

    const isForemanRow = (r: GridRow) => {
      if (typeof r.isForeman === "boolean") return r.isForeman;
      if (foremanName && safeStr(r.label).trim() === foremanName) return true;
      return false;
    };

    // mobile: foreman first, then alpha
    list.sort((a, b) => {
      const aF = isForemanRow(a) ? 0 : 1;
      const bF = isForemanRow(b) ? 0 : 1;
      if (aF !== bF) return aF - bF;
      return safeStr(a.label).localeCompare(safeStr(b.label));
    });

    return list;
  }, [rowsRaw, foremanName]);

  const derivedTotals = useMemo(() => {
    // Prefer server/normalizer totals (should exist now)
    if (
      totals &&
      typeof totals.foremanDays === "number" &&
      typeof totals.teamDays === "number"
    ) {
      return totals;
    }

    // fallback defensive compute (never trust UI state in prod)
    let foremanDays = 0;
    let foremanPay = 0;
    let teamDays = 0;
    let teamPay = 0;

    rowsRaw.forEach((r) => {
      const isForeman =
        typeof r.isForeman === "boolean"
          ? r.isForeman
          : foremanName
            ? safeStr(r.label).trim() === foremanName
            : false;

      const d = toNum(r.daysWorked);
      const p = toNum(r.pay);

      if (isForeman) {
        foremanDays += d;
        foremanPay += p;
      } else {
        teamDays += d;
        teamPay += p;
      }
    });

    return {
      totalDays: foremanDays + teamDays,
      totalPay: foremanPay + teamPay,
      foremanDays,
      foremanPay,
      teamDays,
      teamPay,
    } as GridTotals;
  }, [totals, rowsRaw, foremanName]);

  const hasData = columns.length > 0 && rows.length > 0;

  if (!hasData) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No timesheet rows to display.
      </div>
    );
  }

  const W_NAME = "min-w-[200px]";
  const W_DAY = "min-w-[56px]";
  const W_TDAYS = "min-w-[90px]";
  const W_TPAY = "min-w-[120px]";

  const isForemanRow = (r: GridRow) => {
    if (typeof r.isForeman === "boolean") return r.isForeman;
    if (foremanName && safeStr(r.label).trim() === foremanName) return true;
    return false;
  };

  // pad present[] to columns length so table is always aligned
  const presentAt = (r: GridRow, idx: number) =>
    Boolean(Array.isArray(r.present) ? r.present[idx] : false);

  return (
    <div className="w-full">
      <div className="rounded border-gray-300 border-2 overflow-hidden">
        <div className="overflow-x-auto pb-4">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-muted-foreground dark:border-muted-foreground bg-sky-600 dark:bg-card text-white">
                <th className={[headBase(), W_NAME].join(" ")}>Full Name</th>

                {columns.map((c) => (
                  <th
                    key={c.iso}
                    className={[headBase("text-center"), W_DAY].join(" ")}
                  >
                    <div className="flex flex-col items-center leading-tight">
                      <span className="font-extrabold">
                        {c.dayLabel || "—"}
                      </span>
                      <span className="text-[11px] font-medium text-muted-foreground dark:text-muted-foreground">
                        {c.dateLabel || ""}
                      </span>
                    </div>
                  </th>
                ))}

                {/* Mobile-style extra columns */}
                <th
                  className={[
                    headBase("text-center bg-amber-50/70 dark:bg-amber-950/20"),
                    W_TDAYS,
                  ].join(" ")}
                >
                  F/man Days
                </th>
                <th
                  className={[
                    headBase("text-center bg-amber-50/70 dark:bg-amber-950/20"),
                    W_TDAYS,
                  ].join(" ")}
                >
                  Man/Days
                </th>
                <th
                  className={[
                    headBase(
                      "text-center bg-emerald-50/70 dark:bg-emerald-950/20",
                    ),
                    W_TPAY,
                  ].join(" ")}
                >
                  F/man Pay
                </th>
                <th
                  className={[
                    headBase(
                      "text-center bg-emerald-50/70 dark:bg-emerald-950/20",
                    ),
                    W_TPAY,
                  ].join(" ")}
                >
                  Team Pay
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => {
                const isForeman = isForemanRow(r);

                const daysWorked = toNum(r.daysWorked);
                const pay = toNum(r.pay);

                const foremanDaysCell = isForeman ? (
                  <span className="font-extrabold">{daysWorked}</span>
                ) : (
                  <ZeroCell />
                );
                const teamDaysCell = !isForeman ? (
                  <span className="font-extrabold">{daysWorked}</span>
                ) : (
                  <ZeroCell />
                );

                const foremanPayCell = isForeman ? (
                  <span className="font-extrabold">{formatCurrency(pay)}</span>
                ) : (
                  <ZeroCell />
                );
                const teamPayCell = !isForeman ? (
                  <span className="font-extrabold">{formatCurrency(pay)}</span>
                ) : (
                  <ZeroCell />
                );

                return (
                  <tr
                    key={r.id}
                    className={[
                      "border-b border-muted-foreground border-2",
                      "hover:bg-muted-foreground/10 dark:hover:bg-muted-foreground/20 transition-colors",
                    ].join(" ")}
                  >
                    <td
                      className={[
                        cellBase("font-medium"),
                        W_NAME,
                        isForeman ? "bg-sky-50/70 dark:bg-sky-600/50" : "",
                      ].join(" ")}
                    >
                      <div className="flex items-center gap-2">
                        <span className={isForeman ? "font-extrabold" : ""}>
                          {isForeman ? `👨‍💼 ${r.label}` : r.label}
                        </span>
                      </div>
                    </td>

                    {Array.from({ length: colLen }).map((_, idx) => {
                      const p = presentAt(r, idx);
                      return (
                        <td
                          key={`${r.id}-${columns[idx]?.iso ?? idx}`}
                          className={[
                            cellBase("text-center"),
                            W_DAY,
                            p
                              ? "bg-emerald-500 dark:bg-green-500"
                              : "bg-rose-500/20 dark:bg-gray-200/50",
                          ].join(" ")}
                        >
                          {p ? (
                            <CircleCheck className="inline-block h-5 w-5 text-emerald-600" />
                          ) : (
                            <img
                              src="/absent.svg"
                              alt="Absent"
                              className="inline-block h-5 w-5"
                            />
                          )}
                        </td>
                      );
                    })}

                    <td
                      className={[
                        cellBase(
                          "text-center bg-sky-600/70 dark:bg-amber-950/20",
                        ),
                        W_TDAYS,
                      ].join(" ")}
                    >
                      {foremanDaysCell}
                    </td>

                    <td
                      className={[
                        cellBase(
                          "text-center bg-sky-600/70 dark:bg-amber-950/20",
                        ),
                        W_TDAYS,
                      ].join(" ")}
                    >
                      {teamDaysCell}
                    </td>

                    <td
                      className={[
                        cellBase(
                          "text-center bg-sky-600/70 dark:bg-emerald-950/20",
                        ),
                        W_TPAY,
                      ].join(" ")}
                    >
                      {foremanPayCell}
                    </td>

                    <td
                      className={[
                        cellBase(
                          "text-center bg-sky-600/70 dark:bg-emerald-950/20",
                        ),
                        W_TPAY,
                      ].join(" ")}
                    >
                      {teamPayCell}
                    </td>
                  </tr>
                );
              })}

              {/* TOTAL row (mobile style) */}
              <tr className="bg-sky-600/70 dark:bg-card ">
                <td
                  className={[
                    cellBase("font-extrabold text-zinc-700 dark:text-zinc-200"),
                    W_NAME,
                  ].join(" ")}
                >
                  TOTAL
                </td>

                {columns.map((c) => (
                  <td
                    key={`t-${c.iso}`}
                    className={[
                      "px-3 py-2 text-sm whitespace-nowrap text-zinc-700 dark:text-zinc-200 border-b-2 border-muted-foreground bg-sky-700/70 dark:bg-card",
                      W_DAY,
                    ].join(" ")}
                  ></td>
                ))}

                <td
                  className={[
                    cellBase(
                      "text-center font-extrabold text-zinc-700 dark:text-zinc-200 border-l-2 border-card ",
                    ),
                    W_TDAYS,
                  ].join(" ")}
                >
                  {derivedTotals.foremanDays}
                </td>
                <td
                  className={[
                    cellBase(
                      "text-center font-extrabold text-zinc-700 dark:text-zinc-200",
                    ),
                    W_TDAYS,
                  ].join(" ")}
                >
                  {derivedTotals.teamDays}
                </td>
                <td
                  className={[
                    cellBase(
                      "text-center font-extrabold text-zinc-700 dark:text-zinc-200",
                    ),
                    W_TPAY,
                  ].join(" ")}
                >
                  {formatCurrency(derivedTotals.foremanPay)}
                </td>
                <td
                  className={[
                    cellBase(
                      "text-center font-extrabold text-zinc-700 dark:text-zinc-200",
                    ),
                    W_TPAY,
                  ].join(" ")}
                >
                  {formatCurrency(derivedTotals.teamPay)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="p-3 text-xs text-muted-foreground border-t border-zinc-200/70 dark:border-zinc-700/60">
          ✅ Present = scanned that day • ❌ Absent = no scan
        </div>
      </div>
    </div>
  );
}
