"use client";

import { useMemo } from "react";
import { CircleCheck, X, Shield } from "lucide-react";
import { formatCurrency } from "@/lib/formatCurrency";

interface TimesheetGridProps<T extends { rows?: any[]; columns?: any[] }> {
  data: T;
}

function getDayOfMonth(iso?: string) {
  if (!iso || typeof iso !== "string") return "";
  const parts = iso.split("-");
  return parts[2] ?? "";
}

export default function TimesheetGrid<
  T extends { rows?: any[]; columns?: any[] },
>({ data }: TimesheetGridProps<T>) {
  const rows = (data as any)?.rows ?? [];
  const columns = ((data as any)?.columns ?? []).map((c: any) => ({
    ...c,
    date: c?.date ?? getDayOfMonth(c?.iso),
  }));

  const dayCount = columns.length;

  const sortedRows = useMemo(() => {
    return [...rows].sort((a: any, b: any) => {
      if (a.isForeman === b.isForeman) return 0;
      return a.isForeman ? -1 : 1;
    });
  }, [rows]);

  const totals = useMemo(() => {
    let foremanDays = 0;
    let foremanPay = 0;
    let teamDays = 0;
    let teamPay = 0;

    rows.forEach((r: any) => {
      if (r.isForeman) {
        foremanDays += r.daysWorked ?? 0;
        foremanPay += r.pay ?? 0;
      } else {
        teamDays += r.daysWorked ?? 0;
        teamPay += r.pay ?? 0;
      }
    });

    return {
      foremanDays,
      foremanPay,
      teamDays,
      teamPay,
    };
  }, [rows]);

  return (
    <div className="rounded bg-background w-full max-w-full">
      {/* ONE scroll container */}
      <div className="overflow-x-auto max-w-full">
        {/* This forces horizontal scroll when needed */}
        <div className="w-max">
          {/* HEADER */}
          <div
            className="grid border bg-slate-50 dark:bg-card"
            style={{
              gridTemplateColumns: `220px repeat(${dayCount}, 56px) 70px 70px 100px 100px`,
            }}
          >
            <div className="sticky left-0 z-20 bg-slate-50 dark:bg-card px-3 py-1 font-semibold border border-slate-600">
              Full Name
            </div>

            {columns.map((c: any) => (
              <div
                key={c.iso}
                className="px-2 py-1 text-center font-semibold text-sm border border-slate-600 flex flex-col items-center justify-center"
              >
                <div className="font-black leading-tight tracking-widest">
                  {c.day}
                </div>
                <div className="text-muted-foreground">{c.date}</div>
              </div>
            ))}

            <div className="px-2 py-1 text-center font-semibold border border-slate-600">
              F/man Days
            </div>
            <div className="px-2 py-1 text-center font-semibold border border-slate-600">
              Team Days
            </div>
            <div className="px-2 py-1 text-center font-semibold border border-slate-600">
              F/man Pay
            </div>
            <div className="px-2 py-1 text-center font-semibold border border-slate-600">
              Team Pay
            </div>
          </div>

          {/* ROWS */}
          {sortedRows.map((r: any) => (
            <div
              key={r.employeeId}
              className={[
                "grid border",
                r.isForeman ? "bg-blue-50 dark:bg-blue-950" : "",
              ].join(" ")}
              style={{
                gridTemplateColumns: `220px repeat(${dayCount}, 56px) 70px 70px 100px 100px`,
              }}
            >
              <div
                className={[
                  "sticky left-0 z-10 px-3 py-2 font-medium truncate border border-slate-600 flex items-center gap-2 bg-background",
                  r.isForeman
                    ? "bg-blue-100/50 dark:bg-blue-900/90 font-semibold"
                    : "",
                ].join(" ")}
              >
                {r.isForeman && (
                  <Shield className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
                )}
                {r.fullName}
              </div>

              {(r.present ?? [])
                .slice(0, dayCount)
                .map((p: boolean, idx: number) => (
                  <div
                    key={`${r.employeeId}-${idx}`}
                    className={[
                      "px-2 py-2 text-center flex items-center justify-center border border-slate-600",
                      p ? "bg-emerald-300/30" : "bg-red-200/30",
                    ].join(" ")}
                    title={p ? "Present (scanned)" : "Absent (no scan)"}
                  >
                    {p ? (
                      <CircleCheck className="text-emerald-600" />
                    ) : (
                      <X className="text-red-600" />
                    )}
                  </div>
                ))}

              <div className="px-2 py-2 text-center font-semibold border border-slate-600">
                {r.isForeman ? r.daysWorked : "—"}
              </div>
              <div className="px-2 py-2 text-center font-semibold border border-slate-600">
                {!r.isForeman ? r.daysWorked : "—"}
              </div>
              <div className="px-2 py-2 text-center font-semibold border border-slate-600">
                {r.isForeman ? formatCurrency(r.pay) : "—"}
              </div>
              <div className="px-2 py-2 text-center font-semibold border border-slate-600">
                {!r.isForeman ? formatCurrency(r.pay) : "—"}
              </div>
            </div>
          ))}

          {/* TOTALS */}
          <div
            className="grid bg-slate-50 dark:bg-slate-900 border"
            style={{
              gridTemplateColumns: `220px repeat(${dayCount}, 56px) 70px 70px 100px 100px`,
            }}
          >
            <div className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-900 px-3 py-2 font-bold border-r border-slate-600">
              TOTAL
            </div>

            {columns.map((c: any) => (
              <div key={`t-${c.iso}`} className="px-2 py-2" />
            ))}

            <div className="px-2 py-2 text-center font-bold border-l border-slate-600">
              {totals.foremanDays}
            </div>
            <div className="px-2 py-2 text-center font-bold border-l border-slate-600">
              {totals.teamDays}
            </div>
            <div className="px-2 py-2 text-center font-bold border-l border-slate-600">
              {formatCurrency(totals.foremanPay)}
            </div>
            <div className="px-2 py-2 text-center font-bold border-l border-slate-600">
              {formatCurrency(totals.teamPay)}
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 py-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CircleCheck className="w-4 h-4 text-emerald-500" />
          Present = scanned that day
        </span>
        {" • "}
        <span className="inline-flex items-center gap-1">
          <X className="w-4 h-4 text-red-500" />
          Absent = no scan
        </span>
      </div>
    </div>
  );
}
