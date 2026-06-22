"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Printer,
  Download,
  X,
  Eye,
} from "lucide-react";

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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import TimesheetDetailSheet, {
  type TimesheetAction,
} from "@/components/timesheets/TimesheetDetailSheet";
import TimesheetQuickViewClient from "@/components/timesheets/TimesheetQuickViewClient";
import TimesheetGrid from "@/components/timesheets/TimesheetGrid";
import { normalizeTimesheetToGrid } from "@/lib/timesheets/normalizeTimesheetDetail";
import { Spinner } from "@/components/ui/spinner";
import {
  generateForemanSummaryPdf,
  generateTimesheetPdf,
  downloadTimesheetPdf,
  printForemanSummary,
  printAllSupervisorSummaries,
  type ForemanSummaryData,
  type ForemanTimesheetData,
  type SupervisorSummaryGroup,
} from "@/lib/generateTimesheetPdf";

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
  foreman?: { id: string; name: string; bankName?: string | null };
  supervisor?: { id: string; name: string } | null;
  totalWorkerDays?: number | null;
  totalWorkerWages?: number | null;
  foremanDays?: number | null;
  foremanWages?: number | null;
  teamDays?: number | null;
  teamWages?: number | null;
  totalDeductions?: number | null;
  totalOvertimeCost?: number | null;
  sites?: Array<{ id: string; code?: string | null; name: string }>;
  rowKey?: string;
};

type OvertimeEntry = {
  id: string;
  siteId: string;
  siteName: string;
  siteCode: string | null;
  foremanId: string;
  foremanName: string;
  workDate: string;
  numberOfEmployees: number;
  hoursWorked: number;
  totalCost: number;
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

type WageAnalyticsRow = {
  periodId: string;
  periodLabel: string;
  startISO: string;
  endISO: string;
  monthIndex: number;
  monthLabel: string;
  supervisorId: string;
  supervisorName: string;
  foremanName: string;
  siteId: string;
  siteCode: string;
  siteName: string;
  status: string;
  wages: number;
  days: number;
};

type MonthlySortKey = "month" | "wages" | "pct" | "rank";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const WAGE_RANGE_OPTIONS = [
  { value: "ALL", label: "All amounts", min: 0, max: null },
  { value: "0_30000", label: "Up to R30K", min: 0, max: 30000 },
  { value: "30000_", label: "More than R30K", min: 30000, max: null },
  { value: "30000_50000", label: "R30K - R50K", min: 30000, max: 50000 },
  { value: "50000_100000", label: "R50K - R100K", min: 50000, max: 100000 },
  { value: "100000_", label: "More than R100K", min: 100000, max: null },
] as const;

function ensureUniqueRowKeys<T extends { id: string; rowKey?: string }>(
  rows: T[],
): T[] {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.id, (counts.get(r.id) ?? 0) + 1);

  const seen = new Map<string, number>();
  return rows.map((r) => {
    if ((counts.get(r.id) ?? 0) <= 1) return r;
    if (r.rowKey) return r;

    const n = (seen.get(r.id) ?? 0) + 1;
    seen.set(r.id, n);
    return { ...r, rowKey: `${r.id}__dup${n}` };
  });
}

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

function overlapsRange(period: PeriodOption, fromISO: string, toISO: string) {
  if (!fromISO || !toISO) return true;
  return !(period.endISO < fromISO || period.startISO > toISO);
}

