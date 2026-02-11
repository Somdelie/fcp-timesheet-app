"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";

import { getFortnightForDateUTC } from "@/lib/timesheetPeriods";
import type { TimesheetDetailDto, TimesheetDetailDto2 } from "@/lib/dtos";

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

import TimesheetDetailSheet, {
  type TimesheetAction,
} from "@/components/timesheets/TimesheetDetailSheet";
import TimesheetGrid from "@/components/timesheets/TimesheetGrid";
import { normalizeTimesheetToGrid } from "@/lib/timesheets/normalizeTimesheetDetail";
import { Spinner } from "@/components/ui/spinner";

type RoleMode = "ADMIN" | "SUPERVISOR";

type PeriodOption = {
  id: string; // YYYY-MM-DD_YYYY-MM-DD
  startISO: string;
  endISO: string;
  label?: string | null;
};

type AdminRow = {
  id: string;
  startISO: string;
  endISO: string;
  status: string;
  foreman?: { id: string; name: string };
  supervisor?: { id: string; name: string } | null;
  totalWorkerDays?: number | null;
  totalWorkerWages?: number | null;
  sites?: Array<{ id: string; code?: string | null; name: string }>;
};

type SupervisorRow = {
  id: string;
  startISO: string;
  endISO: string;
  status: string;
  foremanName?: string | null;
  siteId?: string | null;
  siteCode?: string | null;
  siteName?: string | null;
  totalWorkerDays?: number | null;
  totalWorkerWages?: number | null;
  rowKey?: string;
};

