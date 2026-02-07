"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { currentFortnightSatFri } from "@/lib/fortnight";
import type {
  SupervisorTimesheetListRow,
  TimesheetDetailDto2,
} from "@/lib/dtos";
import { formatCurrency } from "@/lib/formatCurrency";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import TimesheetGrid from "@/components/timesheets/TimesheetGrid";
import TimesheetDetailSheet, {
  type TimesheetAction,
} from "@/components/timesheets/TimesheetDetailSheet";

/**
 * ✅ IMPORTANT
 * - We do NOT change API routes.
 * - We only normalize on the WEB client so it matches what the Sheet expects.
 *
 * List endpoint returns:
 *   { id, startISO, endISO, foremanName, siteCode, siteName, status }
 *
 * Detail endpoint returns:
 *   { timesheet: { foreman:{name}, supervisor:{name}, sites:[{code,name}], columns:[{iso,day}], rows, totals } }
 */

function money(n?: number | null) {
  return formatCurrency(n ?? 0);
}

function prettyRange(startISO: string, endISO: string) {
  const a = new Date(`${startISO}T00:00:00.000Z`);
  const b = new Date(`${endISO}T00:00:00.000Z`);
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return `${fmt(a)} – ${fmt(b)}`;
}

function statusClass(s: string) {
  if (s === "APPROVED")
    return "border-emerald-500/25 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  if (s === "REJECTED")
    return "border-rose-500/25 bg-rose-500/15 text-rose-700 dark:text-rose-300";
  if (s === "SUBMITTED")
    return "border-sky-600/25 bg-sky-600/15 text-sky-700 dark:text-sky-300";
  if (s === "PAID")
    return "border-purple-500/25 bg-purple-500/15 text-purple-700 dark:text-purple-300";
  return "border-slate-500/25 bg-slate-500/15 text-slate-700 dark:text-slate-300";
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2 py-1 text-xs font-extrabold",
        statusClass(status),
      ].join(" ")}
    >
      {status}
    </span>
  );
}

/**
 * ✅ List endpoint doesn't return sites[]
 * It returns siteCode + siteName (single representative site).
 */
function SiteBadgeFromListRow({
  siteCode,
  siteName,
}: {
  siteCode?: string | null;
  siteName?: string | null;
}) {
  const code = String(siteCode ?? "").trim();
  const name = String(siteName ?? "").trim();

  if (!code && !name) return <span className="text-muted-foreground">—</span>;

  return (
    <Badge variant="outline" className="truncate">
      {code ? `${code} · ` : ""}
      {name || "—"}
    </Badge>
  );
}