function csvEsc(value: string | number) {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
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
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsErr, setAnalyticsErr] = useState<string | null>(null);
  const [analyticsRows, setAnalyticsRows] = useState<WageAnalyticsRow[]>([]);
  const [analyticsFromISO, setAnalyticsFromISO] = useState("");
  const [analyticsToISO, setAnalyticsToISO] = useState("");
  const [analyticsMonth, setAnalyticsMonth] = useState<string>("ALL");
  const [monthlySortBy, setMonthlySortBy] = useState<MonthlySortKey>("rank");
  const [monthlySortDir, setMonthlySortDir] = useState<"asc" | "desc">("asc");
  const [monthlyPagination, setMonthlyPagination] = useState({
    pageIndex: 0,
    pageSize: 6,
  });
  const [analyticsFortnightId, setAnalyticsFortnightId] =
    useState<string>("ALL");
  const [analyticsSupervisorId, setAnalyticsSupervisorId] =
    useState<string>("ALL");
  const [analyticsWageRange, setAnalyticsWageRange] = useState<string>("ALL");
  const [analyticsSearch, setAnalyticsSearch] = useState("");
  const [analyticsSearchDebounced, setAnalyticsSearchDebounced] = useState("");
  const [siteAnalyticsPagination, setSiteAnalyticsPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const [supervisorId, setSupervisorId] = useState<string>("ALL");

  const [rowsAdmin, setRowsAdmin] = useState<AdminRow[]>([]);
  const [rowsSup, setRowsSup] = useState<SupervisorRow[]>([]);
  const rows = mode === "ADMIN" ? rowsAdmin : rowsSup;

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeSiteId, setActiveSiteId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);

  const [foremanTotalsExpanded, setForemanTotalsExpanded] = useState(false);
  const [quickViewOpen, setQuickViewOpen] = useState(false);

  const [overtimeExpandedForemanId, setOvertimeExpandedForemanId] = useState<
    string | null
  >(null);
  const [overtimeEntriesByForeman, setOvertimeEntriesByForeman] = useState<
    Record<string, OvertimeEntry[]>
  >({});
  const [overtimeLoadingForemanId, setOvertimeLoadingForemanId] = useState<
    string | null
  >(null);

  const [foremanPdfGenerating, setForemanPdfGenerating] = useState<
    string | null
  >(null);

  const [printingAllSummaries, setPrintingAllSummaries] = useState(false);

  const currentPeriod = useMemo(
    () => periods.find((p) => p.id === periodId) ?? null,
    [periods, periodId],
  );

  const periodsSorted = useMemo(
    () => [...periods].sort((a, b) => a.startISO.localeCompare(b.startISO)),
    [periods],
  );

  const totalWages = useMemo(() => {
    const list = mode === "ADMIN" ? rowsAdmin : rowsSup;
    return list.reduce(
      (sum, row) => sum + Number(row.totalWorkerWages ?? 0),
      0,
    );
  }, [mode, rowsAdmin, rowsSup]);

  const totalOvertime = useMemo(() => {
    if (mode !== "ADMIN") return 0;
    return rowsAdmin.reduce(
      (sum, row) => sum + Number(row.totalOvertimeCost ?? 0),
      0,
    );
  }, [mode, rowsAdmin]);

  const loadOvertimeEntriesForForeman = useCallback(
    async (foremanId: string): Promise<OvertimeEntry[]> => {
      if (mode !== "ADMIN") return [];
      if (!currentPeriod) {
        toast.error("No period selected");
        return [];
      }

      const cached = overtimeEntriesByForeman[foremanId];
      if (cached) return cached;

      try {
        setOvertimeLoadingForemanId(foremanId);

        const params = new URLSearchParams();
        params.set("from", currentPeriod.startISO.slice(0, 10));
        params.set("to", currentPeriod.endISO.slice(0, 10));

        const payload = await getJson<{
          ok: boolean;
          data: OvertimeEntry[];
        }>(`/api/app/admin/overtime-entries?${params.toString()}`);

        const all = payload?.data ?? [];
        const filtered = all.filter((e) => e.foremanId === foremanId);

        setOvertimeEntriesByForeman((prev) => ({
          ...prev,
          [foremanId]: filtered,
        }));

        return filtered;
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || "Failed to load overtime entries");
        return [];
      } finally {
        setOvertimeLoadingForemanId((prev) =>
          prev === foremanId ? null : prev,
        );
      }
    },
    [mode, currentPeriod, overtimeEntriesByForeman],
  );

  const foremanTotals = useMemo(() => {
    if (mode !== "ADMIN") return [];
    const map = new Map<
      string,
      {
        foremanId: string;
        foremanName: string;
        bankName: string | null;
        sitesCount: number;
        siteIds: string[];
        foremanDays: number;
        foremanWages: number;
        teamDays: number;
        teamWages: number;
        totalDeductions: number;
        totalOvertimeCost: number;
        grandTotal: number;
      }
    >();
    for (const row of rowsAdmin) {
      const id = row.foreman?.id ?? "unknown";
      const name = row.foreman?.name ?? "Unknown";
      const existing = map.get(id) ?? {
        foremanId: id,
        foremanName: name,
        bankName: row.foreman?.bankName ?? null,
        sitesCount: 0,
        siteIds: [],
        foremanDays: 0,
        foremanWages: 0,
        teamDays: 0,
        teamWages: 0,
        totalDeductions: 0,
        totalOvertimeCost: 0,
        grandTotal: 0,
      };
      if (row.sites) {
        for (const site of row.sites) {
          if (!existing.siteIds.includes(site.id)) {
            existing.siteIds.push(site.id);
          }
        }
      }
      existing.sitesCount = existing.siteIds.length;
      existing.foremanDays += Number(row.foremanDays ?? 0);
      existing.foremanWages += Number(row.foremanWages ?? 0);
      existing.teamDays += Number(row.teamDays ?? 0);
      existing.teamWages += Number(row.teamWages ?? 0);
      existing.totalOvertimeCost += Number(row.totalOvertimeCost ?? 0);
      existing.totalDeductions = Math.max(
        existing.totalDeductions,
        Number(row.totalDeductions ?? 0),
      );
      existing.grandTotal =
        existing.foremanWages +
        existing.teamWages +
        existing.totalOvertimeCost -
        existing.totalDeductions;
      map.set(id, existing);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.foremanName.localeCompare(b.foremanName),
    );
  }, [mode, rowsAdmin]);

  const handleForemanPdfAction = useCallback(
    async (
      foremanData: (typeof foremanTotals)[0],
      action: "print" | "download",
    ) => {
      if (!periodId) {
        toast.error("No period selected");
        return;
      }

      setForemanPdfGenerating(foremanData.foremanId);

      try {
        const timesheets: ForemanTimesheetData[] = [];
        const siteBreakdown: ForemanSummaryData["sites"] = [];

        for (const siteId of foremanData.siteIds) {
          const timesheetId = `${periodId}_${foremanData.foremanId}_${siteId}`;
          const url = `/api/app/admin/timesheets/${encodeURIComponent(timesheetId)}?siteId=${encodeURIComponent(siteId)}`;

          const res = await fetch(url, {
            cache: "no-store",
            credentials: "include",
            headers: { accept: "application/json" },
          });

          if (!res.ok) {
            console.warn(`Failed to fetch timesheet for site ${siteId}`);
            continue;
          }

          const payload = await res.json();
          const tsDetail = payload?.timesheet ?? payload;

          if (!tsDetail) continue;

          const gridData = normalizeTimesheetToGrid(tsDetail as any);

          const siteRow = rowsAdmin.find(
            (r) =>
              r.foreman?.id === foremanData.foremanId &&
              r.sites?.some((s) => s.id === siteId),
          );
          const siteInfo = siteRow?.sites?.find((s) => s.id === siteId);

          timesheets.push({
            siteId,
            siteName: siteInfo?.name ?? tsDetail.sites?.[0]?.name ?? "Site",
            siteCode: siteInfo?.code ?? tsDetail.sites?.[0]?.code,
            gridModel: gridData,
            supervisorName: siteRow?.supervisor?.name,
          });

          siteBreakdown.push({
            siteId,
            siteName: siteInfo?.name ?? "Site",
            siteCode: siteInfo?.code ?? undefined,
            foremanDays: Number(siteRow?.foremanDays ?? 0),
            foremanWages: Number(siteRow?.foremanWages ?? 0),
            teamDays: Number(siteRow?.teamDays ?? 0),
            teamWages: Number(siteRow?.teamWages ?? 0),
            totalWages: Number(siteRow?.totalWorkerWages ?? 0),
          });
        }

        if (timesheets.length === 0) {
          toast.error("No timesheet data found for this foreman");
          return;
        }

        const [startISO, endISO] = periodId.split("_");

        const summaryData: ForemanSummaryData = {
          foremanId: foremanData.foremanId,
          foremanName: foremanData.foremanName,
          startISO: startISO ?? "",
          endISO: endISO ?? "",
          sitesCount: foremanData.sitesCount,
          foremanDays: foremanData.foremanDays,
          foremanWages: foremanData.foremanWages,
          teamDays: foremanData.teamDays,
          teamWages: foremanData.teamWages,
          grandTotal: foremanData.grandTotal,
          sites: siteBreakdown,
        };

        if (action === "download") {
          const pdfBytes = await generateForemanSummaryPdf(
            summaryData,
            timesheets,
          );
          const filename = `foreman-summary-${foremanData.foremanName.replace(/\s+/g, "-")}-${startISO}.pdf`;
          downloadTimesheetPdf(pdfBytes, filename);
          toast.success("PDF downloaded");
        } else {
          const printData = timesheets.map((ts) => ({
            gridModel: ts.gridModel,
            meta: {
              foremanName: foremanData.foremanName,
              contractManagerName: ts.supervisorName,
              startDate: startISO,
              endDate: endISO,
              sites: [{ code: ts.siteCode, name: ts.siteName }],
            },
          }));
          printForemanSummary(summaryData, printData);
        }
      } catch (err: any) {
        console.error("Foreman PDF generation error:", err);
        toast.error(err?.message ?? "Failed to generate PDF");
      } finally {
        setForemanPdfGenerating(null);
      }
    },
    [periodId, rowsAdmin],
  );

  const handlePrintAllSummaries = useCallback(() => {
    if (!currentPeriod) {
      toast.error("No period selected");
      return;
    }

    setPrintingAllSummaries(true);

    try {
      const supervisorMap = new Map<
        string,
        {
          supervisorId: string | null;
          supervisorName: string;
          foremanMap: Map<
            string,
            {
              foremanId: string;
              foremanName: string;
              sites: Array<{
                siteName: string;
                siteCode?: string | null;
                foremanDays: number;
                foremanWages: number;
                teamDays: number;
                teamWages: number;
                totalWages: number;
              }>;
            }
          >;
        }
      >();

      for (const row of rowsAdmin) {
        const supId = row.supervisor?.id ?? "__none__";
        const supName = row.supervisor?.name ?? "No Supervisor";
        const fmId = row.foreman?.id ?? "__unknown__";
        const fmName = row.foreman?.name ?? "Unknown";

        if (!supervisorMap.has(supId)) {
          supervisorMap.set(supId, {
            supervisorId: row.supervisor?.id ?? null,
            supervisorName: supName,
            foremanMap: new Map(),
          });
        }
        const supEntry = supervisorMap.get(supId)!;

        if (!supEntry.foremanMap.has(fmId)) {
          supEntry.foremanMap.set(fmId, {
            foremanId: fmId,
            foremanName: fmName,
            sites: [],
          });
        }
        const fmEntry = supEntry.foremanMap.get(fmId)!;

        for (const site of row.sites ?? []) {
          fmEntry.sites.push({
            siteName: site.name,
            siteCode: site.code ?? null,
            foremanDays: Number(row.foremanDays ?? 0),
            foremanWages: Number(row.foremanWages ?? 0),
            teamDays: Number(row.teamDays ?? 0),
            teamWages: Number(row.teamWages ?? 0),
            totalWages: Number(row.totalWorkerWages ?? 0),
          });
        }
      }

      const groups: SupervisorSummaryGroup[] = Array.from(
        supervisorMap.values(),
      )
        .map((supEntry) => {
          const foremen = Array.from(supEntry.foremanMap.values())
            .map((fm) => {
              const foremanDays = fm.sites.reduce(
                (s, r) => s + r.foremanDays,
                0,
              );
              const foremanWages = fm.sites.reduce(
                (s, r) => s + r.foremanWages,
                0,
              );
              const teamDays = fm.sites.reduce((s, r) => s + r.teamDays, 0);
              const teamWages = fm.sites.reduce((s, r) => s + r.teamWages, 0);
              return {
                foremanId: fm.foremanId,
                foremanName: fm.foremanName,
                sites: fm.sites,
                foremanDays,
                foremanWages,
                teamDays,
                teamWages,
                grandTotal: foremanWages + teamWages,
              };
            })
            .sort((a, b) => a.foremanName.localeCompare(b.foremanName));

          const totalForemanDays = foremen.reduce(
            (s, f) => s + f.foremanDays,
            0,
          );
          const totalForemanWages = foremen.reduce(
            (s, f) => s + f.foremanWages,
            0,
          );
          const totalTeamDays = foremen.reduce((s, f) => s + f.teamDays, 0);
          const totalTeamWages = foremen.reduce((s, f) => s + f.teamWages, 0);

          return {
            supervisorId: supEntry.supervisorId,
            supervisorName: supEntry.supervisorName,
            foremen,
            totalForemanDays,
            totalForemanWages,
            totalTeamDays,
            totalTeamWages,
            grandTotal: totalForemanWages + totalTeamWages,
          };
        })
        .sort((a, b) => a.supervisorName.localeCompare(b.supervisorName));

      if (groups.length === 0) {
        toast.info("No foreman data to print");
        return;
      }

      printAllSupervisorSummaries(
        groups,
        currentPeriod.startISO,
        currentPeriod.endISO,
      );
    } catch (err: any) {
      console.error("Print all summaries error:", err);
      toast.error(err?.message ?? "Failed to generate summaries");
    } finally {
      setPrintingAllSummaries(false);
    }
  }, [rowsAdmin, currentPeriod]);

  // ── FIXED: handleExportAllForemenExcel — matches source XLS exactly ──────────
  const handleExportAllForemenExcel = useCallback(async () => {
    if (!currentPeriod) {
      toast.error("No period selected");
      return;
    }
    if (foremanTotals.length === 0) {
      toast.info("No foreman data to export");
      return;
    }

    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = "FCP Timesheet App";
    wb.created = new Date();

    const ws = wb.addWorksheet("Sheet2");

    // Column widths (EXACT)
    ws.columns = [
      { width: 10581 / 256 },
      { width: 6769 / 256 },
      { width: 5888 / 256 },
      { width: 4608 / 256 },
      { width: 10268 / 256 },
    ];

    const THICK = { style: "medium" as const, color: { argb: "FF000000" } };
    const THIN = { style: "thin" as const, color: { argb: "FF000000" } };

    const B_HDR = { left: THICK, right: THICK, top: THICK, bottom: THICK };
    const B_FIRST = { left: THICK, right: THICK, top: THIN, bottom: THIN };
    const B_CONT = { left: THICK, right: THICK };
    const B_TOTAL = { left: THICK, right: THICK, bottom: THICK };

    const mkFont = (
      name: string,
      size: number,
      bold = false,
      underline = false,
    ) => ({
      name,
      size,
      bold,
      color: { argb: "FF000000" },
      ...(underline ? { underline: true } : {}),
    });

    const FH_NAME = mkFont("Tahoma", 16, true, true);
    const FH_BT = mkFont("Tahoma", 16, true, true);
    const FH_BANK = mkFont("Arial", 16, true, true);
    const FH_VAL = mkFont("Arial", 10, true, true);
    const FH_SITE = mkFont("Arial", 10, true, true);

    const FD_NAME = mkFont("Tahoma", 16);
    const FD_BT = mkFont("Tahoma", 16);
    const FD_BANK = mkFont("Arial", 16);
    const FD_VAL = mkFont("Arial", 10);
    const FD_SITE = mkFont("Arial", 10);
    const FT_BT = mkFont("Tahoma", 16, true);

    const ROW_HEIGHT = 30;

    const applyCell = (
      row: any,
      col: number,
      value: any,
      font: any,
      align: any,
      border: any,
    ) => {
      const c = row.getCell(col);
      if (value !== null && value !== undefined) c.value = value;
      c.font = font;
      c.alignment = { horizontal: align, vertical: "middle" };
      c.border = border;
    };

    // Header
    ws.getRow(1).height = ROW_HEIGHT;

    const hdr = ws.getRow(2);
    hdr.height = ROW_HEIGHT;
    applyCell(hdr, 1, "Name", FH_NAME, "center", B_HDR);
    applyCell(hdr, 2, "Bank Transfer", FH_BT, "center", B_HDR);
    applyCell(hdr, 3, "Bank", FH_BANK, "center", B_HDR);
    applyCell(hdr, 4, "Value", FH_VAL, "center", B_HDR);
    applyCell(hdr, 5, "Site", FH_SITE, "center", B_HDR);

    const spacer = ws.getRow(3);
    spacer.height = ROW_HEIGHT;
    for (let i = 1; i <= 5; i++) spacer.getCell(i).border = B_CONT;

    // ✅ FIX: Name formatter
    const fmtName = (fullName: string): string => {
      const clean = fullName.trim();

      // Case 1: already formatted like "Mpofu 2, Michael"
      if (clean.includes(",")) {
        const [surnamePart, firstPart] = clean.split(",");

        const toTitle = (s: string) =>
          s
            .trim()
            .split(" ")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(" ");

        return `${toTitle(surnamePart)} , ${toTitle(firstPart)}`.replace(
          " ,",
          ",",
        );
      }

      // Case 2: normal "Michael Mpofu" OR "Michael Mpofu 2"
      const parts = clean.split(/\s+/);

      if (parts.length < 2) return clean;

      const toTitle = (s: string) =>
        s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

      // If last part is a number → attach it to surname
      const last = parts[parts.length - 1];
      const secondLast = parts[parts.length - 2];

      if (/^\d+$/.test(last)) {
        return `${toTitle(secondLast)} ${last}, ${parts
          .slice(0, -2)
          .map(toTitle)
          .join(" ")}`;
      }

      return `${toTitle(last)}, ${parts.slice(0, -1).map(toTitle).join(" ")}`;
    };

    // ✅ FIX: Sort by surname
    const sortedForemanTotals = [...foremanTotals].sort((a, b) => {
      const getSurname = (name: string) => {
        const clean = name.trim();

        if (clean.includes(",")) {
          return clean.split(",")[0].trim().toLowerCase();
        }

        const parts = clean.split(/\s+/);

        if (parts.length >= 2 && /^\d+$/.test(parts[parts.length - 1])) {
          return `${parts[parts.length - 2]} ${parts[parts.length - 1]}`.toLowerCase();
        }

        return parts[parts.length - 1].toLowerCase();
      };
      return getSurname(a.foremanName).localeCompare(getSurname(b.foremanName));
    });

    // Group sites
    const sitesByForeman = new Map<
      string,
      { siteName: string; value: number }[]
    >();
    for (const row of rowsAdmin) {
      const fmId = row.foreman?.id ?? "unknown";
      if (!sitesByForeman.has(fmId)) sitesByForeman.set(fmId, []);

      const site = row.sites?.[0];
      const value =
        Number(row.foremanWages ?? 0) +
        Number(row.teamWages ?? 0) +
        Number(row.totalOvertimeCost ?? 0);

      sitesByForeman.get(fmId)!.push({
        siteName: site?.name ?? "—",
        value,
      });
    }

    for (const [, sites] of sitesByForeman) {
      sites.sort((a, b) => a.siteName.localeCompare(b.siteName));
    }

    let rowNum = 4;
    let grandTotal = 0;

    for (const ft of sortedForemanTotals) {
      const sites = sitesByForeman.get(ft.foremanId) ?? [];
      grandTotal += ft.grandTotal;

      for (let i = 0; i < Math.max(1, sites.length); i++) {
        const isFirst = i === 0;
        const border = isFirst ? B_FIRST : B_CONT;

        const r = ws.getRow(rowNum++);
        r.height = ROW_HEIGHT;

        applyCell(
          r,
          1,
          isFirst ? fmtName(ft.foremanName) : null,
          FD_NAME,
          "left",
          border,
        );
        applyCell(r, 2, isFirst ? ft.grandTotal : null, FD_BT, "right", border);
        applyCell(
          r,
          3,
          isFirst ? (ft.bankName ?? "") : null,
          FD_BANK,
          "center",
          border,
        );
        applyCell(r, 4, sites[i]?.value ?? null, FD_VAL, "general", border);
        applyCell(r, 5, sites[i]?.siteName ?? null, FD_SITE, "general", border);
      }
    }

    // Close the bottom of the last data row (continuation rows have no bottom border)
    const lastDataRow = ws.getRow(rowNum - 1);
    for (let col = 1; col <= 5; col++) {
      const cell = lastDataRow.getCell(col);
      const cur = (cell.border || {}) as any;
      cell.border = { ...cur, bottom: THICK };
    }

    // Clean blank spacer — no borders, just height
    ws.getRow(rowNum++).height = ROW_HEIGHT;

    const totalRow = ws.getRow(rowNum);
    totalRow.height = ROW_HEIGHT;
    applyCell(totalRow, 2, grandTotal, FT_BT, "right", B_TOTAL);

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `foreman-payments-${currentPeriod.startISO}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success("Excel exported");
  }, [foremanTotals, rowsAdmin, currentPeriod]);

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

  const adminColumns = useMemo<ColumnDef<AdminRow>[]>(
    () => [
      {
        id: "fortnight",
        accessorFn: (row) => row.startISO,
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(isSorted === "asc")}
            >
              Fortnight
              {isSorted === "asc" ? (
                <ChevronUp className="h-4 w-4" />
              ) : isSorted === "desc" ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          );
        },
        cell: ({ row }) => (
          <span className="font-medium">
            {prettyRange(row.original.startISO, row.original.endISO)}
          </span>
        ),
      },
      {
        id: "sites",
        header: "Sites",
        cell: ({ row }) => (
          <div className="max-w-xs">
            <SiteBadges sites={row.original.sites as any[]} />
          </div>
        ),
      },
      {
        id: "foreman",
        accessorFn: (row) => row.foreman?.name ?? "",
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(isSorted === "asc")}
            >
              Foreman
              {isSorted === "asc" ? (
                <ChevronUp className="h-4 w-4" />
              ) : isSorted === "desc" ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          );
        },
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.foreman?.name ?? "—"}
          </span>
        ),
      },
      {
        id: "supervisor",
        accessorFn: (row) => row.supervisor?.name ?? "",
        header: "Supervisor",
        cell: ({ row }) => row.original.supervisor?.name ?? "—",
      },
      {
        id: "status",
        accessorKey: "status",
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(isSorted === "asc")}
            >
              Status
              {isSorted === "asc" ? (
                <ChevronUp className="h-4 w-4" />
              ) : isSorted === "desc" ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          );
        },
        cell: ({ row }) => <StatusPill status={row.original.status} />,
      },
      {
        id: "days",
        accessorKey: "totalWorkerDays",
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <div className="text-right">
              <button
                className="flex items-center gap-1 hover:text-foreground transition-colors ml-auto"
                onClick={() => column.toggleSorting(isSorted === "asc")}
              >
                Days
                {isSorted === "asc" ? (
                  <ChevronUp className="h-4 w-4" />
                ) : isSorted === "desc" ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>
          );
        },
        cell: ({ row }) => (
          <div className="text-right font-semibold">
            {row.original.totalWorkerDays ?? 0}
          </div>
        ),
      },
      {
        id: "wages",
        accessorKey: "totalWorkerWages",
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <div className="text-right">
              <button
                className="flex items-center gap-1 hover:text-foreground transition-colors ml-auto"
                onClick={() => column.toggleSorting(isSorted === "asc")}
              >
                Wages
                {isSorted === "asc" ? (
                  <ChevronUp className="h-4 w-4" />
                ) : isSorted === "desc" ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>
          );
        },
        cell: ({ row }) => (
          <div className="text-right font-semibold">
            {money(row.original.totalWorkerWages)}
          </div>
        ),
      },
    ],
    [],
  );

  const supColumns = useMemo<ColumnDef<SupervisorRow>[]>(
    () => [
      {
        id: "fortnight",
        accessorFn: (row) => row.startISO,
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(isSorted === "asc")}
            >
              Fortnight
              {isSorted === "asc" ? (
                <ChevronUp className="h-4 w-4" />
              ) : isSorted === "desc" ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          );
        },
        cell: ({ row }) => (
          <span className="font-medium">
            {prettyRange(
              iso10(row.original.startISO),
              iso10(row.original.endISO),
            )}
          </span>
        ),
      },
      {
        id: "site",
        header: "Site",
        cell: ({ row }) => (
          <div className="max-w-xs">
            <SiteBadgeFromListRow
              siteCode={row.original.siteCode}
              siteName={row.original.siteName}
            />
          </div>
        ),
      },
      {
        id: "foreman",
        accessorFn: (row) => row.foremanName ?? "",
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(isSorted === "asc")}
            >
              Foreman
              {isSorted === "asc" ? (
                <ChevronUp className="h-4 w-4" />
              ) : isSorted === "desc" ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          );
        },
        cell: ({ row }) => (
          <span className="font-medium">{row.original.foremanName ?? "—"}</span>
        ),
      },
      {
        id: "status",
        accessorKey: "status",
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(isSorted === "asc")}
            >
              Status
              {isSorted === "asc" ? (
                <ChevronUp className="h-4 w-4" />
              ) : isSorted === "desc" ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          );
        },
        cell: ({ row }) => <StatusPill status={row.original.status} />,
      },
      {
        id: "days",
        accessorKey: "totalWorkerDays",
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <div className="text-right">
              <button
                className="flex items-center gap-1 hover:text-foreground transition-colors ml-auto"
                onClick={() => column.toggleSorting(isSorted === "asc")}
              >
                Days
                {isSorted === "asc" ? (
                  <ChevronUp className="h-4 w-4" />
                ) : isSorted === "desc" ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>
          );
        },
        cell: ({ row }) => (
          <div className="text-right font-semibold">
            {row.original.totalWorkerDays ?? 0}
          </div>
        ),
      },
      {
        id: "wages",
        accessorKey: "totalWorkerWages",
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <div className="text-right">
              <button
                className="flex items-center gap-1 hover:text-foreground transition-colors ml-auto"
                onClick={() => column.toggleSorting(isSorted === "asc")}
              >
                Wages
                {isSorted === "asc" ? (
                  <ChevronUp className="h-4 w-4" />
                ) : isSorted === "desc" ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>
          );
        },
        cell: ({ row }) => (
          <div className="text-right font-semibold">
            {money(row.original.totalWorkerWages)}
          </div>
        ),
      },
    ],
    [],
  );

  const adminTable = useReactTable({
    data: rowsAdmin,
    columns: adminColumns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row, index) => row.rowKey ?? `${row.id}__${index}`,
  });

  const supTable = useReactTable({
    data: rowsSup,
    columns: supColumns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row, index) => row.rowKey ?? `${row.id}__${index}`,
  });

  const table = mode === "ADMIN" ? adminTable : supTable;

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

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const t = setTimeout(
      () => setAnalyticsSearchDebounced(analyticsSearch.trim()),
      250,
    );
    return () => clearTimeout(t);
  }, [analyticsSearch]);

  useEffect(() => {
    if (mode !== "ADMIN" || !periodsSorted.length) return;
    setAnalyticsFromISO((prev) => prev || periodsSorted[0].startISO);
    setAnalyticsToISO(
      (prev) => prev || periodsSorted[periodsSorted.length - 1].endISO,
    );
  }, [mode, periodsSorted]);

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

  const listAbortRef = useRef<AbortController | null>(null);

  const loadList = useCallback(async () => {
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
        setRowsAdmin(ensureUniqueRowKeys(list as AdminRow[]));
        if (supervisorId !== "ALL") {
          const valid = (list as AdminRow[]).some(
            (r) => r.supervisor?.id === supervisorId,
          );
          if (!valid) setSupervisorId("ALL");
        }
      } else {
        setRowsSup(ensureUniqueRowKeys(list as SupervisorRow[]));
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

  useEffect(() => {
    if (!periodId) return;
    loadList();
    return () => listAbortRef.current?.abort();
  }, [loadList, periodId]);

  const loadWageAnalytics = useCallback(async () => {
    if (mode !== "ADMIN") return;
    if (!periodsSorted.length) {
      setAnalyticsRows([]);
      setAnalyticsErr(null);
      return;
    }

    const fromISO = analyticsFromISO || periodsSorted[0].startISO;
    const toISO =
      analyticsToISO || periodsSorted[periodsSorted.length - 1].endISO;

    if (fromISO > toISO) {
      setAnalyticsErr("From date must be before To date.");
      setAnalyticsRows([]);
      return;
    }

    const targetPeriods = periodsSorted.filter(
      (p) =>
        (analyticsFortnightId === "ALL" || p.id === analyticsFortnightId) &&
        overlapsRange(p, fromISO, toISO),
    );

    if (!targetPeriods.length) {
      setAnalyticsRows([]);
      setAnalyticsErr(null);
      return;
    }

    setAnalyticsLoading(true);
    setAnalyticsErr(null);

    try {
      const payloads = await Promise.all(
        targetPeriods.map(async (period) => {
          const url = new URL(
            "/api/app/admin/timesheets",
            window.location.origin,
          );
          url.searchParams.set("period", period.id);
          if (analyticsSupervisorId !== "ALL") {
            url.searchParams.set("supervisorId", analyticsSupervisorId);
          }
          if (analyticsSearchDebounced) {
            url.searchParams.set("q", analyticsSearchDebounced);
          }

          const res = await fetch(url.toString(), {
            cache: "no-store",
            credentials: "include",
            headers: { accept: "application/json" },
          });

          const body = await res.json().catch(() => null);
          if (!res.ok) {
            const msg =
              body?.error ||
              body?.message ||
              `Failed to load analytics for ${period.id} (${res.status})`;
            throw new Error(msg);
          }

          const rows =
            (Array.isArray(body?.timesheets) &&
              (body.timesheets as AdminRow[])) ||
            [];

          return { period, rows };
        }),
      );

      const mapped = payloads.flatMap(({ period, rows }) => {
        const monthIndex = new Date(
          `${period.startISO}T00:00:00.000Z`,
        ).getUTCMonth();
        const monthLabel = MONTH_LABELS[monthIndex] ?? "—";

        return rows
          .map((row) => {
            const firstSite = row.sites?.[0];
            if (!firstSite) return null;

            return {
              periodId: period.id,
              periodLabel: prettyRange(period.startISO, period.endISO),
              startISO: period.startISO,
              endISO: period.endISO,
              monthIndex,
              monthLabel,
              supervisorId: row.supervisor?.id ?? "UNASSIGNED",
              supervisorName: row.supervisor?.name ?? "Unassigned",
              foremanName: row.foreman?.name ?? "Foreman",
              siteId: firstSite.id,
              siteCode: String(firstSite.code ?? "").trim(),
              siteName: firstSite.name,
              status: row.status,
              wages: Number(row.totalWorkerWages ?? 0),
              days: Number(row.totalWorkerDays ?? 0),
            } as WageAnalyticsRow;
          })
          .filter(Boolean) as WageAnalyticsRow[];
      });

      setAnalyticsRows(mapped);
    } catch (e) {
      setAnalyticsRows([]);
      setAnalyticsErr(toSafeErrorText(e));
    } finally {
      setAnalyticsLoading(false);
    }
  }, [
    mode,
    periodsSorted,
    analyticsFromISO,
    analyticsToISO,
    analyticsFortnightId,
    analyticsSupervisorId,
    analyticsSearchDebounced,
  ]);

  useEffect(() => {
    if (!analyticsOpen || mode !== "ADMIN") return;
    loadWageAnalytics();
  }, [analyticsOpen, mode, loadWageAnalytics]);

  const analyticsRowsFiltered = useMemo(() => {
    const selectedRange =
      WAGE_RANGE_OPTIONS.find((option) => option.value === analyticsWageRange) ??
      WAGE_RANGE_OPTIONS[0];
    return analyticsRows.filter((r) => {
      if (analyticsMonth !== "ALL" && String(r.monthIndex) !== analyticsMonth) {
        return false;
      }
      if (selectedRange.value !== "ALL" && r.wages <= selectedRange.min) {
        return false;
      }
      if (selectedRange.max !== null && r.wages > selectedRange.max) {
        return false;
      }
      return true;
    });
  }, [analyticsRows, analyticsMonth, analyticsWageRange]);

  const analyticsTotalWages = useMemo(
    () => analyticsRowsFiltered.reduce((sum, r) => sum + r.wages, 0),
    [analyticsRowsFiltered],
  );

  const analyticsMonthlyBreakdown = useMemo(() => {
    return MONTH_LABELS.map((label, monthIndex) => {
      const total = analyticsRowsFiltered.reduce((sum, row) => {
        if (row.monthIndex !== monthIndex) return sum;
        return sum + row.wages;
      }, 0);
      const pct =
        analyticsTotalWages > 0 ? (total / analyticsTotalWages) * 100 : 0;
      return { monthIndex, label, total, pct };
    });
  }, [analyticsRowsFiltered, analyticsTotalWages]);

  const analyticsMonthlyRows = useMemo(() => {
    const rankSeed = [...analyticsMonthlyBreakdown]
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return a.monthIndex - b.monthIndex;
      })
      .map((r, idx) => ({ monthIndex: r.monthIndex, rank: idx + 1 }));

    const rankMap = new Map<number, number>(
      rankSeed.map((x) => [x.monthIndex, x.rank]),
    );

    const rows = analyticsMonthlyBreakdown.map((m) => ({
      ...m,
      rank: rankMap.get(m.monthIndex) ?? 99,
    }));

    const dir = monthlySortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (monthlySortBy === "month") return (a.monthIndex - b.monthIndex) * dir;
      if (monthlySortBy === "wages") return (a.total - b.total) * dir;
      if (monthlySortBy === "pct") return (a.pct - b.pct) * dir;
      return (a.rank - b.rank) * dir;
    });
  }, [analyticsMonthlyBreakdown, monthlySortBy, monthlySortDir]);

  const toggleMonthlySort = useCallback((key: MonthlySortKey) => {
    setMonthlySortBy((prev) => {
      if (prev === key) {
        setMonthlySortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setMonthlySortDir(key === "rank" ? "asc" : "desc");
      return key;
    });
  }, []);

  const monthlySortIcon = useCallback(
    (key: MonthlySortKey) => {
      if (monthlySortBy !== key) {
        return <ArrowUpDown className="h-4 w-4 text-muted-foreground" />;
      }
      return monthlySortDir === "asc" ? (
        <ChevronUp className="h-4 w-4" />
      ) : (
        <ChevronDown className="h-4 w-4" />
      );
    },
    [monthlySortBy, monthlySortDir],
  );

  const analyticsSitesByFortnight = useMemo(() => {
    const byPeriod = new Map<
      string,
      {
        periodLabel: string;
        startISO: string;
        sites: Map<
          string,
          { siteCode: string; siteName: string; wages: number }
        >;
      }
    >();

    for (const row of analyticsRowsFiltered) {
      const periodBucket = byPeriod.get(row.periodId) ?? {
        periodLabel: row.periodLabel,
        startISO: row.startISO,
        sites: new Map<
          string,
          { siteCode: string; siteName: string; wages: number }
        >(),
      };

      const siteKey = `${row.siteId}`;
      const prev = periodBucket.sites.get(siteKey);
      periodBucket.sites.set(siteKey, {
        siteCode: row.siteCode,
        siteName: row.siteName,
        wages: (prev?.wages ?? 0) + row.wages,
      });

      byPeriod.set(row.periodId, periodBucket);
    }

    return Array.from(byPeriod.entries())
      .flatMap(([periodId, period]) => {
        const rankedSites = Array.from(period.sites.values()).sort(
          (a, b) => b.wages - a.wages,
        );

        return rankedSites.map((site, idx) => ({
          periodId,
          periodLabel: period.periodLabel,
          startISO: period.startISO,
          siteCode: site.siteCode,
          siteName: site.siteName,
          wages: site.wages,
          rank: idx + 1,
          isTop: idx === 0,
        }));
      })
      .sort((a, b) => {
        if (a.startISO !== b.startISO) {
          return a.startISO.localeCompare(b.startISO);
        }
        return a.rank - b.rank;
      });
  }, [analyticsRowsFiltered]);

  const analyticsTopSiteByFortnight = useMemo(() => {
    const seen = new Set<string>();
    return analyticsSitesByFortnight
      .filter((row) => {
        if (!row.isTop) return false;
        if (seen.has(row.periodId)) return false;
        seen.add(row.periodId);
        return true;
      })
      .map((row) => ({
        periodId: row.periodId,
        periodLabel: row.periodLabel,
        siteCode: row.siteCode,
        siteName: row.siteName,
        wages: row.wages,
      }));
  }, [analyticsSitesByFortnight]);

  const monthlyPageCount = Math.max(
    1,
    Math.ceil(analyticsMonthlyRows.length / monthlyPagination.pageSize),
  );

  const pagedMonthlyRows = useMemo(() => {
    const start = monthlyPagination.pageIndex * monthlyPagination.pageSize;
    return analyticsMonthlyRows.slice(
      start,
      start + monthlyPagination.pageSize,
    );
  }, [
    analyticsMonthlyRows,
    monthlyPagination.pageIndex,
    monthlyPagination.pageSize,
  ]);

  const siteAnalyticsPageCount = Math.max(
    1,
    Math.ceil(
      analyticsSitesByFortnight.length / siteAnalyticsPagination.pageSize,
    ),
  );

  const pagedSiteAnalyticsRows = useMemo(() => {
    const start =
      siteAnalyticsPagination.pageIndex * siteAnalyticsPagination.pageSize;
    return analyticsSitesByFortnight.slice(
      start,
      start + siteAnalyticsPagination.pageSize,
    );
  }, [
    analyticsSitesByFortnight,
    siteAnalyticsPagination.pageIndex,
    siteAnalyticsPagination.pageSize,
  ]);

  useEffect(() => {
    setMonthlyPagination((prev) => {
      const safeIndex = Math.min(
        prev.pageIndex,
        Math.max(0, monthlyPageCount - 1),
      );
      if (safeIndex === prev.pageIndex) return prev;
      return { ...prev, pageIndex: safeIndex };
    });
  }, [monthlyPageCount]);

  useEffect(() => {
    setSiteAnalyticsPagination((prev) => {
      const safeIndex = Math.min(
        prev.pageIndex,
        Math.max(0, siteAnalyticsPageCount - 1),
      );
      if (safeIndex === prev.pageIndex) return prev;
      return { ...prev, pageIndex: safeIndex };
    });
  }, [siteAnalyticsPageCount]);

  useEffect(() => {
    setMonthlyPagination((prev) => ({ ...prev, pageIndex: 0 }));
    setSiteAnalyticsPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [
    analyticsMonth,
    analyticsFortnightId,
    analyticsSupervisorId,
    analyticsWageRange,
    analyticsFromISO,
    analyticsToISO,
    analyticsSearchDebounced,
  ]);

  const handleDownloadBreakdownPdf = useCallback(async () => {
    if (!currentPeriod) {
      toast.error("No period selected");
      return;
    }

    if (foremanTotals.length === 0) {
      toast.info("No foreman data to export");
      return;
    }

    try {
      setPrintingAllSummaries(true);

      const supervisorMap = new Map<
        string,
        {
          supervisorName: string;
          rows: Array<{
            foremanName: string;
            siteName: string;
            siteCode?: string | null;
            foremanDays: number;
            teamDays: number;
            foremanWages: number;
            teamWages: number;
            total: number;
          }>;
        }
      >();

      for (const row of rowsAdmin) {
        const supName = row.supervisor?.name ?? "No Supervisor";

        if (!supervisorMap.has(supName)) {
          supervisorMap.set(supName, {
            supervisorName: supName,
            rows: [],
          });
        }

        const group = supervisorMap.get(supName)!;

        for (const site of row.sites ?? []) {
          group.rows.push({
            foremanName: row.foreman?.name ?? "Unknown",
            siteName: site.name,
            siteCode: site.code ?? null,
            foremanDays: Number(row.foremanDays ?? 0),
            teamDays: Number(row.teamDays ?? 0),
            foremanWages: Number(row.foremanWages ?? 0),
            teamWages: Number(row.teamWages ?? 0),
            total: Number(row.totalWorkerWages ?? 0),
          });
        }
      }

      const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />

<style>
@page {
  size: A4 landscape;
  margin: 10mm;
}

body {
  font-family: Arial, sans-serif;
  font-size: 11px;
  color: #111;
}

.title {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 4px;
}

.period {
  margin-bottom: 20px;
}

.supervisor {
  margin-top: 24px;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: bold;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  border: 1px solid #222;
  background: #efefef;
  padding: 6px;
  text-align: left;
}

td {
  border: 1px solid #bbb;
  padding: 6px;
}

.right {
  text-align: right;
}
</style>
</head>

<body>

<div class="title">
  FOREMAN BREAKDOWN REPORT
</div>

<div class="period">
  ${currentPeriod.startISO} → ${currentPeriod.endISO}
</div>

${Array.from(supervisorMap.values())
  .map(
    (group) => `
<div class="supervisor">
  ${group.supervisorName}
</div>

<table>
<thead>
<tr>
  <th>Foreman</th>
  <th>Site</th>
  <th>F/Days</th>
  <th>Team Days</th>
  <th>F/Wages</th>
  <th>Team Wages</th>
  <th>Total</th>
</tr>
</thead>

<tbody>
${group.rows
  .map(
    (r) => `
<tr>
  <td>${r.foremanName}</td>

  <td>
    ${r.siteCode ? `${r.siteCode} · ` : ""}
    ${r.siteName}
  </td>

  <td class="right">${r.foremanDays}</td>
  <td class="right">${r.teamDays}</td>
  <td class="right">${money(r.foremanWages)}</td>
  <td class="right">${money(r.teamWages)}</td>
  <td class="right">${money(r.total)}</td>
</tr>
`,
  )
  .join("")}
</tbody>
</table>
`,
  )
  .join("")}

</body>
</html>
`;

      const win = window.open("", "_blank");

      if (!win) {
        toast.error("Failed to open print window");
        return;
      }

      win.document.write(html);
      win.document.close();

      setTimeout(() => {
        win.focus();
        win.print();
      }, 300);

      toast.success("Breakdown PDF ready");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Failed to generate breakdown PDF");
    } finally {
      setPrintingAllSummaries(false);
    }
  }, [currentPeriod, foremanTotals, rowsAdmin]);

  const handleDownloadSiteWagesPdf = useCallback(async () => {
    const selectedRange =
      WAGE_RANGE_OPTIONS.find((option) => option.value === analyticsWageRange) ??
      WAGE_RANGE_OPTIONS[0];
    const selectedPeriod =
      analyticsFortnightId !== "ALL"
        ? periods.find((p) => p.id === analyticsFortnightId)
        : currentPeriod;

    if (!selectedPeriod) {
      toast.error("Select a fortnight before downloading");
      return;
    }

    try {
      setPrintingAllSummaries(true);

      const url = new URL(
        "/api/app/admin/reports/site-wages.pdf",
        window.location.origin,
      );
      url.searchParams.set("from", selectedPeriod.startISO);
      url.searchParams.set("to", selectedPeriod.endISO);
      url.searchParams.set("min", String(selectedRange.min));
      if (selectedRange.max !== null) {
        url.searchParams.set("max", String(selectedRange.max));
      }

      const res = await fetch(url.toString(), {
        cache: "no-store",
        credentials: "include",
        headers: { accept: "application/pdf" },
      });
      if (!res.ok) {
        throw new Error(`Failed to download PDF (${res.status})`);
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `site-wages-${selectedPeriod.startISO}-${selectedRange.value}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);

      toast.success("Site wages PDF downloaded");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Failed to download site wages PDF");
    } finally {
      setPrintingAllSummaries(false);
    }
  }, [analyticsFortnightId, analyticsWageRange, currentPeriod, periods]);

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
    const base = mode === "ADMIN" ? "/api/app/admin" : "/api/app/supervisor";

    let endISO: string | null = null;
    let startISO: string | null = null;
    if (detail) {
      endISO = detail?.endISO ?? null;
      startISO = detail?.startISO ?? null;
    } else if (activeId) {
      const parts = activeId.split("_");
      if (parts.length >= 2) {
        startISO = parts[0];
        endISO = parts[1];
      }
    }

    const result: TimesheetAction[] = [];

    if (mode === "SUPERVISOR") {
      const today = new Date().toISOString().slice(0, 10);
      const isLastDayOrLater = endISO ? today >= endISO : false;
      const isWithinPeriod =
        startISO && endISO ? today >= startISO && today <= endISO : false;

      if (isWithinPeriod && !isLastDayOrLater) {
        result.push({
          id: "accept-day",
          label: `Accept Today (${today})`,
          canPerform: (s) => s === "SUBMITTED" || s === "ACCEPTED",
          handler: async () => {
            if (!activeId) return;
            await postJson(
              `${base}/timesheets/${encodeURIComponent(activeId)}/accept-day`,
              { date: today, action: "accept" },
            );
            setTimeout(() => refreshDetail(), 300);
          },
        });

        result.push({
          id: "reject-day",
          label: `Reject Today (${today})`,
          variant: "destructive",
          canPerform: (s) => s === "SUBMITTED" || s === "ACCEPTED",
          requiresReason: true,
          handler: async (reason) => {
            if (!activeId) return;
            await postJson(
              `${base}/timesheets/${encodeURIComponent(activeId)}/accept-day`,
              { date: today, action: "reject", reason },
            );
            setTimeout(() => refreshDetail(), 300);
          },
        });
      }

      if (isLastDayOrLater) {
        result.push({
          id: "approve",
          label: "Final Approve",
          canPerform: (s) => s === "SUBMITTED" || s === "ACCEPTED",
          handler: async () => {
            if (!activeId) return;
            await postJson(
              `${base}/timesheets/${encodeURIComponent(activeId)}/approve`,
            );
            setTimeout(() => refreshDetail(), 300);
          },
        });

        result.push({
          id: "reject",
          label: "Reject",
          variant: "destructive",
          canPerform: (s) => s === "SUBMITTED" || s === "ACCEPTED",
          requiresReason: true,
          handler: async (reason) => {
            if (!activeId) return;
            await postJson(
              `${base}/timesheets/${encodeURIComponent(activeId)}/reject`,
              { reason },
            );
            setTimeout(() => refreshDetail(), 300);
          },
        });
      }
    }

    result.push({
      id: "paid",
      label: "Mark Paid",
      variant: "outline",
      canPerform: (s) => s === "APPROVED",
      handler: async () => {
        if (!activeId) return;

        if (gridModel) {
          try {
            const dto = (detail as any)?.timesheet ?? detail;
            const foremanName =
              dto?.foremanName ?? dto?.foreman?.user?.name ?? "Foreman";
            const siteName = dto?.sites?.[0]?.name ?? dto?.siteName ?? "Site";
            const siteCode = dto?.sites?.[0]?.code ?? dto?.siteCode ?? "";

            const pdfBytes = await generateTimesheetPdf(gridModel, {
              foremanName,
              siteName,
              siteCode,
              startISO: startISO ?? undefined,
              endISO: endISO ?? undefined,
              status: "PAID",
            });

            const filename = `timesheet-${foremanName.replace(/\s+/g, "-")}-${siteName.replace(/\s+/g, "-")}-${startISO ?? "period"}.pdf`;
            downloadTimesheetPdf(pdfBytes, filename);
          } catch (pdfErr) {
            console.error("PDF generation failed:", pdfErr);
            toast.error(
              "Failed to generate PDF archive. Timesheet will still be marked as paid.",
            );
          }
        }

        await postJson(
          `${base}/timesheets/${encodeURIComponent(activeId)}/paid`,
        );
        setTimeout(() => refreshDetail(), 300);
      },
    });

    return result;
  }, [mode, activeId, detail, gridModel, refreshDetail]);

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

        <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-4">
          <div className="text-sm text-muted-foreground whitespace-nowrap">
            Total wages:{" "}
            <span className="font-semibold">{money(totalWages)}</span>
            {mode === "ADMIN" && totalOvertime > 0 && (
              <>
                {" "}
                • Overtime:{" "}
                <span className="font-semibold text-orange-600 dark:text-orange-400">
                  {money(totalOvertime)}
                </span>
              </>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={loadList}
              disabled={loading || !periodId}
            >
              Refresh
            </Button>

            {mode === "ADMIN" ? (
              <Button
                variant="outline"
                onClick={() => setAnalyticsOpen(true)}
                disabled={!periods.length}
              >
                Wage Cost Analytics
              </Button>
            ) : null}

            <Button
              className="bg-sky-600 hover:bg-sky-600/90 text-white"
              onClick={reset}
            >
              Reset
            </Button>
          </div>
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

      {mode === "ADMIN" && foremanTotals.length > 0 && !loading && (
        <div className="rounded border bg-card overflow-hidden">
          <div
            role="button"
            tabIndex={0}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer"
            onClick={() => setForemanTotalsExpanded(!foremanTotalsExpanded)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ")
                setForemanTotalsExpanded((v) => !v);
            }}
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Foreman Totals</span>
              <Badge variant="secondary" className="text-xs">
                {foremanTotals.length} foremen
              </Badge>
              <span className="text-sm text-muted-foreground">•</span>
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                Net Pay Total:{" "}
                {money(foremanTotals.reduce((s, f) => s + f.grandTotal, 0))}
              </span>
              {foremanTotals.reduce((s, f) => s + f.totalOvertimeCost, 0) >
                0 && (
                <>
                  <span className="text-sm text-muted-foreground">•</span>
                  <span className="text-sm text-orange-600 dark:text-orange-400">
                    Overtime:{" "}
                    {money(
                      foremanTotals.reduce(
                        (s, f) => s + f.totalOvertimeCost,
                        0,
                      ),
                    )}
                  </span>
                </>
              )}
              {foremanTotals.reduce((s, f) => s + f.totalDeductions, 0) > 0 && (
                <>
                  <span className="text-sm text-muted-foreground">•</span>
                  <span className="text-sm text-amber-600 dark:text-amber-400">
                    Deductions:{" "}
                    {money(
                      foremanTotals.reduce((s, f) => s + f.totalDeductions, 0),
                    )}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                className="gap-1.5"
                onClick={(e) => {
                  e.stopPropagation();
                  setQuickViewOpen(true);
                }}
              >
                <Eye className="h-3.5 w-3.5" />
                Quick View
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  handleExportAllForemenExcel();
                }}
                title="Export all foremen to Excel"
              >
                <Download className="h-3.5 w-3.5" />
                Export Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                disabled={printingAllSummaries}
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrintAllSummaries();
                }}
                title="Print all foreman summaries grouped by supervisor"
              >
                {printingAllSummaries ? (
                  <Spinner className="h-3.5 w-3.5" />
                ) : (
                  <Printer className="h-3.5 w-3.5" />
                )}
                Print All Summaries
              </Button>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${
                  foremanTotalsExpanded ? "rotate-180" : ""
                }`}
              />
            </div>
          </div>
          <div
            className="grid transition-all duration-300 ease-in-out"
            style={{ gridTemplateRows: foremanTotalsExpanded ? "1fr" : "0fr" }}
          >
            <div className="overflow-hidden">
              <div className="border-t max-h-72 overflow-y-auto overflow-x-auto">
                <Table className="border-collapse min-w-200">
                  <TableHeader className="bg-muted/60 sticky top-0">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="px-3 py-2 text-xs font-semibold border border-zinc-200 dark:border-zinc-700">
                        Foreman
                      </TableHead>
                      <TableHead className="px-3 py-2 text-xs font-semibold text-center border border-zinc-200 dark:border-zinc-700">
                        Sites
                      </TableHead>
                      <TableHead className="px-3 py-2 text-xs font-semibold text-right border border-zinc-200 dark:border-zinc-700">
                        Foreman Days
                      </TableHead>
                      <TableHead className="px-3 py-2 text-xs font-semibold text-right border border-zinc-200 dark:border-zinc-700">
                        Foreman Amount
                      </TableHead>
                      <TableHead className="px-3 py-2 text-xs font-semibold text-right border border-zinc-200 dark:border-zinc-700">
                        Team Days
                      </TableHead>
                      <TableHead className="px-3 py-2 text-xs font-semibold text-right border border-zinc-200 dark:border-zinc-700">
                        Team Amount
                      </TableHead>
                      <TableHead className="px-3 py-2 text-xs font-semibold text-right border border-zinc-200 dark:border-zinc-700">
                        Overtime
                      </TableHead>
                      <TableHead className="px-3 py-2 text-xs font-semibold text-right border border-zinc-200 dark:border-zinc-700">
                        Deductions
                      </TableHead>
                      <TableHead className="px-3 py-2 text-xs font-semibold text-right border border-zinc-200 dark:border-zinc-700">
                        Net Pay
                      </TableHead>
                      <TableHead className="px-3 py-2 text-xs font-semibold text-center border border-zinc-200 dark:border-zinc-700">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {foremanTotals.map((ft) => (
                      <React.Fragment key={ft.foremanId}>
                        <TableRow className="hover:bg-muted/30">
                          <TableCell className="px-3 py-2 text-sm font-medium border border-zinc-200 dark:border-zinc-700">
                            {ft.foremanName}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-sm text-center border border-zinc-200 dark:border-zinc-700">
                            {ft.sitesCount}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-sm text-right border border-zinc-200 dark:border-zinc-700">
                            {ft.foremanDays}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-sm text-right border border-zinc-200 dark:border-zinc-700">
                            {money(ft.foremanWages)}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-sm text-right border border-zinc-200 dark:border-zinc-700">
                            {ft.teamDays}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-sm text-right border border-zinc-200 dark:border-zinc-700">
                            {money(ft.teamWages)}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-sm text-right border border-zinc-200 dark:border-zinc-700">
                            {ft.totalOvertimeCost > 0 ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-auto px-0 text-orange-600 dark:text-orange-400 underline-offset-2 hover:underline"
                                disabled={
                                  overtimeLoadingForemanId === ft.foremanId
                                }
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (
                                    overtimeExpandedForemanId === ft.foremanId
                                  ) {
                                    setOvertimeExpandedForemanId(null);
                                    return;
                                  }
                                  const existing =
                                    overtimeEntriesByForeman[ft.foremanId];
                                  const entries =
                                    existing ??
                                    (await loadOvertimeEntriesForForeman(
                                      ft.foremanId,
                                    ));
                                  if (!entries.length) {
                                    toast.info(
                                      "No overtime entries for this foreman in this period",
                                    );
                                    return;
                                  }
                                  setOvertimeExpandedForemanId(ft.foremanId);
                                }}
                                title="View overtime dates"
                              >
                                {overtimeLoadingForemanId === ft.foremanId
                                  ? "Loading…"
                                  : money(ft.totalOvertimeCost)}
                              </Button>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-sm text-right border border-zinc-200 dark:border-zinc-700">
                            {ft.totalDeductions > 0 ? (
                              <span className="text-amber-600 dark:text-amber-400">
                                -{money(ft.totalDeductions)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-sm text-right font-bold text-emerald-600 dark:text-emerald-400 border border-zinc-200 dark:border-zinc-700">
                            {money(ft.grandTotal)}
                          </TableCell>
                          <TableCell className="px-2 py-1 border border-zinc-200 dark:border-zinc-700">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                disabled={foremanPdfGenerating === ft.foremanId}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleForemanPdfAction(ft, "print");
                                }}
                                title="Print"
                              >
                                {foremanPdfGenerating === ft.foremanId ? (
                                  <Spinner className="h-4 w-4" />
                                ) : (
                                  <Printer className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                disabled={foremanPdfGenerating === ft.foremanId}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleForemanPdfAction(ft, "download");
                                }}
                                title="Download PDF"
                              >
                                {foremanPdfGenerating === ft.foremanId ? (
                                  <Spinner className="h-4 w-4" />
                                ) : (
                                  <Download className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {overtimeExpandedForemanId === ft.foremanId && (
                          <TableRow className="bg-muted/40">
                            <TableCell
                              colSpan={10}
                              className="px-3 py-2 text-xs border border-zinc-200 dark:border-zinc-700"
                            >
                              {overtimeLoadingForemanId === ft.foremanId ? (
                                <span>Loading overtime entries…</span>
                              ) : (
                                (() => {
                                  const entries =
                                    overtimeEntriesByForeman[ft.foremanId] ??
                                    [];
                                  if (!entries.length) {
                                    return (
                                      <span>
                                        No overtime entries for this foreman in
                                        this period.
                                      </span>
                                    );
                                  }
                                  return (
                                    <div className="flex flex-col gap-2">
                                      <div className="flex items-center justify-between">
                                        <span className="font-medium">
                                          Overtime dates for {ft.foremanName}
                                          {currentPeriod
                                            ? ` (${prettyRange(currentPeriod.startISO, currentPeriod.endISO)})`
                                            : ""}
                                        </span>
                                        <span className="text-muted-foreground">
                                          {entries.length} overtime
                                          {entries.length === 1
                                            ? " entry"
                                            : " entries"}
                                        </span>
                                      </div>
                                      <div className="mt-1 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                                        {entries.map((ot) => (
                                          <div
                                            key={ot.id}
                                            className="rounded border border-dashed px-2 py-1 flex flex-col gap-0.5"
                                          >
                                            <span className="font-medium">
                                              {new Date(
                                                `${ot.workDate}T00:00:00`,
                                              ).toLocaleDateString(undefined, {
                                                day: "numeric",
                                                month: "short",
                                                year: "numeric",
                                              })}
                                            </span>
                                            <span className="text-muted-foreground">
                                              {ot.siteCode
                                                ? `${ot.siteCode} — ${ot.siteName}`
                                                : ot.siteName}
                                            </span>
                                            <span>
                                              {ot.numberOfEmployees} employees •{" "}
                                              {ot.hoursWorked}h • R{" "}
                                              {money(ot.totalCost)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })()
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="border bg-card">
        <div className="overflow-x-auto">
          <Table className="border-collapse">
            <TableHeader className="bg-muted/60">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="border border-zinc-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide dark:border-zinc-700"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={mode === "ADMIN" ? 7 : 6}
                    className="h-24 text-center"
                  >
                    <Spinner className="mx-auto size-5" />
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => {
                  const original = row.original as AdminRow | SupervisorRow;
                  const handleClick = () => {
                    if (mode === "ADMIN") {
                      const r = original as AdminRow;
                      openDetail(
                        r.id,
                        Array.isArray(r.sites) && r.sites.length
                          ? r.sites[0]?.id
                          : undefined,
                      );
                    } else {
                      const r = original as SupervisorRow;
                      openDetail(r.id, r.siteId);
                    }
                  };
                  return (
                    <TableRow
                      key={row.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40 cursor-pointer transition-colors"
                      onClick={handleClick}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className="border border-zinc-200 px-3 py-2 dark:border-zinc-700"
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={mode === "ADMIN" ? 7 : 6}
                    className="h-24 text-center"
                  >
                    No timesheets found for this filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between border-t px-4 py-3">
          <div className="text-muted-foreground hidden text-sm lg:flex">
            Showing{" "}
            {table.getState().pagination.pageIndex *
              table.getState().pagination.pageSize +
              1}{" "}
            to{" "}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) *
                table.getState().pagination.pageSize,
              rows.length,
            )}{" "}
            of {rows.length} timesheets
          </div>
          <div className="flex w-full items-center gap-4 lg:w-fit lg:gap-8">
            <div className="hidden items-center gap-2 lg:flex">
              <span className="text-sm font-medium">Rows per page</span>
              <Select
                value={String(table.getState().pagination.pageSize)}
                onValueChange={(value) => {
                  table.setPageSize(Number(value));
                }}
              >
                <SelectTrigger className="h-8 w-20">
                  <SelectValue
                    placeholder={table.getState().pagination.pageSize}
                  />
                </SelectTrigger>
                <SelectContent side="top">
                  {[5, 10, 25, 50, 100].map((pageSize) => (
                    <SelectItem key={pageSize} value={String(pageSize)}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-fit items-center justify-center text-sm font-medium">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount() || 1}
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button
                variant="outline"
                size="icon"
                className="hidden h-8 w-8 lg:flex"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to first page</span>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="hidden h-8 w-8 lg:flex"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to last page</span>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
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
        mode={mode}
      />

      <Sheet open={quickViewOpen} onOpenChange={setQuickViewOpen}>
        <SheetContent
          side="bottom"
          className="h-[90vh] overflow-y-auto px-4 [&>button]:z-50 [&>button]:rounded-md [&>button]:bg-background"
        >
          <SheetHeader className="sticky top-0 z-30 -mx-4 border-b bg-background/95 px-4 pb-3 pt-2 backdrop-blur">
            <SheetTitle>Quick View</SheetTitle>
            <SheetDescription>
              Select a supervisor and period to preview their timesheet.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <TimesheetQuickViewClient />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={analyticsOpen} onOpenChange={setAnalyticsOpen}>
        <SheetContent
          side="bottom"
          className="h-screen w-screen overflow-y-auto px-4 [&>button]:z-50 [&>button]:rounded-md [&>button]:bg-background"
        >
          <SheetHeader className="sticky top-0 z-30 -mx-4 border-b bg-background/95 px-4 pb-3 pt-2 backdrop-blur">
            <div className="flex items-start justify-between gap-2 pr-10">
              <div>
                <SheetTitle>Overall Wage Cost Analytics</SheetTitle>
                <SheetDescription>
                  Breakdown by date range, month (Jan–Dec), supervisor,
                  fortnight, and job/site search.
                </SheetDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => setAnalyticsOpen(false)}
                aria-label="Close analytics sheet"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>

          {mode === "ADMIN" ? (
            <div className="mt-0 space-y-4">
              <div className="sticky top-19 z-20 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">
                      From
                    </div>
                    <Input
                      type="date"
                      value={analyticsFromISO}
                      onChange={(e) => setAnalyticsFromISO(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">
                      To
                    </div>
                    <Input
                      type="date"
                      value={analyticsToISO}
                      onChange={(e) => setAnalyticsToISO(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">
                      Month
                    </div>
                    <Select
                      value={analyticsMonth}
                      onValueChange={setAnalyticsMonth}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All months" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All months</SelectItem>
                        {MONTH_LABELS.map((label, index) => (
                          <SelectItem key={label} value={String(index)}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">
                      Fortnight
                    </div>
                    <Select
                      value={analyticsFortnightId}
                      onValueChange={setAnalyticsFortnightId}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All fortnights" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All fortnights</SelectItem>
                        {periodsSorted.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {prettyRange(p.startISO, p.endISO)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">
                      Supervisor
                    </div>
                    <Select
                      value={analyticsSupervisorId}
                      onValueChange={setAnalyticsSupervisorId}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All supervisors" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All supervisors</SelectItem>
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
                      Amount range
                    </div>
                    <Select
                      value={analyticsWageRange}
                      onValueChange={setAnalyticsWageRange}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All amounts" />
                      </SelectTrigger>
                      <SelectContent>
                        {WAGE_RANGE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">
                      Search (Job code / site / foreman)
                    </div>
                    <Input
                      value={analyticsSearch}
                      onChange={(e) => setAnalyticsSearch(e.target.value)}
                      placeholder="e.g. JN-1001, site code, or name"
                    />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={loadWageAnalytics}
                    disabled={analyticsLoading}
                  >
                    {analyticsLoading ? "Loading…" : "Apply Filters"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleDownloadSiteWagesPdf}
                    disabled={analyticsLoading || !analyticsRowsFiltered.length}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Wages PDF
                  </Button>
                  <Badge variant="secondary" className="ml-auto">
                    Total wages: {money(analyticsTotalWages)}
                  </Badge>
                </div>

                {analyticsErr ? (
                  <div className="mt-2 text-sm text-rose-600 dark:text-rose-400">
                    {analyticsErr}
                  </div>
                ) : null}
              </div>

              <div className="rounded border bg-card overflow-hidden">
                <div className="border-b px-4 py-2 text-sm font-semibold">
                  Monthly Percentage Analytics (Jan–Dec)
                </div>
                <div className="overflow-x-auto">
                  <Table className="border-collapse">
                    <TableHeader className="bg-muted/60">
                      <TableRow>
                        <TableHead className="border-r border-zinc-200 dark:border-zinc-700">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1"
                            onClick={() => toggleMonthlySort("month")}
                          >
                            Month {monthlySortIcon("month")}
                          </button>
                        </TableHead>
                        <TableHead className="text-right border-r border-zinc-200 dark:border-zinc-700">
                          <button
                            type="button"
                            className="ml-auto inline-flex items-center gap-1"
                            onClick={() => toggleMonthlySort("wages")}
                          >
                            Total Wages {monthlySortIcon("wages")}
                          </button>
                        </TableHead>
                        <TableHead className="text-right border-r border-zinc-200 dark:border-zinc-700">
                          <button
                            type="button"
                            className="ml-auto inline-flex items-center gap-1"
                            onClick={() => toggleMonthlySort("pct")}
                          >
                            % of Selected Total {monthlySortIcon("pct")}
                          </button>
                        </TableHead>
                        <TableHead className="text-center">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1"
                            onClick={() => toggleMonthlySort("rank")}
                          >
                            Rank {monthlySortIcon("rank")}
                          </button>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedMonthlyRows.length ? (
                        pagedMonthlyRows.map((m) => {
                          const rowTone =
                            m.rank === 1
                              ? "bg-emerald-600/12 dark:bg-emerald-600/18"
                              : m.rank === 2
                                ? "bg-sky-600/12 dark:bg-sky-600/18"
                                : m.rank === 3
                                  ? "bg-amber-600/12 dark:bg-amber-600/18"
                                  : "";
                          return (
                            <TableRow key={m.monthIndex} className={rowTone}>
                              <TableCell className="font-medium border-r border-zinc-200 dark:border-zinc-700">
                                {m.label}
                              </TableCell>
                              <TableCell className="text-right font-semibold border-r border-zinc-200 dark:border-zinc-700">
                                {money(m.total)}
                              </TableCell>
                              <TableCell className="text-right border-r border-zinc-200 dark:border-zinc-700">
                                {m.pct.toFixed(2)}%
                              </TableCell>
                              <TableCell className="text-center">
                                {m.rank === 1 ? (
                                  <Badge variant="secondary">1st</Badge>
                                ) : m.rank === 2 ? (
                                  <Badge variant="secondary">2nd</Badge>
                                ) : m.rank === 3 ? (
                                  <Badge variant="secondary">3rd</Badge>
                                ) : (
                                  m.rank
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="h-20 text-center">
                            No monthly analytics for this selection.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <div className="text-muted-foreground hidden text-sm lg:flex">
                    Showing{" "}
                    {analyticsMonthlyRows.length
                      ? monthlyPagination.pageIndex *
                          monthlyPagination.pageSize +
                        1
                      : 0}{" "}
                    to{" "}
                    {Math.min(
                      (monthlyPagination.pageIndex + 1) *
                        monthlyPagination.pageSize,
                      analyticsMonthlyRows.length,
                    )}{" "}
                    of {analyticsMonthlyRows.length} months
                  </div>
                  <div className="flex w-full items-center gap-4 lg:w-fit lg:gap-8">
                    <div className="hidden items-center gap-2 lg:flex">
                      <span className="text-sm font-medium">Rows per page</span>
                      <Select
                        value={String(monthlyPagination.pageSize)}
                        onValueChange={(value) =>
                          setMonthlyPagination({
                            pageIndex: 0,
                            pageSize: Number(value),
                          })
                        }
                      >
                        <SelectTrigger className="h-8 w-20">
                          <SelectValue
                            placeholder={monthlyPagination.pageSize}
                          />
                        </SelectTrigger>
                        <SelectContent side="top">
                          {[6, 12].map((size) => (
                            <SelectItem key={size} value={String(size)}>
                              {size}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex w-fit items-center justify-center text-sm font-medium">
                      Page {monthlyPagination.pageIndex + 1} of{" "}
                      {monthlyPageCount}
                    </div>
                    <div className="ml-auto flex items-center gap-2 lg:ml-0">
                      <Button
                        variant="outline"
                        size="icon"
                        className="hidden h-8 w-8 lg:flex"
                        onClick={() =>
                          setMonthlyPagination((p) => ({ ...p, pageIndex: 0 }))
                        }
                        disabled={monthlyPagination.pageIndex <= 0}
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          setMonthlyPagination((p) => ({
                            ...p,
                            pageIndex: Math.max(0, p.pageIndex - 1),
                          }))
                        }
                        disabled={monthlyPagination.pageIndex <= 0}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          setMonthlyPagination((p) => ({
                            ...p,
                            pageIndex: Math.min(
                              monthlyPageCount - 1,
                              p.pageIndex + 1,
                            ),
                          }))
                        }
                        disabled={
                          monthlyPagination.pageIndex >= monthlyPageCount - 1
                        }
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="hidden h-8 w-8 lg:flex"
                        onClick={() =>
                          setMonthlyPagination((p) => ({
                            ...p,
                            pageIndex: monthlyPageCount - 1,
                          }))
                        }
                        disabled={
                          monthlyPagination.pageIndex >= monthlyPageCount - 1
                        }
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded border bg-card overflow-hidden">
                <div className="border-b px-4 py-2 text-sm font-semibold">
                  Site Wage Costs by Fortnight (All Sites)
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/60">
                      <TableRow>
                        <TableHead className="border-r border-zinc-200 dark:border-zinc-700">
                          Fortnight
                        </TableHead>
                        <TableHead className="border-r border-zinc-200 dark:border-zinc-700">
                          Site
                        </TableHead>
                        <TableHead className="text-right border-r border-zinc-200 dark:border-zinc-700">
                          Wages
                        </TableHead>
                        <TableHead className="text-center">Rank</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedSiteAnalyticsRows.length ? (
                        pagedSiteAnalyticsRows.map((item) => (
                          <TableRow
                            key={`${item.periodId}-${item.rank}-${item.siteName}`}
                            className={
                              item.isTop
                                ? "bg-emerald-600/10 dark:bg-emerald-600/16"
                                : undefined
                            }
                          >
                            <TableCell className="border-r border-zinc-200 dark:border-zinc-700">
                              {item.periodLabel}
                            </TableCell>
                            <TableCell className="border-r border-zinc-200 dark:border-zinc-700">
                              {item.siteCode
                                ? `${item.siteCode} — ${item.siteName}`
                                : item.siteName}
                            </TableCell>
                            <TableCell className="text-right font-medium border-r border-zinc-200 dark:border-zinc-700">
                              {money(item.wages)}
                            </TableCell>
                            <TableCell className="text-center">
                              {item.isTop ? (
                                <Badge variant="secondary">Highest</Badge>
                              ) : (
                                item.rank
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center h-20">
                            No fortnight wage data for this selection.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <div className="text-muted-foreground hidden text-sm lg:flex">
                    Showing{" "}
                    {analyticsSitesByFortnight.length
                      ? siteAnalyticsPagination.pageIndex *
                          siteAnalyticsPagination.pageSize +
                        1
                      : 0}{" "}
                    to{" "}
                    {Math.min(
                      (siteAnalyticsPagination.pageIndex + 1) *
                        siteAnalyticsPagination.pageSize,
                      analyticsSitesByFortnight.length,
                    )}{" "}
                    of {analyticsSitesByFortnight.length} site rows
                  </div>
                  <div className="flex w-full items-center gap-4 lg:w-fit lg:gap-8">
                    <div className="hidden items-center gap-2 lg:flex">
                      <span className="text-sm font-medium">Rows per page</span>
                      <Select
                        value={String(siteAnalyticsPagination.pageSize)}
                        onValueChange={(value) =>
                          setSiteAnalyticsPagination({
                            pageIndex: 0,
                            pageSize: Number(value),
                          })
                        }
                      >
                        <SelectTrigger className="h-8 w-20">
                          <SelectValue
                            placeholder={siteAnalyticsPagination.pageSize}
                          />
                        </SelectTrigger>
                        <SelectContent side="top">
                          {[10, 25, 50].map((size) => (
                            <SelectItem key={size} value={String(size)}>
                              {size}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex w-fit items-center justify-center text-sm font-medium">
                      Page {siteAnalyticsPagination.pageIndex + 1} of{" "}
                      {siteAnalyticsPageCount}
                    </div>
                    <div className="ml-auto flex items-center gap-2 lg:ml-0">
                      <Button
                        variant="outline"
                        size="icon"
                        className="hidden h-8 w-8 lg:flex"
                        onClick={() =>
                          setSiteAnalyticsPagination((p) => ({
                            ...p,
                            pageIndex: 0,
                          }))
                        }
                        disabled={siteAnalyticsPagination.pageIndex <= 0}
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          setSiteAnalyticsPagination((p) => ({
                            ...p,
                            pageIndex: Math.max(0, p.pageIndex - 1),
                          }))
                        }
                        disabled={siteAnalyticsPagination.pageIndex <= 0}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          setSiteAnalyticsPagination((p) => ({
                            ...p,
                            pageIndex: Math.min(
                              siteAnalyticsPageCount - 1,
                              p.pageIndex + 1,
                            ),
                          }))
                        }
                        disabled={
                          siteAnalyticsPagination.pageIndex >=
                          siteAnalyticsPageCount - 1
                        }
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="hidden h-8 w-8 lg:flex"
                        onClick={() =>
                          setSiteAnalyticsPagination((p) => ({
                            ...p,
                            pageIndex: siteAnalyticsPageCount - 1,
                          }))
                        }
                        disabled={
                          siteAnalyticsPagination.pageIndex >=
                          siteAnalyticsPageCount - 1
                        }
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-muted-foreground">
              Wage cost analytics is available for admin role.
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
