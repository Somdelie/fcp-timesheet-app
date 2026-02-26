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

import TimesheetDetailSheet, {
  type TimesheetAction,
} from "@/components/timesheets/TimesheetDetailSheet";
import TimesheetGrid from "@/components/timesheets/TimesheetGrid";
import { normalizeTimesheetToGrid } from "@/lib/timesheets/normalizeTimesheetDetail";
import { Spinner } from "@/components/ui/spinner";
import {
  generateForemanSummaryPdf,
  downloadTimesheetPdf,
  printForemanSummary,
  type ForemanSummaryData,
  type ForemanTimesheetData,
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
  foreman?: { id: string; name: string };
  supervisor?: { id: string; name: string } | null;
  totalWorkerDays?: number | null;
  totalWorkerWages?: number | null;
  foremanDays?: number | null;
  foremanWages?: number | null;
  teamDays?: number | null;
  teamWages?: number | null;
  sites?: Array<{ id: string; code?: string | null; name: string }>;
  rowKey?: string;
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

function ensureUniqueRowKeys<T extends { id: string; rowKey?: string }>(
  rows: T[],
): T[] {
  // If API ever returns duplicate `id`s, React/TanStack need a unique per-row key.
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

  // Table sorting and pagination state
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

  // Foreman totals section collapsed/expanded
  const [foremanTotalsExpanded, setForemanTotalsExpanded] = useState(false);

  // Foreman PDF generation state
  const [foremanPdfGenerating, setForemanPdfGenerating] = useState<
    string | null
  >(null);

  const totalWages = useMemo(() => {
    const list = mode === "ADMIN" ? rowsAdmin : rowsSup;
    return list.reduce(
      (sum, row) => sum + Number(row.totalWorkerWages ?? 0),
      0,
    );
  }, [mode, rowsAdmin, rowsSup]);

  // Foreman totals: group all sites by foreman and sum wages for quick overview (ADMIN only)
  const foremanTotals = useMemo(() => {
    if (mode !== "ADMIN") return [];
    const map = new Map<
      string,
      {
        foremanId: string;
        foremanName: string;
        sitesCount: number;
        siteIds: string[];
        foremanDays: number;
        foremanWages: number;
        teamDays: number;
        teamWages: number;
        grandTotal: number;
      }
    >();
    for (const row of rowsAdmin) {
      const id = row.foreman?.id ?? "unknown";
      const name = row.foreman?.name ?? "Unknown";
      const existing = map.get(id) ?? {
        foremanId: id,
        foremanName: name,
        sitesCount: 0,
        siteIds: [],
        foremanDays: 0,
        foremanWages: 0,
        teamDays: 0,
        teamWages: 0,
        grandTotal: 0,
      };
      // Collect site IDs
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
      existing.grandTotal += Number(row.totalWorkerWages ?? 0);
      map.set(id, existing);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.foremanName.localeCompare(b.foremanName),
    );
  }, [mode, rowsAdmin]);

  // Handler for generating foreman summary PDF/Print
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
        // Fetch timesheet details for each site
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

          // Find site info from rowsAdmin
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

          // Add to site breakdown
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

        // Parse period dates
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
          // Print
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

  // Column definitions for Admin table
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

  // Column definitions for Supervisor table
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

  // Admin table instance
  const adminTable = useReactTable({
    data: rowsAdmin,
    columns: adminColumns,
    state: {
      sorting,
      pagination,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row, index) => row.rowKey ?? `${row.id}__${index}`,
  });

  // Supervisor table instance
  const supTable = useReactTable({
    data: rowsSup,
    columns: supColumns,
    state: {
      sorting,
      pagination,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row, index) => row.rowKey ?? `${row.id}__${index}`,
  });

  const table = mode === "ADMIN" ? adminTable : supTable;

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
        setRowsAdmin(ensureUniqueRowKeys(list as AdminRow[]));
        if (supervisorId !== "ALL") {
          const valid = (list as AdminRow[]).some(
            (r) => r.supervisor?.id === supervisorId,
          );
          if (!valid) setSupervisorId("ALL");
        }
      } else {
        // supervisor list: server filters by period => no client-side filtering needed
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
    // Only supervisors can accept/approve timesheets - admins can only view
    if (mode === "ADMIN") {
      return [];
    }

    const base = "/api/app/supervisor";

    // Get the fortnight dates from the detail or activeId
    let endISO: string | null = null;
    let startISO: string | null = null;
    if (detail) {
      endISO = detail?.endISO ?? null;
      startISO = detail?.startISO ?? null;
    } else if (activeId) {
      // Parse from activeId: YYYY-MM-DD_YYYY-MM-DD_FOREMANID_SITEID
      const parts = activeId.split("_");
      if (parts.length >= 2) {
        startISO = parts[0];
        endISO = parts[1];
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    const isLastDayOrLater = endISO ? today >= endISO : false;
    const isWithinPeriod =
      startISO && endISO ? today >= startISO && today <= endISO : false;

    const result: TimesheetAction[] = [];

    // Accept Day - only during the ongoing fortnight period (before last day)
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

    // Final Approve - only on or after the last day of the fortnight
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

    // Mark Paid - always available for approved timesheets
    result.push({
      id: "paid",
      label: "Mark Paid",
      variant: "outline",
      canPerform: (s) => s === "APPROVED",
      handler: async () => {
        if (!activeId) return;
        await postJson(
          `${base}/timesheets/${encodeURIComponent(activeId)}/paid`,
        );
        setTimeout(() => refreshDetail(), 300);
      },
    });

    return result;
  }, [mode, activeId, detail, loadList, refreshDetail]);

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

      {/* Foreman Totals Summary - quick view of what to pay each foreman */}
      {mode === "ADMIN" && foremanTotals.length > 0 && !loading && (
        <div className="rounded border bg-card overflow-hidden">
          <button
            type="button"
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
            onClick={() => setForemanTotalsExpanded(!foremanTotalsExpanded)}
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Foreman Totals</span>
              <Badge variant="secondary" className="text-xs">
                {foremanTotals.length} foremen
              </Badge>
              <span className="text-sm text-muted-foreground">•</span>
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                Grand Total:{" "}
                {money(foremanTotals.reduce((s, f) => s + f.grandTotal, 0))}
              </span>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${
                foremanTotalsExpanded ? "rotate-180" : ""
              }`}
            />
          </button>
          <div
            className="grid transition-all duration-300 ease-in-out"
            style={{
              gridTemplateRows: foremanTotalsExpanded ? "1fr" : "0fr",
            }}
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
                        Grand Total
                      </TableHead>
                      <TableHead className="px-3 py-2 text-xs font-semibold text-center border border-zinc-200 dark:border-zinc-700">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {foremanTotals.map((ft) => (
                      <TableRow
                        key={ft.foremanId}
                        className="hover:bg-muted/30"
                      >
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

        {/* Pagination Controls */}
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
    </div>
  );
}
