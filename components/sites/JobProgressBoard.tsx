"use client";

import { useState, useMemo, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-toastify";
import {
  Search,
  X,
  Building2,
  MapPin,
  User,
  ArrowRight,
  RotateCw,
  ChevronDown,
  MessageSquare,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  updateSiteJobStatus,
  updateSiteStageIndex,
  updateSiteStagePercent,
  listSiteProgressNotes,
  addSiteProgressNote,
} from "@/actions/sites";
import { formatCurrency } from "@/lib/formatCurrency";
import type { SiteRow } from "@/actions/sites";

type ProgressNote = {
  id: string;
  content: string;
  authorName: string;
  createdAt: string;
};

/* ------------------------------------------------------------------ */
/*  Types & constants                                                   */
/* ------------------------------------------------------------------ */

type JobStatus = "NOT_STARTED" | "ONGOING" | "COMPLETED" | "ON_HOLD";

/* One accent colour per supervisor group — teal first (matches primary) */
const GROUP_ACCENTS = [
  { dot: "bg-teal-500",   active: "bg-teal-500",   ring: "ring-teal-500/25",   text: "text-teal-600 dark:text-teal-400",   border: "border-teal-500",   track: "bg-teal-500"   },
  { dot: "bg-blue-500",   active: "bg-blue-500",   ring: "ring-blue-500/25",   text: "text-blue-600 dark:text-blue-400",   border: "border-blue-500",   track: "bg-blue-500"   },
  { dot: "bg-violet-500", active: "bg-violet-500", ring: "ring-violet-500/25", text: "text-violet-600 dark:text-violet-400", border: "border-violet-500", track: "bg-violet-500" },
  { dot: "bg-rose-500",   active: "bg-rose-500",   ring: "ring-rose-500/25",   text: "text-rose-600 dark:text-rose-400",   border: "border-rose-500",   track: "bg-rose-500"   },
  { dot: "bg-amber-500",  active: "bg-amber-500",  ring: "ring-amber-500/25",  text: "text-amber-600 dark:text-amber-400",  border: "border-amber-500",  track: "bg-amber-500"  },
  { dot: "bg-emerald-500",active: "bg-emerald-500",ring: "ring-emerald-500/25",text: "text-emerald-600 dark:text-emerald-400",border:"border-emerald-500",track:"bg-emerald-500"},
  { dot: "bg-pink-500",   active: "bg-pink-500",   ring: "ring-pink-500/25",   text: "text-pink-600 dark:text-pink-400",   border: "border-pink-500",   track: "bg-pink-500"   },
  { dot: "bg-orange-500", active: "bg-orange-500", ring: "ring-orange-500/25", text: "text-orange-600 dark:text-orange-400", border:"border-orange-500",  track: "bg-orange-500" },
] as const;

type Accent = (typeof GROUP_ACCENTS)[number];

const STATUS_CFG: Record<JobStatus, { label: string; pill: string }> = {
  NOT_STARTED: { label: "Not Started", pill: "bg-muted text-muted-foreground border-border"                                           },
  ONGOING:     { label: "Ongoing",     pill: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700"  },
  COMPLETED:   { label: "Completed",   pill: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700" },
  ON_HOLD:     { label: "On Hold",     pill: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700"  },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Group sites by supervisor name, preserving insertion order */
function groupBySupervisor(sites: SiteRow[]): Map<string, SiteRow[]> {
  const map = new Map<string, SiteRow[]>();
  for (const site of sites) {
    const key = site.supervisorName?.trim() || "__unassigned__";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(site);
  }
  return map;
}

/* ------------------------------------------------------------------ */
/*  Section label — supervisor header                                  */
/* ------------------------------------------------------------------ */

function SectionLabel({
  label,
  count,
  accent,
  isExpanded,
  onToggle,
}: {
  label: string;
  count: number;
  accent: Accent;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const initials =
    label === "Unassigned"
      ? "?"
      : label
          .split(" ")
          .map((w) => w[0])
          .slice(0, 2)
          .join("")
          .toUpperCase();

  return (
    <button
      onClick={onToggle}
      className="group flex w-full items-center gap-3 border-b border-border px-3 py-2.5 transition-colors hover:bg-secondary/50"
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white",
          accent.active,
        )}
      >
        {initials}
      </div>

      {/* Name */}
      <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-foreground">
        {label}
      </span>

      {/* Badge + chevron */}
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="rounded-full bg-muted px-2 py-px text-[9px] font-bold tabular-nums text-muted-foreground">
          {count} job{count !== 1 ? "s" : ""}
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 text-muted-foreground/50 transition-transform duration-200",
            !isExpanded && "-rotate-90",
          )}
        />
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Sidebar row item                                                    */
/* ------------------------------------------------------------------ */

function SidebarRow({
  site,
  accent,
  isSelected,
  onSelect,
}: {
  site: SiteRow;
  accent: Accent;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const cfg = STATUS_CFG[site.jobStatus as JobStatus];

  return (
    <button
      onClick={onSelect}
      className={cn(
        "group relative w-full border-b border-border px-3 py-2 text-left transition-colors duration-150",
        isSelected ? "bg-muted" : "bg-transparent hover:bg-secondary/50",
      )}
    >
      {/* Left selection stripe */}
      <div
        className={cn(
          "absolute left-0 top-1/2 h-8 w-0.5 -translate-y-1/2 rounded-r-full transition-all duration-200",
          accent.dot,
          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-40",
        )}
      />

      <div className="flex items-center gap-2 pl-1">
        {/* Accent dot */}
        <div className={cn("size-2 shrink-0 rounded-full", accent.dot)} />

        <div className="min-w-0 flex-1">
          {/* Row 1: name + code + status all inline */}
          <div className="flex min-w-0 items-center gap-1.5">
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-xs font-semibold leading-snug transition-colors",
                isSelected ? "text-foreground" : "text-foreground/80",
              )}
            >
              {site.name}
            </span>
            {site.code && (
              <span className="shrink-0 rounded border border-border bg-muted px-1 py-px text-[9px] font-bold tabular-nums text-muted-foreground">
                {site.code}
              </span>
            )}
            <span
              className={cn(
                "shrink-0 rounded-full border px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide",
                cfg.pill,
              )}
            >
              {cfg.label}
            </span>
          </div>

          {/* Row 2: client (only if present) */}
          {site.client && (
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground/60">
              {site.client}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Painting stages                                                     */
/* ------------------------------------------------------------------ */

const PAINTING_STAGES = [
  { key: "primer",    label: "Primer"     },
  { key: "firstCoat", label: "First Coat" },
  { key: "finalCoat", label: "Final Coat" },
  { key: "snags",     label: "Snags"      },
  { key: "finish",    label: "Finish"     },
];

/* ------------------------------------------------------------------ */
/*  Confirm dialog                                                      */
/* ------------------------------------------------------------------ */

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  accent,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  accent: Accent;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-2xl">
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        <p className="mt-1.5 text-sm text-muted-foreground">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            className={cn("text-white", accent.active)}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stage progress bar                                                  */
/* ------------------------------------------------------------------ */

function StageProgressBar({
  stageIndex,
  accent,
  onStageClick,
}: {
  stageIndex: number;
  accent: Accent;
  onStageClick: (idx: number) => void;
}) {
  const pct = Math.min((stageIndex / PAINTING_STAGES.length) * 100, 100);

  return (
    <div className="space-y-4">
      {/* Track bar */}
      <div className="relative h-1.5 rounded-full bg-border">
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-all duration-700",
            accent.track,
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Stage nodes */}
      <div className="flex items-start justify-between">
        {PAINTING_STAGES.map((stage, i) => {
          const isDone   = i < stageIndex;
          const isActive = i === stageIndex && stageIndex < PAINTING_STAGES.length;

          return (
            <button
              key={stage.key}
              onClick={() => onStageClick(i)}
              className="group flex flex-1 flex-col items-center gap-1.5 focus:outline-none"
              title={stage.label}
            >
              {/* Node + number badge */}
              <div className="relative">
                <div
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full border-2 transition-all duration-300 group-hover:scale-110",
                    isDone
                      ? cn("border-transparent text-white", accent.active)
                      : isActive
                      ? cn("border-transparent text-white ring-4", accent.active, accent.ring)
                      : "border-border bg-card text-muted-foreground/30",
                  )}
                >
                  {isDone ? (
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <div className={cn("size-2.5 rounded-full", isActive ? "bg-white" : "bg-muted-foreground/20")} />
                  )}
                </div>
                {/* Step number */}
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full border border-border bg-card text-[9px] font-bold text-muted-foreground">
                  {i + 1}
                </span>
              </div>

              <span
                className={cn(
                  "text-center text-[10px] font-semibold uppercase leading-tight tracking-wide",
                  isDone || isActive ? accent.text : "text-muted-foreground/40",
                )}
              >
                {stage.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Progress summary */}
      <p className="text-center text-xs text-muted-foreground">
        <span className="font-bold tabular-nums text-foreground">{stageIndex}</span>
        {"/"}
        <span className="tabular-nums">{PAINTING_STAGES.length}</span>
        {" stages done"}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stat chip                                                           */
/* ------------------------------------------------------------------ */

function StatChip({
  label,
  value,
  accent,
  highlighted,
}: {
  label: string;
  value: string;
  accent?: Accent;
  highlighted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex-1 rounded-lg border border-border bg-secondary/40 px-4 py-3",
        highlighted && "border-border",
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-base font-black tabular-nums",
          highlighted && accent ? accent.text : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Per-stage percentage bars                                           */
/* ------------------------------------------------------------------ */

const STAGE_KEYS = ["primer", "firstCoat", "finalCoat", "snags", "finish"] as const;
type StageKey = (typeof STAGE_KEYS)[number];
const STAGE_LABELS: Record<StageKey, string> = {
  primer:    "Primer",
  firstCoat: "First Coat",
  finalCoat: "Final Coat",
  snags:     "Snags",
  finish:    "Finish",
};

function StagePctBars({
  siteId,
  initialPct,
  accent,
}: {
  siteId: string;
  initialPct: Record<string, number>;
  accent: Accent;
}) {
  const [pct, setPct] = useState<Record<StageKey, number>>(() => {
    const base: Record<StageKey, number> = { primer: 0, firstCoat: 0, finalCoat: 0, snags: 0, finish: 0 };
    for (const k of STAGE_KEYS) base[k] = Math.min(100, Math.max(0, Number(initialPct[k] ?? 0)));
    return base;
  });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  function handleChange(key: StageKey, val: number) {
    setPct((prev) => ({ ...prev, [key]: val }));
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    await updateSiteStagePercent({ siteId, stagePct: pct });
    setSaving(false);
    setDirty(false);
  }

  const overall = Math.round(STAGE_KEYS.reduce((s, k) => s + pct[k], 0) / STAGE_KEYS.length);

  return (
    <div className="space-y-3">
      {/* Overall */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          Overall
        </span>
        <span className={cn("text-sm font-black tabular-nums", accent.text)}>{overall}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-border">
        <div
          className={cn("h-full rounded-full transition-all duration-500", accent.track)}
          style={{ width: `${overall}%` }}
        />
      </div>

      {/* Per-stage rows */}
      <div className="mt-4 space-y-3">
        {STAGE_KEYS.map((key) => (
          <div key={key} className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-xs font-medium text-muted-foreground">
              {STAGE_LABELS[key]}
            </span>
            <div className="relative flex-1">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={pct[key]}
                onChange={(e) => handleChange(key, Number(e.target.value))}
                className="slider-thumb w-full cursor-pointer accent-current"
                style={{ accentColor: "var(--primary)" }}
              />
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center">
                <div
                  className={cn("h-1.5 rounded-full transition-all duration-300", accent.track)}
                  style={{ width: `${pct[key]}%` }}
                />
              </div>
            </div>
            <span className="w-9 shrink-0 text-right text-xs font-bold tabular-nums text-foreground">
              {pct[key]}%
            </span>
          </div>
        ))}
      </div>

      {dirty && (
        <div className="flex justify-end pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              "rounded-lg px-4 py-1.5 text-xs font-semibold text-white transition-opacity disabled:opacity-50",
              accent.active,
            )}
          >
            {saving ? "Saving…" : "Save percentages"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Materials card                                                      */
/* ------------------------------------------------------------------ */

const MATERIALS_PAGE_SIZE = 8;

function MaterialsCard({
  materials,
}: {
  materials: { name: string; quantity: number; unitPrice: number; total: number }[];
}) {
  const [page, setPage] = useState(0);

  if (materials.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <svg className="size-7 text-muted-foreground/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
        <p className="text-xs text-muted-foreground/40">No materials ordered yet</p>
      </div>
    );
  }

  const totalPages = Math.ceil(materials.length / MATERIALS_PAGE_SIZE);
  const pageItems  = materials.slice(page * MATERIALS_PAGE_SIZE, (page + 1) * MATERIALS_PAGE_SIZE);
  const grandTotal = materials.reduce((s, m) => s + m.total, 0);

  return (
    <div className="overflow-hidden rounded border border-border">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-muted/60">
            <th className="border-b border-r border-border px-4 py-2.5 text-left font-semibold uppercase tracking-wider text-muted-foreground/70">
              Material
            </th>
            <th className="border-b border-r border-border px-3 py-2.5 text-right font-semibold uppercase tracking-wider text-muted-foreground/70">
              Qty
            </th>
            <th className="border-b border-r border-border px-3 py-2.5 text-right font-semibold uppercase tracking-wider text-muted-foreground/70">
              Unit Cost
            </th>
            <th className="border-b border-border px-4 py-2.5 text-right font-semibold uppercase tracking-wider text-muted-foreground/70">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {pageItems.map((m, i) => (
            <tr
              key={m.name}
              className={cn(
                "transition-colors hover:bg-secondary/40",
                i % 2 === 0 ? "bg-card" : "bg-muted/20",
              )}
            >
              <td className="border-b border-r border-border px-4 py-2.5 font-medium text-foreground">
                {m.name}
              </td>
              <td className="border-b border-r border-border px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                {m.quantity}
              </td>
              <td className="border-b border-r border-border px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                {formatCurrency(m.unitPrice)}
              </td>
              <td className="border-b border-border px-4 py-2.5 text-right font-semibold tabular-nums text-foreground">
                {formatCurrency(m.total)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-muted/50">
            <td colSpan={3} className="border-r border-border px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Grand Total
            </td>
            <td className="px-4 py-2.5 text-right text-sm font-black tabular-nums text-foreground">
              {formatCurrency(grandTotal)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-2">
          <span className="text-[10px] text-muted-foreground">
            {page * MATERIALS_PAGE_SIZE + 1}–{Math.min((page + 1) * MATERIALS_PAGE_SIZE, materials.length)} of {materials.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded border border-border bg-card px-2.5 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-40"
            >
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={cn(
                  "size-6 rounded border text-[10px] font-bold transition-colors",
                  i === page
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-secondary",
                )}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="rounded border border-border bg-card px-2.5 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Detail panel                                                        */
/* ------------------------------------------------------------------ */

function JobDetailPanel({
  site,
  accent,
  onStatusChange,
  onStageChange,
  isPending,
}: {
  site: SiteRow;
  accent: Accent;
  onStatusChange: (siteId: string, status: JobStatus) => void;
  onStageChange: (siteId: string, stageIndex: number) => void;
  isPending: boolean;
}) {
  const status = site.jobStatus as JobStatus;
  const cfg    = STATUS_CFG[status];
  const total  = site.totalWages + site.totalMaterialCost;

  const [pendingStage, setPendingStage] = useState<number | null>(null);
  const [notes, setNotes] = useState<ProgressNote[]>([]);
  const [noteText, setNoteText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* Fetch notes whenever the selected site changes (panel remounts via key) */
  useEffect(() => {
    listSiteProgressNotes(site.id).then((res) => {
      if (res.ok) setNotes(res.notes);
    });
  }, [site.id]);

  async function handleAddNote() {
    const content = noteText.trim();
    if (!content) return;
    setIsSubmitting(true);
    const res = await addSiteProgressNote({ siteId: site.id, content });
    setIsSubmitting(false);
    if (res.ok) {
      setNotes((prev) => [res.note, ...prev]);
      setNoteText("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    }
  }

  const nextStageIdx = site.stageIndex < PAINTING_STAGES.length ? site.stageIndex : null;
  const nextStageLabel = nextStageIdx !== null ? PAINTING_STAGES[nextStageIdx]?.label : null;

  function handleStageClick(idx: number) {
    if (idx === site.stageIndex) return;
    setPendingStage(idx);
  }

  function confirmStage() {
    if (pendingStage === null) return;
    onStageChange(site.id, pendingStage + 1);
    setPendingStage(null);
  }

  return (
    <>
      <ConfirmDialog
        open={pendingStage !== null}
        title={`Advance to ${pendingStage !== null ? PAINTING_STAGES[pendingStage]?.label : ""}`}
        message={`Mark all stages up to "${pendingStage !== null ? PAINTING_STAGES[pendingStage]?.label : ""}" as complete?`}
        confirmLabel="Confirm"
        accent={accent}
        onConfirm={confirmStage}
        onCancel={() => setPendingStage(null)}
      />

    <div className="flex h-full flex-col overflow-y-auto">
      {/* ── Header — single line ── */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
          {/* Name — takes available space, truncates */}
          <h2 className="min-w-0 shrink truncate text-base font-bold text-foreground">
            {site.name}
          </h2>

          {/* Code */}
          {site.code && (
            <span className="shrink-0 rounded border border-border bg-muted px-1.5 py-px text-xs font-bold tabular-nums text-muted-foreground">
              {site.code}
            </span>
          )}

          {/* Status */}
          <span className={cn("shrink-0 rounded-full border px-2.5 py-px text-[10px] font-bold uppercase tracking-wider", cfg.pill)}>
            {cfg.label}
          </span>

          {/* Divider */}
          {(site.client || site.location || site.supervisorName) && (
            <span className="shrink-0 text-muted-foreground/30">|</span>
          )}

          {/* Client */}
          {site.client && (
            <span className="shrink-0 text-xs text-muted-foreground">{site.client}</span>
          )}

          {/* Location */}
          {site.location && (
            <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3" />
              {site.location}
            </span>
          )}

          {/* Supervisor */}
          {site.supervisorName && (
            <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
              <User className="size-3" />
              {site.supervisorName}
            </span>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 space-y-6 p-6">
        {/* Stage tracker */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">
              Stage Tracker
            </p>
            {nextStageLabel && (
              <button
                onClick={() => setPendingStage(site.stageIndex)}
                disabled={isPending}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40",
                  accent.border,
                  accent.text,
                  "bg-transparent hover:opacity-80",
                )}
              >
                Advance
                <ArrowRight className="size-3" />
                {nextStageLabel}
              </button>
            )}
          </div>
          {/* Clickable stage nodes */}
          <StageProgressBar
            stageIndex={site.stageIndex}
            accent={accent}
            onStageClick={handleStageClick}
          />
        </section>

        {/* Per-stage percentages */}
        <section>
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">
            Stage Completion
          </p>
          <StagePctBars
            siteId={site.id}
            initialPct={site.stagePct}
            accent={accent}
          />
        </section>

        {/* Financial stats */}
        <section>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">
            Financials
          </p>
          <div className="flex gap-3">
            <StatChip label="Wages" value={formatCurrency(site.totalWages)} />
            <StatChip label="Materials" value={formatCurrency(site.totalMaterialCost)} />
            <StatChip label="Total" value={formatCurrency(total)} accent={accent} highlighted />
          </div>
        </section>

        {/* Materials ordered */}
        <section>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">
            Materials Ordered
          </p>
          <MaterialsCard materials={site.materials} />
        </section>

        {/* Quick actions */}
        <section>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">
            Quick Actions
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={isPending || status === "COMPLETED"}
              onClick={() => onStatusChange(site.id, "COMPLETED")}
              className="border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 disabled:opacity-40"
            >
              <svg className="mr-1.5 size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Mark Complete
            </Button>

            <Button
              size="sm"
              variant="outline"
              disabled={isPending || status === "ON_HOLD"}
              onClick={() => onStatusChange(site.id, "ON_HOLD")}
              className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-40"
            >
              <svg className="mr-1.5 size-3.5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
              On Hold
            </Button>

            {status !== "ONGOING" && (
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => onStatusChange(site.id, "ONGOING")}
                className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 disabled:opacity-40"
              >
                <RotateCw className="mr-1.5 size-3.5" />
                Resume
              </Button>
            )}

            <Button size="sm" variant="ghost" asChild className="ml-auto text-muted-foreground">
              <Link href={`/sites/${site.id}`}>
                View Full Site
                <ArrowRight className="ml-1.5 size-3.5" />
              </Link>
            </Button>
          </div>
        </section>

        {/* ── Progress Notes ── */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">
              Progress Notes
            </p>
            <span className="rounded-full bg-muted px-1.5 py-px text-[9px] font-bold tabular-nums text-muted-foreground/60">
              {notes.length}
            </span>
          </div>

          {/* Add note */}
          <div className="mb-4 rounded-lg border border-border bg-card">
            <textarea
              ref={textareaRef}
              value={noteText}
              onChange={(e) => {
                setNoteText(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = e.target.scrollHeight + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAddNote();
              }}
              placeholder="Add a progress note… (Ctrl+Enter to submit)"
              rows={3}
              className="w-full resize-none rounded-t-xl bg-transparent px-4 pt-3 pb-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
            />
            <div className="flex items-center justify-between border-t border-border px-3 py-2">
              <span className="text-[10px] text-muted-foreground/40">Ctrl+Enter to submit</span>
              <button
                onClick={handleAddNote}
                disabled={isSubmitting || !noteText.trim()}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                  "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40",
                )}
              >
                <Send className="size-3" />
                {isSubmitting ? "Posting…" : "Post"}
              </button>
            </div>
          </div>

          {/* Notes thread */}
          {notes.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <MessageSquare className="size-7 text-muted-foreground/20" />
              <p className="text-xs text-muted-foreground/40">No notes yet — add the first one</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => {
                const initials = note.authorName
                  .split(" ")
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();
                const ts = new Date(note.createdAt);
                const now = new Date();
                const diffMs = now.getTime() - ts.getTime();
                const diffMins = Math.floor(diffMs / 60000);
                const timeLabel =
                  diffMins < 1
                    ? "just now"
                    : diffMins < 60
                    ? `${diffMins}m ago`
                    : diffMins < 1440
                    ? `${Math.floor(diffMins / 60)}h ago`
                    : ts.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });

                return (
                  <div key={note.id} className="flex gap-3">
                    {/* Avatar */}
                    <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white", accent.active)}>
                      {initials}
                    </div>
                    {/* Bubble */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-semibold text-foreground">{note.authorName}</span>
                        <span className="text-[10px] text-muted-foreground/50">{timeLabel}</span>
                      </div>
                      <div className="mt-1 whitespace-pre-wrap rounded-lg rounded-tl-none border border-border bg-secondary/40 px-3 py-2 text-sm text-foreground">
                        {note.content}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty state                                                         */
/* ------------------------------------------------------------------ */

function EmptyDetail() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center px-8">
      <div className="flex size-14 items-center justify-center rounded-lg bg-secondary/60">
        <Building2 className="size-6 text-muted-foreground/30" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">
        Select a job to view details
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main board                                                          */
/* ------------------------------------------------------------------ */

export default function JobProgressBoard({
  initialSites,
}: {
  initialSites: SiteRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [sites, setSites] = useState<SiteRow[]>(initialSites);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSites[0]?.id ?? null,
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (key: string) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  /* Client-side search filter */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sites;
    return sites.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.code ?? "").toLowerCase().includes(q) ||
        (s.client ?? "").toLowerCase().includes(q) ||
        (s.location ?? "").toLowerCase().includes(q) ||
        (s.supervisorName ?? "").toLowerCase().includes(q),
    );
  }, [sites, search]);

  /* Group filtered sites by supervisor */
  const groups = useMemo(() => groupBySupervisor(filtered), [filtered]);

  /* Build a stable accent map: supervisor name → accent index */
  const accentMap = useMemo(() => {
    const map = new Map<string, number>();
    let idx = 0;
    for (const key of groups.keys()) {
      map.set(key, idx % GROUP_ACCENTS.length);
      idx++;
    }
    return map;
  }, [groups]);

  /* Look up accent for the selected site */
  const selectedSite = sites.find((s) => s.id === selectedId) ?? null;
  const selectedAccentIdx = selectedSite
    ? (accentMap.get(selectedSite.supervisorName?.trim() || "__unassigned__") ?? 0)
    : 0;
  const selectedAccent = GROUP_ACCENTS[selectedAccentIdx];

  function handleStatusChange(siteId: string, status: JobStatus) {
    setSites((prev) =>
      prev
        .map((s) => (s.id === siteId ? { ...s, jobStatus: status } : s))
        .filter((s) => s.jobStatus === "ONGOING"),
    );
    if (selectedId === siteId) {
      const remaining = sites.filter(
        (s) => s.id !== siteId && s.jobStatus === "ONGOING",
      );
      setSelectedId(remaining[0]?.id ?? null);
    }

    startTransition(async () => {
      const res = await updateSiteJobStatus({ siteId, jobStatus: status });
      if (!res.ok) {
        toast.error(res.error ?? "Failed to update status");
        router.refresh();
      } else {
        toast.success(
          status === "COMPLETED"
            ? "Job marked as complete"
            : status === "ON_HOLD"
            ? "Job put on hold"
            : "Job resumed",
        );
        router.refresh();
      }
    });
  }

  function handleStageChange(siteId: string, stageIndex: number) {
    setSites((prev) =>
      prev.map((s) => (s.id === siteId ? { ...s, stageIndex } : s)),
    );
    startTransition(async () => {
      const res = await updateSiteStageIndex({ siteId, stageIndex });
      if (!res.ok) {
        toast.error(res.error ?? "Failed to update stage");
        router.refresh();
      } else {
        toast.success(`Stage updated to ${PAINTING_STAGES[stageIndex - 1]?.label ?? "complete"}`);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* ── Sidebar ── */}
        <aside className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-card">
          {/* Search */}
          <div className="shrink-0 border-b border-border p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/50" />
              <Input
                placeholder="Search jobs…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 rounded border-border bg-background pl-9 pr-8 text-sm placeholder:text-muted-foreground/40 focus:border-primary/40"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Grouped list */}
          <div className="custom-scrollbar flex-1 overflow-y-auto overflow-x-hidden">
            {groups.size === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 px-4 text-center">
                <Building2 className="size-8 text-muted-foreground/20" />
                <p className="text-xs text-muted-foreground/50">
                  {search ? "No jobs match your search" : "No ongoing jobs"}
                </p>
              </div>
            ) : (
              Array.from(groups.entries())
              .sort(([a], [b]) => {
                if (a === "__unassigned__") return 1;
                if (b === "__unassigned__") return -1;
                return a.localeCompare(b);
              })
              .map(([supervisorKey, groupSites]) => {
                const accentIdx  = accentMap.get(supervisorKey) ?? 0;
                const accent     = GROUP_ACCENTS[accentIdx];
                const label      = supervisorKey === "__unassigned__" ? "Unassigned" : supervisorKey;
                const isExpanded = expandedGroups.has(supervisorKey);

                return (
                  <section key={supervisorKey}>
                    <SectionLabel
                      label={label}
                      count={groupSites.length}
                      accent={accent}
                      isExpanded={isExpanded}
                      onToggle={() => toggleGroup(supervisorKey)}
                    />
                    {isExpanded && groupSites.map((site) => (
                      <SidebarRow
                        key={site.id}
                        site={site}
                        accent={accent}
                        isSelected={selectedId === site.id}
                        onSelect={() => setSelectedId(site.id)}
                      />
                    ))}
                  </section>
                );
              })
            )}
          </div>
        </aside>

        {/* ── Detail panel ── */}
        <main className="flex-1 overflow-hidden bg-background">
          {selectedSite ? (
            <JobDetailPanel
              key={selectedSite.id}
              site={selectedSite}
              accent={selectedAccent}
              onStatusChange={handleStatusChange}
              onStageChange={handleStageChange}
              isPending={isPending}
            />
          ) : (
            <EmptyDetail />
          )}
        </main>
      </div>
    </div>
  );
}