function toSafeErrorText(e: unknown) {
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function money(n?: number | null) {
  const x = Number(n ?? 0);
  return Number.isFinite(x) ? x.toFixed(2) : "0.00";
}

function prettyRange(startISO: string, endISO: string) {
  const a = new Date(`${startISO}T00:00:00.000Z`);
  const b = new Date(`${endISO}T00:00:00.000Z`);
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return `${fmt(a)} – ${fmt(b)}`;
}

function iso10(v: any) {
  return String(v ?? "").slice(0, 10);
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

async function postJson(url: string, body?: unknown) {
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

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    headers: { accept: "application/json" },
    credentials: "include",
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      payload?.error || payload?.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return payload as T;
}

/**
 * ADMIN-only anchor helper (supervisor MUST NOT use this)
 */
async function getYearAnchorISO(year: number): Promise<string | null> {
  try {
    const data = await getJson<{
      ok: boolean;
      year: number;
      anchorISO: string | null;
    }>(`/api/app/admin/timesheets/year-anchor?year=${year}`);
    return data.anchorISO ?? null;
  } catch {
    return null;
  }
}

function utcDateFromISO(iso: string) {
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${iso}`);
  return d;
}

type Props = {
  mode: RoleMode;
};

export default function TimesheetsListClient({ mode }: Props) {
  const nowYearUTC = useMemo(() => new Date().getUTCFullYear(), []);
  const [year] = useState<number>(nowYearUTC);

  const [periods, setPeriods] = useState<PeriodOption[]>([]);
  const [periodId, setPeriodId] = useState<string>("");

  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [status, setStatus] = useState<string>("ALL");

  const [supervisorId, setSupervisorId] = useState<string>("ALL");

  const [rowsAdmin, setRowsAdmin] = useState<AdminRow[]>([]);
  const [rowsSup, setRowsSup] = useState<SupervisorRow[]>([]);
  const rows = mode === "ADMIN" ? rowsAdmin : rowsSup;

  const [loading, setLoading] = useState(false);

  const [err, setErr] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeSiteId, setActiveSiteId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);

  // ✅ normalized grid model (same for admin + supervisor)
  const gridModel = useMemo(() => {
    if (!detail) return null;
    const dto = (detail?.timesheet ?? detail) as
      | TimesheetDetailDto
      | TimesheetDetailDto2;
    return normalizeTimesheetToGrid(dto as any);
  }, [detail]);

  const gridNode = useMemo(() => {
    if (!gridModel) return null;
    return <TimesheetGrid model={gridModel as any} />;
  }, [gridModel]);

  // supervisors list (admin only)
  const [dbSupervisors, setDbSupervisors] = useState<
    Array<{ id: string; name: string | null; email: string }>
  >([]);

  const supervisors = useMemo(() => {
    if (mode !== "ADMIN") return [];
    return dbSupervisors
      .filter((s) => s.name)
      .map((s) => ({ id: s.id, name: s.name! }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [mode, dbSupervisors]);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  // load supervisors (admin only)
  useEffect(() => {
    if (mode !== "ADMIN") {
      setDbSupervisors([]);
      return;
    }

    let alive = true;

    async function loadSupervisors() {
      try {
        const res = await fetch("/api/app/admin/supervisors", {
          cache: "no-store",
          headers: { accept: "application/json" },
          credentials: "include",
        });
        const data = await res.json();

        if (!alive) return;

        if (!res.ok) {
          console.error("Failed to load supervisors:", data?.error);
          setDbSupervisors([]);
          return;
        }

        setDbSupervisors(
          Array.isArray(data.supervisors)
            ? data.supervisors.map(
                (s: { id: string; name: string | null; email: string }) => ({
                  id: s.id,
                  name: s.name,
                  email: s.email,
                }),
              )
            : [],
        );
      } catch (e: any) {
        console.error("Failed to load supervisors:", e);
        if (!alive) return;
        setDbSupervisors([]);
      }
    }

    loadSupervisors();
    return () => {
      alive = false;
    };
  }, [mode]);

  // ✅ periods loader (ADMIN vs SUPERVISOR)
  useEffect(() => {
    let alive = true;

    async function loadPeriods() {
      try {
        if (mode === "SUPERVISOR") {
          const data = await getJson<{
            ok: boolean;
            periods: PeriodOption[];
            currentId: string | null;
          }>(`/api/app/supervisor/timesheets/periods`);

          if (!alive) return;

          const list = Array.isArray(data.periods) ? data.periods : [];
          setPeriods(list);

          const defaultId =
            (data.currentId && list.some((p) => p.id === data.currentId)
              ? data.currentId
              : list[0]?.id) ?? "";

          setPeriodId(defaultId);
          return;
        }

        // ADMIN (year-based DB periods)
        const data = await getJson<{ ok: boolean; periods: PeriodOption[] }>(
          `/api/app/timesheets/periods?year=${year}`,
        );
        if (!alive) return;

        const list = Array.isArray(data.periods) ? data.periods : [];
        setPeriods(list);

        let defaultId = list[0]?.id ?? "";

        const anchorISO = await getYearAnchorISO(year);
        if (anchorISO) {
          try {
            const anchor = utcDateFromISO(anchorISO);
            const today = new Date();
            const current = getFortnightForDateUTC(today, anchor);
            defaultId = current.id;
          } catch {
            // ignore
          }
        }

        const exists = list.some((p) => p.id === defaultId);
        setPeriodId(exists ? defaultId : (list[0]?.id ?? ""));
      } catch (e: any) {
        console.error(e);
        if (!alive) return;
        setPeriods([]);
        setPeriodId("");
      }
    }

    loadPeriods();
    return () => {
      alive = false;
    };
  }, [mode, year]);

  // Abort controller for list
  const listAbortRef = useRef<AbortController | null>(null);

  const loadList = useCallback(async () => {
    // ✅ If no period yet, don't fetch and don't pretend we're loading.
    if (!periodId) {
      setLoading(false);
      setErr(null);
      if (mode === "ADMIN") setRowsAdmin([]);
      else setRowsSup([]);
      return;
    }

    listAbortRef.current?.abort();
    const ac = new AbortController();
    listAbortRef.current = ac;

    setLoading(true);
    setErr(null);

    try {
      const base =
        mode === "ADMIN"
          ? "/api/app/admin/timesheets"
          : "/api/app/supervisor/timesheets";

      const url = new URL(base, window.location.origin);

      if (mode === "ADMIN") url.searchParams.set("period", periodId);
      else if (mode === "SUPERVISOR") url.searchParams.set("period", periodId);
      if (qDebounced) url.searchParams.set("q", qDebounced);
      if (status !== "ALL") url.searchParams.set("status", status);
      if (mode === "ADMIN" && supervisorId !== "ALL") {
        url.searchParams.set("supervisorId", supervisorId);
      }

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

      const list =
        (Array.isArray(payload?.timesheets) && payload.timesheets) || [];

      if (mode === "ADMIN") {
        setRowsAdmin(list as AdminRow[]);
        if (supervisorId !== "ALL") {
          const valid = (list as AdminRow[]).some(
            (r) => r.supervisor?.id === supervisorId,
          );
          if (!valid) setSupervisorId("ALL");
        }
      } else {
        // supervisor list: server filters by period => no client-side filtering needed
        setRowsSup(list as SupervisorRow[]);
      }
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setErr(toSafeErrorText(e));
      if (mode === "ADMIN") setRowsAdmin([]);
      else setRowsSup([]);
    } finally {
      setLoading(false);
    }
  }, [mode, periodId, qDebounced, status, supervisorId]);

  // ✅ Only load list when periodId exists
  useEffect(() => {
    if (!periodId) return;
    loadList();
    return () => listAbortRef.current?.abort();
  }, [loadList, periodId]);

  const openDetail = useCallback(
    async (id: string, siteId?: string | null) => {
      setOpen(true);
      setActiveId(id);
      setActiveSiteId(siteId ?? null);
      setDetail(null);
      setDetailErr(null);
      setDetailLoading(true);

      try {
        const base =
          mode === "ADMIN"
            ? "/api/app/admin/timesheets/"
            : "/api/app/supervisor/timesheets/";

        const url = `${base}${encodeURIComponent(id)}${siteId ? `?siteId=${encodeURIComponent(siteId)}` : ""}`;

        const res = await fetch(url, {
          cache: "no-store",
          credentials: "include",
          headers: { accept: "application/json" },
        });

        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          const msg =
            payload?.error ||
            payload?.message ||
            `Failed to load timesheet (${res.status})`;
          throw new Error(msg);
        }

        setDetail(payload?.timesheet ?? payload);
      } catch (e) {
        setDetailErr(toSafeErrorText(e));
      } finally {
        setDetailLoading(false);
      }
    },
    [mode],
  );

  const refreshDetail = useCallback(async () => {
    if (!activeId) return;
    await openDetail(activeId, activeSiteId);
  }, [activeId, activeSiteId, openDetail]);

  const actions = useMemo((): TimesheetAction[] => {
    const base = "/api/app/supervisor";

    return [
      {
        id: "approve",
        label: "Approve",
        canPerform: (s) => s === "SUBMITTED",
        handler: async () => {
          if (!activeId) return;
          await postJson(
            `${base}/timesheets/${encodeURIComponent(activeId)}/approve`,
          );
          toast.success("Approved");
          setTimeout(() => loadList(), 300);
          setTimeout(() => refreshDetail(), 300);
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
            `${base}/timesheets/${encodeURIComponent(activeId)}/reject`,
            { reason },
          );
          toast.success("Rejected");
          setTimeout(() => loadList(), 300);
          setTimeout(() => refreshDetail(), 300);
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
            `${base}/timesheets/${encodeURIComponent(activeId)}/paid`,
          );
          toast.success("Marked paid");
          setTimeout(() => loadList(), 300);
          setTimeout(() => refreshDetail(), 300);
        },
      },
    ];
  }, [activeId, loadList, refreshDetail]);

  const reset = () => {
    setQ("");
    setStatus("ALL");
    if (mode === "ADMIN") setSupervisorId("ALL");
    if (periods[0]?.id) setPeriodId(periods[0].id);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Timesheets</h1>
          <p className="text-sm text-muted-foreground">
            Fortnights are pulled from the database periods.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={loadList}
            disabled={loading || !periodId}
          >
            Refresh
          </Button>

          <Button
            className="bg-sky-600 hover:bg-sky-600/90 text-white"
            onClick={reset}
          >
            Reset
          </Button>
        </div>
      </div>

      <div className="rounded flex-1 border bg-card p-4 space-y-3">
        <div
          className={`grid grid-cols-1 gap-3 ${
            mode === "ADMIN" ? "md:grid-cols-4" : "md:grid-cols-3"
          }`}
        >
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
            <Select
              value={periodId}
              onValueChange={setPeriodId}
              disabled={!periods.length}
            >
              <SelectTrigger className="w-full rounded">
                <SelectValue
                  placeholder={
                    periods.length ? "Select fortnight" : "No periods"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {periods.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {prettyRange(p.startISO, p.endISO)} (Sat–Fri)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {mode === "ADMIN" ? (
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
          ) : null}

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
            {loading ? (
              <Spinner className="size-4" />
            ) : (
              `${rows.length} timesheet${rows.length === 1 ? "" : "s"}`
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-6 flex justify-center">
            <Spinner className="size-5" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            No timesheets found for this filter.
          </div>
        ) : mode === "ADMIN" ? (
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
                    Supervisor
                  </TableHead>
                  <TableHead className="px-4 py-3 text-left font-semibold">
                    Sites
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
                {(rowsAdmin as AdminRow[]).map((r) => (
                  <TableRow
                    key={r.id}
                    className="border-b border-zinc-300/70 dark:border-zinc-700/60 hover:bg-zinc-50/70 dark:hover:bg-zinc-800/60 cursor-pointer transition-colors"
                    onClick={() =>
                      openDetail(
                        r.id,
                        Array.isArray(r.sites) && r.sites.length
                          ? r.sites[0]?.id
                          : undefined,
                      )
                    }
                  >
                    <TableCell className="px-4 py-3 font-medium">
                      {prettyRange(r.startISO, r.endISO)}
                    </TableCell>
                    <TableCell className="px-4 py-3 font-medium">
                      {r.foreman?.name ?? "—"}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      {r.supervisor?.name ?? "—"}
                    </TableCell>
                    <TableCell className="px-4 py-3 max-w-xs">
                      <SiteBadges sites={r.sites as any[]} />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <StatusPill status={r.status} />
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-semibold">
                      {r.totalWorkerDays ?? 0}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-semibold">
                      {money(r.totalWorkerWages)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
                    Site
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
                {(rowsSup as SupervisorRow[]).map((r) => (
                  <TableRow
                    key={r.rowKey ?? r.id}
                    className="border-b border-zinc-300/70 dark:border-zinc-700/60 hover:bg-zinc-50/70 dark:hover:bg-zinc-800/60 cursor-pointer transition-colors"
                    onClick={() => openDetail(r.id, r.siteId)}
                  >
                    <TableCell className="px-4 py-3 font-medium">
                      {prettyRange(iso10(r.startISO), iso10(r.endISO))}
                    </TableCell>
                    <TableCell className="px-4 py-3 font-medium">
                      {r.foremanName ?? "—"}
                    </TableCell>
                    <TableCell className="px-4 py-3 max-w-xs">
                      <SiteBadgeFromListRow
                        siteCode={r.siteCode}
                        siteName={r.siteName}
                      />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <StatusPill status={r.status} />
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-semibold">
                      {r.totalWorkerDays ?? 0}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-semibold">
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
        onRetry={refreshDetail}
        onRefreshDetail={refreshDetail}
        actions={actions}
        gridModel={gridModel as any}
        gridComponent={gridNode}
        prettyRange={prettyRange}
      />
    </div>
  );
}