function toSafeErrorText(e: unknown) {
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

async function postJson(url: string, body?: any) {
  const res = await fetch(url, {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: body ? JSON.stringify(body) : "{}",
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      payload?.error || payload?.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return payload;
}

function buildSitesLabelFromSites(sites: any[]) {
  const list = Array.isArray(sites) ? sites : [];
  if (!list.length) return "—";

  return list
    .map((s: any) => {
      const code = String(s?.code ?? "").trim();
      const name = String(s?.name ?? "").trim();
      if (code && name) return `${code} · ${name}`;
      return name || code || "";
    })
    .filter(Boolean)
    .join(", ");
}

/**
 * ✅ Normalize detail payload to what the Sheet + Grid can consume
 * Without changing API.
 */
function normalizeTimesheetDetail(payload: any): TimesheetDetailDto2 {
  const raw = payload?.timesheet ?? payload;

  const startISO = String(raw?.startISO ?? "");
  const endISO = String(raw?.endISO ?? "");

  const columnsRaw = Array.isArray(raw?.columns) ? raw.columns : [];
  const derivedColumns = columnsRaw.map((c: any) => {
    const iso = String(c?.iso ?? "");
    const day = String(c?.day ?? "");
    const date =
      typeof c?.date === "string" && c.date
        ? c.date
        : iso && iso.includes("-")
          ? iso.split("-")[2]
          : "";
    return { iso, day, date };
  });

  const sites = Array.isArray(raw?.sites) ? raw.sites : [];
  const sitesLabel =
    typeof raw?.sitesLabel === "string" && raw.sitesLabel.trim()
      ? raw.sitesLabel
      : buildSitesLabelFromSites(sites);

  // Web sheet expects nested foreman/supervisor objects (from API detail)
  // But we also keep a foremanName convenience string (optional)
  const foremanName =
    typeof raw?.foremanName === "string" && raw.foremanName.trim()
      ? raw.foremanName
      : typeof raw?.foreman?.name === "string"
        ? raw.foreman.name
        : undefined;

  return {
    id: String(raw?.id ?? ""),
    startISO,
    endISO,
    status: raw?.status ?? "SUBMITTED",
    submittedAt: raw?.submittedAt ?? null,

    // keep server objects
    foreman: raw?.foreman,
    supervisor: raw?.supervisor,
    sites,

    // convenient strings for UI (if your TimesheetDetailDto2 allows them)
    foremanName,
    sitesLabel,

    columns: derivedColumns,
    rows: Array.isArray(raw?.rows) ? raw.rows : [],
    totals: raw?.totals ?? undefined,
  };
}

export default function TimesheetsClient() {
  const current = useMemo(() => currentFortnightSatFri(new Date()), []);
  const [periodId, setPeriodId] = useState<string>(current.id);

  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [status, setStatus] = useState<string>("ALL");

  const [rows, setRows] = useState<SupervisorTimesheetListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState<string | null>(null);
  const [detail, setDetail] = useState<TimesheetDetailDto2 | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const listAbortRef = useRef<AbortController | null>(null);

  const loadList = useCallback(async () => {
    listAbortRef.current?.abort();
    const ac = new AbortController();
    listAbortRef.current = ac;

    setLoading(true);
    setErr(null);

    try {
      const url = new URL(
        "/api/app/supervisor/timesheets",
        window.location.origin,
      );

      // ✅ If your API supports period: keep it (your code uses it)
      url.searchParams.set("period", periodId);

      if (qDebounced) url.searchParams.set("q", qDebounced);
      if (status !== "ALL") url.searchParams.set("status", status);

      const res = await fetch(url.toString(), {
        cache: "no-store",
        signal: ac.signal,
        credentials: "include",
        headers: { accept: "application/json" },
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          payload?.error ||
          payload?.message ||
          `Failed to load timesheets (${res.status})`;
        throw new Error(msg);
      }

      const list: SupervisorTimesheetListRow[] =
        (Array.isArray(payload?.timesheets) && payload.timesheets) || [];

      setRows(list);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setErr(toSafeErrorText(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [periodId, qDebounced, status]);

  useEffect(() => {
    loadList();
    return () => listAbortRef.current?.abort();
  }, [loadList]);

  const refreshDetail = useCallback(async () => {
    if (!activeId) return;

    setDetail(null);
    setDetailErr(null);
    setDetailLoading(true);

    try {
      const res = await fetch(
        `/api/app/supervisor/timesheets/${encodeURIComponent(activeId)}`,
        {
          cache: "no-store",
          credentials: "include",
          headers: { accept: "application/json" },
        },
      );

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          payload?.error ||
          payload?.message ||
          `Failed to load timesheet (${res.status})`;
        throw new Error(msg);
      }

      const ts = normalizeTimesheetDetail(payload);
      setDetail(ts);
    } catch (e) {
      setDetailErr(toSafeErrorText(e));
    } finally {
      setDetailLoading(false);
    }
  }, [activeId]);

  const openDetail = useCallback(async (id: string) => {
    setOpen(true);
    setActiveId(id);

    setDetail(null);
    setDetailErr(null);
    setDetailLoading(true);

    try {
      const res = await fetch(
        `/api/app/supervisor/timesheets/${encodeURIComponent(id)}`,
        {
          cache: "no-store",
          credentials: "include",
          headers: { accept: "application/json" },
        },
      );

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          payload?.error ||
          payload?.message ||
          `Failed to load timesheet (${res.status})`;
        throw new Error(msg);
      }

      const ts = normalizeTimesheetDetail(payload);
      setDetail(ts);
    } catch (e) {
      setDetailErr(toSafeErrorText(e));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const supervisorActions = useMemo(() => {
    const actions: TimesheetAction[] = [
      {
        id: "approve",
        label: "Approve",
        canPerform: (s) => s === "SUBMITTED",
        handler: async () => {
          if (!activeId) return;
          await postJson(
            `/api/app/supervisor/timesheets/${encodeURIComponent(activeId)}/approve`,
          );
        },
      },
      {
        id: "reject",
        label: "Reject",
        variant: "destructive",
        canPerform: (s) => s === "SUBMITTED",
        requiresReason: true,
        handler: async (reason) => {
          if (!activeId) return;
          await postJson(
            `/api/app/supervisor/timesheets/${encodeURIComponent(activeId)}/reject`,
            { reason },
          );
        },
      },
      {
        id: "paid",
        label: "Mark Paid",
        variant: "outline",
        canPerform: (s) => s === "APPROVED",
        handler: async () => {
          if (!activeId) return;
          await postJson(
            `/api/app/supervisor/timesheets/${encodeURIComponent(activeId)}/paid`,
          );
        },
      },
    ];
    return actions;
  }, [activeId]);

  const periodOptions = useMemo(() => {
    const opts: {
      id: string;
      startISO: string;
      endISO: string;
      disabled: boolean;
    }[] = [];

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    let start = new Date(`${current.startISO}T00:00:00.000Z`);
    for (let i = 0; i < 6; i++) {
      const s = new Date(start);
      const e = new Date(s);
      e.setUTCDate(e.getUTCDate() + 13);

      const startISO = s.toISOString().slice(0, 10);
      const endISO = e.toISOString().slice(0, 10);

      const endDate = new Date(`${endISO}T00:00:00.000Z`);
      const disabled = endDate < today;

      opts.push({ id: `${startISO}_${endISO}`, startISO, endISO, disabled });
      start.setUTCDate(start.getUTCDate() - 14);
    }

    return opts;
  }, [current.startISO]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Timesheets</h1>
          <p className="text-sm text-muted-foreground">
            Default view is the current fortnight (Sat → Fri).
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={loadList} disabled={loading}>
            Refresh
          </Button>

          <Button
            className="bg-sky-600 hover:bg-sky-600/90 text-white"
            onClick={() => {
              setQ("");
              setStatus("ALL");
              setPeriodId(current.id);
            }}
          >
            Reset
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded flex-1 border bg-card p-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">
              Search
            </div>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search foreman name…"
            />
          </div>

          <div className="space-y-1 flex-1">
            <div className="text-xs font-medium text-muted-foreground">
              Fortnight
            </div>
            <Select value={periodId} onValueChange={setPeriodId}>
              <SelectTrigger className="w-full rounded">
                <SelectValue placeholder="Select fortnight" />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((p) => (
                  <SelectItem
                    key={p.id}
                    value={p.id}
                    disabled={p.disabled}
                    className={
                      p.disabled ? "opacity-50 cursor-not-allowed" : ""
                    }
                  >
                    {prettyRange(p.startISO, p.endISO)} (Sat–Fri)
                    {p.disabled && " — (Past)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">
              Status
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full rounded">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="SUBMITTED">Submitted</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {err ? (
          <div className="text-sm text-rose-600 dark:text-rose-400">{err}</div>
        ) : null}
      </div>

      {/* List */}
      <div className="rounded-md border border-zinc-300/70 bg-white/80 dark:border-zinc-700/60 dark:bg-zinc-900/40 shadow-sm">
        <div className="p-4 flex items-center justify-between border-b border-zinc-300/70 dark:border-zinc-700/60">
          <div className="text-sm text-muted-foreground">
            {loading
              ? "Loading…"
              : `${rows.length} timesheet${rows.length === 1 ? "" : "s"}`}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="w-16 aspect-square rounded-full relative flex justify-center items-center animate-[spin_3s_linear_infinite] z-40 bg-[conic-gradient(white_0deg,white_300deg,transparent_270deg,transparent_360deg)] before:animate-[spin_2s_linear_infinite] before:absolute before:w-[60%] before:aspect-square before:rounded-full before:z-80 before:bg-[conic-gradient(white_0deg,white_270deg,transparent_180deg,transparent_360deg)] after:absolute after:w-3/4 after:aspect-square after:rounded-full after:z-60 after:animate-[spin_3s_linear_infinite] after:bg-[conic-gradient(#065f46_0deg,#065f46_180deg,transparent_180deg,transparent_360deg)]">
              <span className="absolute w-[85%] aspect-square rounded-full z-[60] animate-[spin_5s_linear_infinite] bg-[conic-gradient(#34d399_0deg,#34d399_180deg,transparent_180deg,transparent_360deg)]"></span>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            No timesheets found for this filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="border-collapse">
              <TableHeader>
                <TableRow className="border-b border-zinc-300/70 dark:border-zinc-700/60">
                  <TableHead className="px-4 py-3 text-left font-semibold">
                    Fortnight
                  </TableHead>
                  <TableHead className="px-4 py-3 text-left font-semibold">
                    Foreman
                  </TableHead>
                  <TableHead className="px-4 py-3 text-left font-semibold">
                    Sites (code + name)
                  </TableHead>
                  <TableHead className="px-4 py-3 text-left font-semibold">
                    Status
                  </TableHead>
                  <TableHead className="px-4 py-3 text-right font-semibold">
                    Days
                  </TableHead>
                  <TableHead className="px-4 py-3 text-right font-semibold">
                    Wages
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {rows.map((r) => (
                  <TableRow
                    key={r.id}
                    className="border-b border-zinc-300/70 dark:border-zinc-700/60 hover:bg-zinc-50/70 dark:hover:bg-zinc-800/60 cursor-pointer transition-colors"
                    onClick={() => openDetail(r.id)}
                  >
                    <TableCell className="px-4 py-3 font-medium">
                      {prettyRange(r.startISO, r.endISO)}
                    </TableCell>

                    {/* ✅ FIX: list row uses foremanName (not foreman?.name) */}
                    <TableCell className="px-4 py-3 font-medium">
                      {(r as any).foremanName ?? "—"}
                    </TableCell>

                    {/* ✅ FIX: list row uses siteCode/siteName (not sites[]) */}
                    <TableCell className="px-4 py-3 max-w-xs">
                      <SiteBadgeFromListRow
                        siteCode={(r as any).siteCode}
                        siteName={(r as any).siteName}
                      />
                    </TableCell>

                    <TableCell className="px-4 py-3">
                      <StatusPill status={(r as any).status} />
                    </TableCell>

                    <TableCell className="px-4 py-3 text-right font-semibold">
                      {(r as any).totalWorkerDays ?? 0}
                    </TableCell>

                    <TableCell className="px-4 py-3 text-right font-semibold">
                      {money((r as any).totalWorkerWages)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <TimesheetDetailSheet
        open={open}
        onOpenChange={setOpen}
        detail={detail}
        loading={detailLoading}
        error={detailErr}
        activeId={activeId}
        onRetry={refreshDetail}
        onRefreshDetail={refreshDetail}
        actions={supervisorActions}
        gridComponent={detail ? <TimesheetGrid data={detail} /> : null}
        prettyRange={prettyRange}
      />
    </div>
  );
}
