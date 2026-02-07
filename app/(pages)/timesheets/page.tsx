"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { currentFortnightSatFri } from "@/lib/fortnight";
import type { AdminTimesheetListRow, TimesheetDetailDto } from "@/lib/dtos";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency } from "@/lib/formatCurrency";
import { Textarea } from "@/components/ui/textarea";
import TimesheetDetailSheet, {
  type TimesheetAction,
} from "@/components/timesheets/TimesheetDetailSheet";
import TimesheetGrid from "@/components/timesheets/TimesheetGrid";

function money(n?: number | null) {
  const x = Number(n ?? 0);
  return Number.isFinite(x) ? x.toFixed(2) : "0.00";
}

function prettyRange(startISO: string, endISO: string) {
  // Use explicit Z to avoid local timezone shifting the day label.
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

function SiteBadges({ sites }: { sites?: any[] }) {
  const list = sites ?? [];
  if (!list.length) return <span className="text-muted-foreground">—</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {list.slice(0, 3).map((s) => (
        <Badge key={s.id} variant="outline" className="truncate">
          {(s.code ? `${s.code} · ` : "") + s.name}
        </Badge>
      ))}
      {list.length > 3 ? (
        <Badge variant="secondary">+{list.length - 3} more</Badge>
      ) : null}
    </div>
  );
}

/**
 * Minimal “table-like” detail renderer (web) similar to your mobile.
 * Uses horizontal scroll for the 14-day grid.
 */

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
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      payload?.error || payload?.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return payload;
}
/**
 * Fixes included vs your version:
 * - Avoid HTML dumping: read JSON errors when possible, otherwise a clean message.
 * - Debounced search to stop “fetch loop” typing spam.
 * - Abort in-flight list fetch (prevents non-stopping overlapping requests).
 * - Keeps API on “/api/app/admin/…” (your app namespace).
 * - Uses Z when parsing ISO days to avoid timezone drift.
 * - Keeps “current fortnight” Sat→Fri as default via currentFortnightSatFri().
 */
