"use client";

import * as React from "react";
import { toast } from "react-toastify";
import { Calendar, DollarSign, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface PersonOption {
  id: string; // User.id for foreman
  name: string;
  email: string;
}

interface OverrideRow {
  id: string;
  startsOn: string;
  endsOn: string | null;
  dayRate: string;
  reason: string | null;
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded border border-slate-200/50 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/40 backdrop-blur-sm p-6 shadow-sm transition-all hover:shadow-md">
      <div className="mb-4 flex items-center gap-2">
        <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
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

export default function SiteForemanRatesPanel({
  siteId,
  foremanOptions,
}: {
  siteId: string;
  foremanOptions: PersonOption[];
}) {
  const [selectedForemanUserId, setSelectedForemanUserId] =
    React.useState<string>("");
  const [overrides, setOverrides] = React.useState<OverrideRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [closingId, setClosingId] = React.useState<string | null>(null);

  const [startsOn, setStartsOn] = React.useState("");
  const [endsOn, setEndsOn] = React.useState("");
  const [rate, setRate] = React.useState("");
  const [reason, setReason] = React.useState("");

  async function loadOverrides(foremanUserId: string) {
    if (!foremanUserId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/app/admin/sites/${siteId}/foreman-day-rate-overrides?foremanUserId=${encodeURIComponent(foremanUserId)}`,
        {
          method: "GET",
          credentials: "include",
          headers: { accept: "application/json" },
        },
      );
      const json = await res.json().catch(() => null as any);
      if (!res.ok) {
        throw new Error(
          json?.error ||
            json?.message ||
            `Failed to load overrides (${res.status})`,
        );
      }
      if (json?.ok && Array.isArray(json.overrides)) {
        setOverrides(json.overrides as OverrideRow[]);
      } else {
        setOverrides([]);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load overrides",
      );
      setOverrides([]);
    } finally {
      setLoading(false);
    }
  }

  const handleSelectForeman = (value: string) => {
    setSelectedForemanUserId(value);
    setOverrides([]);
    if (value) {
      void loadOverrides(value);
    }
  };

  const handleSaveOverride = async () => {
    const foremanUserId = selectedForemanUserId.trim();
    if (!foremanUserId) {
      toast.error("Please select a foreman");
      return;
    }
    if (!startsOn.trim() || !rate.trim()) {
      toast.error("Start date and rate are required");
      return;
    }

    const numericRate = Number(rate.replace(",", "."));
    if (!Number.isFinite(numericRate) || numericRate <= 0) {
      toast.error("Rate must be a positive number");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(
        `/api/app/admin/sites/${siteId}/foreman-day-rate-overrides?foremanUserId=${encodeURIComponent(foremanUserId)}`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({
            startsOn: startsOn.trim(),
            endsOn: endsOn.trim() || null,
            dayRate: numericRate,
            reason: reason.trim() || null,
          }),
        },
      );
      const json = await res.json().catch(() => null as any);
      if (!res.ok) {
        throw new Error(
          json?.error ||
            json?.message ||
            `Failed to save override (${res.status})`,
        );
      }
      toast.success("Override saved");
      setStartsOn("");
      setEndsOn("");
      setRate("");
      setReason("");
      void loadOverrides(foremanUserId);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save override",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCloseOverride = async (override: OverrideRow) => {
    const foremanUserId = selectedForemanUserId.trim();
    if (!foremanUserId) return;

    const todayStr = new Date().toISOString().slice(0, 10);
    setClosingId(override.id);
    try {
      const res = await fetch(
        `/api/app/admin/sites/${siteId}/foreman-day-rate-overrides?foremanUserId=${encodeURIComponent(foremanUserId)}`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({ id: override.id, endsOn: todayStr }),
        },
      );
      const json = await res.json().catch(() => null as any);
      if (!res.ok) {
        throw new Error(
          json?.error ||
            json?.message ||
            `Failed to close override (${res.status})`,
        );
      }
      toast.success("Override closed");
      void loadOverrides(foremanUserId);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to close override",
      );
    } finally {
      setClosingId(null);
    }
  };

  return (
    <Card
      title="Day rate overrides"
      description="Configure special day rates per foreman for this site. Applies to all employees scanned under that foreman on this site. Only one active range is allowed per foreman per site."
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Foreman
            </p>
            <Select
              value={selectedForemanUserId}
              onValueChange={handleSelectForeman}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a foreman" />
              </SelectTrigger>
              <SelectContent>
                {foremanOptions.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name} — {f.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedForemanUserId && (
          <>
            <div className="mt-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-800/30 p-4 space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                New override
              </p>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Start date
                  </label>
                  <Input
                    type="date"
                    value={startsOn}
                    onChange={(e) => setStartsOn(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> End date
                  </label>
                  <Input
                    type="date"
                    value={endsOn}
                    onChange={(e) => setEndsOn(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <DollarSign className="h-3 w-3" /> Day rate (R)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    placeholder="e.g. 450.00"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 dark:text-slate-400">
                    Reason (optional)
                  </label>
                  <Input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Outside Gauteng travel"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveOverride}
                  disabled={saving}
                  className="px-4"
                >
                  {saving ? "Saving…" : "Save override"}
                </Button>
              </div>
            </div>

            <div className="mt-3">
              {loading ? (
                <p className="text-xs text-slate-500">Loading overrides…</p>
              ) : overrides.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No overrides configured for this foreman on this site.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-auto">
                  {overrides.map((o) => {
                    const start = new Date(o.startsOn);
                    const end = o.endsOn ? new Date(o.endsOn) : null;
                    const isOpen = !end;
                    return (
                      <div
                        key={o.id}
                        className="flex items-center justify-between gap-3 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                            {start.toLocaleDateString()} –{" "}
                            {end ? (
                              end.toLocaleDateString()
                            ) : (
                              <span className="text-amber-500">open</span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                            Rate: R {o.dayRate}
                            {o.reason && ` · ${o.reason}`}
                          </p>
                        </div>
                        {isOpen && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={closingId === o.id}
                            onClick={() => handleCloseOverride(o)}
                            className="h-7 px-2 text-[11px]"
                          >
                            {closingId === o.id ? "Closing…" : "Close today"}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
