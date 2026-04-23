"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-toastify";
import { Search, X, RotateCw, Building2, MapPin, User, Wallet, Package } from "lucide-react";
import { updateSiteJobStatus } from "@/actions/sites";
import { formatCurrency } from "@/lib/formatCurrency";
import type { SiteRow } from "@/actions/sites";

/* ── colour palette – one per card index, cycles ── */
const ACCENT_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6",
  "#EF4444", "#EC4899", "#06B6D4", "#F97316",
  "#84CC16", "#A78BFA",
];

const STATUS_OPTIONS = [
  { value: "ONGOING",     label: "Ongoing",     class: "bg-blue-900/40 text-blue-300 border-blue-700" },
  { value: "ON_HOLD",     label: "On Hold",     class: "bg-amber-900/40 text-amber-300 border-amber-700" },
  { value: "COMPLETED",   label: "Completed",   class: "bg-emerald-900/40 text-emerald-300 border-emerald-700" },
  { value: "NOT_STARTED", label: "Not Started", class: "bg-zinc-800 text-zinc-400 border-zinc-700" },
] as const;

type JobStatus = "NOT_STARTED" | "ONGOING" | "COMPLETED" | "ON_HOLD";

function getStatusCfg(status: JobStatus) {
  return STATUS_OPTIONS.find((s) => s.value === status) ?? STATUS_OPTIONS[0];
}

/* ── single job card ── */
function JobCard({
  site,
  color,
  onStatusChange,
  isPending,
}: {
  site: SiteRow;
  color: string;
  onStatusChange: (siteId: string, status: JobStatus) => void;
  isPending: boolean;
}) {
  const cfg = getStatusCfg(site.jobStatus as JobStatus);
  const total = site.totalWages + site.totalMaterialCost;

  return (
    <div
      className="relative bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-600 transition-all duration-200 hover:shadow-2xl hover:shadow-black/40"
      style={{ borderLeftColor: color, borderLeftWidth: 4 }}
    >
      {/* Top accent */}
      <div className="absolute top-0 left-4 right-4 h-px opacity-20" style={{ backgroundColor: color }} />

      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/sites/${site.id}`}
                className="font-bold text-white text-base leading-tight hover:underline truncate"
              >
                {site.name}
              </Link>
              {site.code && (
                <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border border-zinc-700 text-zinc-400 bg-zinc-800 tabular-nums">
                  {site.code}
                </span>
              )}
            </div>
            {site.client && (
              <p className="text-zinc-500 text-xs mt-0.5 truncate">{site.client}</p>
            )}
          </div>
          <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full border uppercase tracking-wider ${cfg.class}`}>
            {cfg.label}
          </span>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
          {site.location && (
            <span className="flex items-center gap-1 truncate max-w-[180px]">
              <MapPin className="w-3 h-3 shrink-0" />
              {site.location}
            </span>
          )}
          {site.supervisorName && (
            <span className="flex items-center gap-1 truncate">
              <User className="w-3 h-3 shrink-0" />
              {site.supervisorName}
            </span>
          )}
        </div>

        {/* Financial chips */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-zinc-800/60 rounded-xl px-3 py-2">
            <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold flex items-center gap-1 mb-0.5">
              <Wallet className="w-3 h-3" /> Wages
            </p>
            <p className="text-sm font-bold text-white tabular-nums">{formatCurrency(site.totalWages)}</p>
          </div>
          <div className="bg-zinc-800/60 rounded-xl px-3 py-2">
            <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold flex items-center gap-1 mb-0.5">
              <Package className="w-3 h-3" /> Materials
            </p>
            <p className="text-sm font-bold text-white tabular-nums">{formatCurrency(site.totalMaterialCost)}</p>
          </div>
          <div className="bg-zinc-800/60 rounded-xl px-3 py-2">
            <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold mb-0.5">Total</p>
            <p className="text-sm font-bold tabular-nums" style={{ color }}>{formatCurrency(total)}</p>
          </div>
        </div>

        {/* Quick action buttons */}
        <div className="flex gap-2 pt-1">
          <button
            disabled={isPending || site.jobStatus === "COMPLETED"}
            onClick={() => onStatusChange(site.id, "COMPLETED")}
            className="flex-1 py-2 rounded-xl text-xs font-bold border transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed bg-emerald-950/40 text-emerald-400 border-emerald-800 hover:bg-emerald-900/60"
          >
            ✓ Mark Complete
          </button>
          <button
            disabled={isPending || site.jobStatus === "ON_HOLD"}
            onClick={() => onStatusChange(site.id, "ON_HOLD")}
            className="flex-1 py-2 rounded-xl text-xs font-bold border transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed bg-amber-950/40 text-amber-400 border-amber-800 hover:bg-amber-900/60"
          >
            ⏸ On Hold
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── stats bar ── */
function StatsBar({ sites }: { sites: SiteRow[] }) {
  const totalWages = sites.reduce((s, j) => s + j.totalWages, 0);
  const totalMaterials = sites.reduce((s, j) => s + j.totalMaterialCost, 0);

  return (
    <div className="grid grid-cols-3 gap-3">
      {[
        { label: "Active Jobs", value: String(sites.length), color: "#3B82F6", mono: false },
        { label: "Total Wages", value: formatCurrency(totalWages), color: "#10B981", mono: true },
        { label: "Total Materials", value: formatCurrency(totalMaterials), color: "#F59E0B", mono: true },
      ].map(({ label, value, color, mono }) => (
        <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className={`text-2xl font-black text-white ${mono ? "tabular-nums text-xl" : ""}`}>{value}</p>
          <p className="text-xs font-semibold mt-1 uppercase tracking-wider" style={{ color }}>{label}</p>
        </div>
      ))}
    </div>
  );
}

/* ── main board ── */
export default function JobProgressBoard({ initialSites }: { initialSites: SiteRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  // local optimistic state so UI updates immediately
  const [sites, setSites] = useState<SiteRow[]>(initialSites);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sites;
    return sites.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.code ?? "").toLowerCase().includes(q) ||
        (s.client ?? "").toLowerCase().includes(q) ||
        (s.location ?? "").toLowerCase().includes(q),
    );
  }, [sites, search]);

  function handleStatusChange(siteId: string, status: JobStatus) {
    // Optimistic: remove from board if no longer ONGOING
    setSites((prev) =>
      prev.map((s) => (s.id === siteId ? { ...s, jobStatus: status } : s)).filter((s) => s.jobStatus === "ONGOING"),
    );

    startTransition(async () => {
      const res = await updateSiteJobStatus({ siteId, jobStatus: status });
      if (!res.ok) {
        toast.error(res.error ?? "Failed to update status");
        // Revert: re-fetch by refreshing
        router.refresh();
      } else {
        toast.success(status === "COMPLETED" ? "Job marked as complete" : "Job put on hold");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <StatsBar sites={sites} />

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, code, client or location…"
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-zinc-600 border border-dashed border-zinc-800 rounded-2xl">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-semibold text-zinc-500">
            {sites.length === 0 ? "No ongoing jobs" : "No jobs match your search"}
          </p>
          {sites.length === 0 && (
            <p className="text-sm mt-1 text-zinc-600">
              Mark a job as <span className="text-blue-400">Ongoing</span> from the Sites page to see it here.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((site, idx) => (
            <JobCard
              key={site.id}
              site={site}
              color={ACCENT_COLORS[idx % ACCENT_COLORS.length]}
              onStatusChange={handleStatusChange}
              isPending={isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
