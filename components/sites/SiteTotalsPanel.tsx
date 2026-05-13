"use client";

import * as React from "react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrendingUp, Loader2, Calendar as CalendarIcon } from "lucide-react";

interface CostData {
  siteId: string;
  materialCost: number;
  wagesCost: number;
  overtimeCost: number;
  projectCost: number;
  materialPct: number | null;
  wagesPct: number | null;
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
  return `R ${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function fetchCosts(siteId: string, from?: string, to?: string): Promise<CostData> {
  const params = new URLSearchParams();
  if (from && to) {
    params.set("from", from);
    params.set("to", to);
  }
  const url = `/api/app/admin/sites/${siteId}/costs${params.size ? `?${params}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load costs");
  const json = await res.json();
  return json.data as CostData;
}

export default function SiteTotalsPanel({ siteId }: { siteId: string }) {
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [data, setData] = React.useState<CostData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [label, setLabel] = React.useState("All time");

  // Load all-time on mount
  React.useEffect(() => {
    fetchCosts(siteId)
      .then(setData)
      .catch(() => toast.error("Failed to load site costs"))
      .finally(() => setLoading(false));
  }, [siteId]);

  const handleFilter = async () => {
    if (!from.trim() || !to.trim()) {
      toast.error("Please select both start and end dates");
      return;
    }
    setLoading(true);
    try {
      const result = await fetchCosts(siteId, from, to);
      setData(result);
      setLabel(`${from} → ${to}`);
    } catch {
      toast.error("Failed to load costs");
    } finally {
      setLoading(false);
    }
  };

  const handleClearFilter = async () => {
    setFrom("");
    setTo("");
    setLoading(true);
    try {
      const result = await fetchCosts(siteId);
      setData(result);
      setLabel("All time");
    } catch {
      toast.error("Failed to load costs");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      title="Project Costs"
      description={`Cost totals: ${label}`}
      icon={TrendingUp}
    >
      <div className="space-y-6">
        {/* Date Range Filter */}
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
              From
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
              To
            </label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              disabled={loading}
              className="dark:bg-slate-800/50 dark:border-slate-700/50 dark:text-white"
            />
          </div>
          <div className="flex flex-col justify-end gap-2">
            <Button onClick={handleFilter} disabled={loading} className="gap-2">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CalendarIcon className="h-4 w-4" />
              )}
              Filter
            </Button>
          </div>
          <div className="flex flex-col justify-end">
            <Button
              variant="outline"
              onClick={handleClearFilter}
              disabled={loading}
            >
              All time
            </Button>
          </div>
        </div>

        {/* Cost Breakdown */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : data ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded border border-violet-200/30 dark:border-violet-500/20 bg-violet-50/40 dark:bg-violet-500/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-400">
                Project Cost
              </p>
              <p className="mt-2 text-2xl font-bold text-violet-900 dark:text-violet-200">
                {formatCurrency(data.projectCost)}
              </p>
            </div>

            <div className="rounded border border-blue-200/30 dark:border-blue-500/20 bg-blue-50/40 dark:bg-blue-500/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                Wages
              </p>
              <p className="mt-2 text-2xl font-bold text-blue-900 dark:text-blue-200">
                {formatCurrency(data.wagesCost)}
              </p>
              {data.wagesPct !== null && (
                <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                  {data.wagesPct.toFixed(1)}% of project
                </p>
              )}
            </div>

            <div className="rounded border border-emerald-200/30 dark:border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-500/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Material &amp; Other
              </p>
              <p className="mt-2 text-2xl font-bold text-emerald-900 dark:text-emerald-200">
                {formatCurrency(data.materialCost)}
              </p>
              {data.materialPct !== null && (
                <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                  {data.materialPct.toFixed(1)}% of project
                </p>
              )}
            </div>

            <div className="rounded border border-amber-200/30 dark:border-amber-500/20 bg-amber-50/40 dark:bg-amber-500/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Overtime
              </p>
              <p className="mt-2 text-2xl font-bold text-amber-900 dark:text-amber-200">
                {formatCurrency(data.overtimeCost)}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
