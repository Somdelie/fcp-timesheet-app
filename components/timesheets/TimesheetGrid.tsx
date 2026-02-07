"use client";

import { useMemo } from "react";
import { CircleCheck, X } from "lucide-react";
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

  const totals = useMemo(() => {
    const totalDays = rows.reduce(
      (s: number, r: any) => s + (r.daysWorked ?? 0),
      0,
    );
    const totalPay = rows.reduce((s: number, r: any) => s + (r.pay ?? 0), 0);
    return { totalDays, totalPay };
  }, [rows]);

  return (
    <div className="rounded bg-background w-full">
      <div className="overflow-x-auto">
        <div className="w-full min-w-[calc(260px+14*56px+60px+140px)]">
          <div className="grid grid-cols-[260px_repeat(14,minmax(0,1fr))_80px_142px] bg-slate-50 dark:bg-card">
            <div className="px-3 py-1 font-semibold border border-slate-600">
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
              Days
            </div>
            <div className="px-2 py-1 text-center font-semibold border border-slate-600">
              Pay
            </div>
          </div>

          {rows.map((r: any) => (
            <div
              key={r.employeeId}
              className="grid grid-cols-[260px_repeat(14,minmax(0,1fr))_80px_142px] border"
            >
              <div className="px-3 py-2 font-medium truncate border border-slate-600">
                {r.fullName}
              </div>

              {r.present.map((p: boolean, idx: number) => (
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
                {r.daysWorked}
              </div>
              <div className="px-2 py-2 text-center font-semibold border border-slate-600">
                {formatCurrency(r.pay)}
              </div>
            </div>
          ))}

          <div className="grid grid-cols-[260px_repeat(14,minmax(0,1fr))_80px_142px] bg-slate-50 dark:bg-slate-900 border">
            <div className="px-3 py-2 font-bold">TOTAL</div>
            {columns.map((c: any) => (
              <div key={`t-${c.iso}`} className="px-2 py-2" />
            ))}
            <div className="px-2 py-2 text-center font-bold">
              {totals.totalDays}
            </div>
            <div className="px-2 py-2 text-center font-bold">
              {formatCurrency(totals.totalPay)}
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
