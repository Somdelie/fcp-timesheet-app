"use client";

import * as React from "react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrendingUp, Loader2, Calendar as CalendarIcon } from "lucide-react";
import { getSiteWageTotals } from "@/actions/site-reports";

interface WageData {
  totals: {
    totalDays: number;
    totalWorkers: number;
    totalWages: number;
  };
  daily: Array<{
    date: string;
    workers: number;
    wages: number;
  }>;
  foremen: Array<{
    foremanId: string;
    name: string;
    wages: number;
    days: number;
    workers: number;
  }>;
}

function Card({
  title,
  description,
  children,
  icon: Icon,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded border border-slate-200/50 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/40 backdrop-blur-sm p-6 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center gap-3 mb-6">
        {Icon && <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              {description}
            </p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

function formatCurrency(amount: number): string {
  return `R ${amount.toFixed(2)}`;
}

export default function SiteTotalsPanel({ siteId }: { siteId: string }) {
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [data, setData] = React.useState<WageData | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleGenerate = async () => {
    if (!from.trim()) {
      toast.error("Please select a start date");
      return;
    }
    if (!to.trim()) {
      toast.error("Please select an end date");
      return;
    }

    setLoading(true);
    try {
      const res = await getSiteWageTotals({ siteId, from, to });

      if (!res.ok) {
        toast.error(res.error || "Failed to generate report");
        return;
      }

      setData(res as WageData);
      toast.success("Report generated successfully");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      title="Wage Totals"
      description="Calculate site wages by date range"
      icon={TrendingUp}
    >
      <div className="space-y-6">
        {/* Date Range Selector */}
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
              Start Date
            </label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              disabled={loading}
              className="dark:bg-slate-800/50 dark:border-slate-700/50 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
              End Date
            </label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              disabled={loading}
              className="dark:bg-slate-800/50 dark:border-slate-700/50 dark:text-white"
            />
          </div>
          <div className="flex flex-col justify-end">
            <Button
              onClick={handleGenerate}
              disabled={loading}
              className="gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="hidden sm:inline">Generating...</span>
                </>
              ) : (
                <>
                  <CalendarIcon className="h-4 w-4" />
                  Generate
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Results */}
        {!data ? (
          <div className="rounded border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/20 p-8 text-center">
            <CalendarIcon className="mx-auto h-8 w-8 text-slate-400 dark:text-slate-600 mb-2" />
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Select a date range and generate to see wage totals
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded border border-blue-200/30 dark:border-blue-500/20 bg-blue-50/40 dark:bg-blue-500/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                  Total Days
                </p>
                <p className="mt-2 text-2xl font-bold text-blue-900 dark:text-blue-200">
                  {data.totals.totalDays}
                </p>
              </div>

              <div className="rounded border border-emerald-200/30 dark:border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-500/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Worker Scans
                </p>
                <p className="mt-2 text-2xl font-bold text-emerald-900 dark:text-emerald-200">
                  {data.totals.totalWorkers}
                </p>
              </div>

              <div className="rounded border border-violet-200/30 dark:border-violet-500/20 bg-violet-50/40 dark:bg-violet-500/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-400">
                  Total Wages
                </p>
                <p className="mt-2 text-2xl font-bold text-violet-900 dark:text-violet-200">
                  {formatCurrency(data.totals.totalWages)}
                </p>
              </div>
            </div>

            {/* Daily Breakdown */}
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
                Daily Breakdown
              </h3>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {data.daily.map((d) => (
                  <div
                    key={d.date}
                    className="rounded border border-slate-200/30 dark:border-slate-700/30 bg-slate-50/30 dark:bg-slate-800/20 p-4 transition-all hover:shadow-md"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                          {new Date(d.date).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                        <p className="mt-2 font-mono text-xs text-slate-700 dark:text-slate-300">
                          {d.workers} scans
                        </p>
                      </div>
                      <div className="rounded bg-violet-100/50 dark:bg-violet-500/10 px-3 py-2">
                        <p className="text-xs font-bold text-violet-700 dark:text-violet-400">
                          {formatCurrency(d.wages)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Foreman Breakdown */}
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
                By Foreman
              </h3>
              <div className="space-y-2">
                {data.foremen.map((f) => (
                  <div
                    key={f.foremanId}
                    className="rounded border border-slate-200/30 dark:border-slate-700/30 bg-slate-50/30 dark:bg-slate-800/20 p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="truncate font-semibold text-slate-900 dark:text-white">
                          {f.name}
                        </h4>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                          {f.days} day{f.days !== 1 ? "s" : ""} • {f.workers}{" "}
                          worker scans
                        </p>
                      </div>
                      <div className="rounded bg-violet-100/50 dark:bg-violet-500/10 px-4 py-2">
                        <p className="font-bold text-violet-700 dark:text-violet-400">
                          {formatCurrency(f.wages)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer Note */}
            <div className="rounded border border-slate-200/50 dark:border-slate-700/50 bg-slate-50/30 dark:bg-slate-800/20 p-4">
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                <span className="font-semibold text-slate-900 dark:text-slate-200">
                  Note:
                </span>{" "}
                These totals are calculated based on
                AttendanceScan.dayRateAtScan, reflecting the wage rate that was
                active at the time of each scan.
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