export default function TimesheetsPage() {
  // default: current fortnight (Sat→Fri, 14 days)
  const current = useMemo(() => currentFortnightSatFri(new Date()), []);
  const [periodId, setPeriodId] = useState<string>(current.id);

  // filters/search
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [supervisorId, setSupervisorId] = useState<string>("ALL");
  const [status, setStatus] = useState<string>("ALL");

  // data
  const [rows, setRows] = useState<AdminTimesheetListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // detail sheet
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState<string | null>(null);
  const [detail, setDetail] = useState<TimesheetDetailDto | null>(null);

  // supervisors derived from list (good enough for now)
  const supervisors = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      if (r.supervisor?.id && r.supervisor?.name) {
        map.set(r.supervisor.id, r.supervisor.name);
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  // Abort controller to prevent overlapping list calls
  const listAbortRef = useRef<AbortController | null>(null);

  const loadList = useCallback(async () => {
    // abort previous
    listAbortRef.current?.abort();
    const ac = new AbortController();
    listAbortRef.current = ac;

    setLoading(true);
    setErr(null);

    try {
      const url = new URL("/api/app/admin/timesheets", window.location.origin);
      url.searchParams.set("period", periodId);
      if (qDebounced) url.searchParams.set("q", qDebounced);
      if (supervisorId !== "ALL")
        url.searchParams.set("supervisorId", supervisorId);
      if (status !== "ALL") url.searchParams.set("status", status);

      const res = await fetch(url.toString(), {
        cache: "no-store",
        signal: ac.signal,
        headers: { accept: "application/json" },
      });

      const ct = res.headers.get("content-type") ?? "";
      const isJson = ct.includes("application/json");
      const payload = isJson ? await res.json().catch(() => null) : null;

      if (!res.ok) {
        const msg =
          (payload && (payload.error || payload.message)) ||
          `Failed to load timesheets (${res.status})`;
        throw new Error(msg);
      }

      const list: AdminTimesheetListRow[] =
        (Array.isArray(payload?.timesheets) && payload.timesheets) ||
        (Array.isArray(payload) && payload) ||
        (Array.isArray(payload?.data) && payload.data) ||
        [];

      setRows(list);

      // keep supervisor filter valid after refresh
      if (supervisorId !== "ALL") {
        const valid = list.some((r) => r.supervisor?.id === supervisorId);
        if (!valid) setSupervisorId("ALL");
      }
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setErr(toSafeErrorText(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [periodId, qDebounced, supervisorId, status]);

  useEffect(() => {
    loadList();
    return () => listAbortRef.current?.abort();
  }, [loadList]);

  const openDetail = useCallback(async (id: string) => {
    setOpen(true);
    setActiveId(id);
    setDetail(null);
    setDetailErr(null);
    setDetailLoading(true);

    try {
      const res = await fetch(
        `/api/app/admin/timesheets/${encodeURIComponent(id)}`,
        { cache: "no-store", headers: { accept: "application/json" } },
      );

      const ct = res.headers.get("content-type") ?? "";
      const isJson = ct.includes("application/json");
      const payload = isJson ? await res.json().catch(() => null) : null;

      if (!res.ok) {
        const msg =
          (payload && (payload.error || payload.message)) ||
          `Failed to load timesheet (${res.status})`;
        throw new Error(msg);
      }

      const ts: TimesheetDetailDto = payload?.timesheet ?? payload;
      setDetail(ts);
    } catch (e) {
      setDetailErr(toSafeErrorText(e));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const adminActions = useMemo(() => {
    const actions: TimesheetAction[] = [
      {
        id: "approve",
        label: "Approve",
        canPerform: (status) => status === "SUBMITTED",
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
        canPerform: (status) => status === "SUBMITTED",
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
        canPerform: (status) => status === "APPROVED",
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

      // Fortnight is disabled if its end date is before today
      const endDate = new Date(`${endISO}T00:00:00.000Z`);
      const disabled = endDate < today;

      opts.push({ id: `${startISO}_${endISO}`, startISO, endISO, disabled });
      start.setUTCDate(start.getUTCDate() - 14);
    }
    return opts;
  }, [current.startISO]);

  return (
    <div className=" space-y-4">
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
              setSupervisorId("ALL");
              setPeriodId(current.id);
            }}
          >
            Reset
          </Button>
        </div>
      </div>

      <div className="rounded flex-1 border bg-card p-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
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

          <div className="space-y-1 flex-1 ">
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
              Supervisor
            </div>
            <Select value={supervisorId} onValueChange={setSupervisorId}>
              <SelectTrigger className="w-full rounded">
                <SelectValue placeholder="All supervisors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                {supervisors.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
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

      <div className="rounded-md border border-zinc-300/70 bg-white/80 dark:border-zinc-700/60 dark:bg-zinc-900/40 shadow-sm">
        <div className="p-4 flex items-center justify-between border-b border-zinc-300/70 dark:border-zinc-700/60">
          <div className="text-sm text-muted-foreground">
            {loading
              ? "Loading…"
              : `${rows.length} timesheet${rows.length === 1 ? "" : "s"}`}
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">
            Fetching timesheets…
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
                  <TableHead className="border-r border-zinc-300/70 dark:border-zinc-700/60 px-4 py-3 text-left font-semibold text-zinc-900 dark:text-white bg-sky-50/60 dark:bg-zinc-800/30">
                    Fortnight
                  </TableHead>
                  <TableHead className="border-r border-zinc-300/70 dark:border-zinc-700/60 px-4 py-3 text-left font-semibold text-zinc-900 dark:text-white bg-sky-50/60 dark:bg-zinc-800/30">
                    Foreman
                  </TableHead>
                  <TableHead className="border-r border-zinc-300/70 dark:border-zinc-700/60 px-4 py-3 text-left font-semibold text-zinc-900 dark:text-white bg-sky-50/60 dark:bg-zinc-800/30">
                    Supervisor
                  </TableHead>
                  <TableHead className="border-r border-zinc-300/70 dark:border-zinc-700/60 px-4 py-3 text-left font-semibold text-zinc-900 dark:text-white bg-sky-50/60 dark:bg-zinc-800/30">
                    Sites (code + name)
                  </TableHead>
                  <TableHead className="border-r border-zinc-300/70 dark:border-zinc-700/60 px-4 py-3 text-left font-semibold text-zinc-900 dark:text-white bg-sky-50/60 dark:bg-zinc-800/30">
                    Status
                  </TableHead>
                  <TableHead className="border-r border-zinc-300/70 dark:border-zinc-700/60 px-4 py-3 text-right font-semibold text-zinc-900 dark:text-white bg-sky-100/50 dark:bg-zinc-800/30">
                    Days
                  </TableHead>
                  <TableHead className="px-4 py-3 text-right font-semibold text-zinc-900 dark:text-white bg-sky-100/50 dark:bg-zinc-800/30">
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
                    <TableCell className="border-r border-zinc-300/70 dark:border-zinc-700/60 px-4 py-3 font-medium text-zinc-900 dark:text-white">
                      {prettyRange(r.startISO, r.endISO)}
                    </TableCell>
                    <TableCell className="border-r border-zinc-300/70 dark:border-zinc-700/60 px-4 py-3 font-medium text-zinc-900 dark:text-white">
                      {r.foreman?.name ?? "—"}
                    </TableCell>
                    <TableCell className="border-r border-zinc-300/70 dark:border-zinc-700/60 px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {r.supervisor?.name ?? "—"}
                    </TableCell>
                    <TableCell className="border-r border-zinc-300/70 dark:border-zinc-700/60 px-4 py-3 max-w-xs">
                      <SiteBadges sites={r.sites as any[]} />
                    </TableCell>
                    <TableCell className="border-r border-zinc-300/70 dark:border-zinc-700/60 px-4 py-3">
                      <StatusPill status={r.status} />
                    </TableCell>
                    <TableCell className="border-r border-zinc-300/70 dark:border-zinc-700/60 px-4 py-3 text-right font-semibold text-zinc-900 dark:text-white bg-sky-100/50 dark:bg-zinc-800/30">
                      {r.totalWorkerDays ?? 0}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-semibold text-zinc-900 dark:text-white bg-sky-100/50 dark:bg-zinc-800/30">
                      {money(r.totalWorkerWages)}
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
        onRetry={() => activeId && openDetail(activeId)}
        onRefreshDetail={() =>
          activeId ? openDetail(activeId) : Promise.resolve()
        }
        actions={adminActions}
        gridComponent={detail ? <TimesheetGrid data={detail} /> : null}
        prettyRange={prettyRange}
      />
    </div>
  );
}
