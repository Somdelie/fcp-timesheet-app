"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { Printer, FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { getFortnightForDateUTC } from "@/lib/timesheetPeriods";
import { exportDomToPdf } from "@/lib/exportDomToPdf";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

type SupervisorOption = { id: string; name: string | null; email: string };
type PeriodOption = {
  id: string; // YYYY-MM-DD_YYYY-MM-DD__ or YYYY-MM-DD__YYYY-MM-DD depending on caller
  startISO: string;
  endISO: string;
  label?: string | null;
};

type ListRow = {
  id: string;
  foreman: { id: string; name: string };
  supervisor?: { id: string; name: string } | null;
  sites: Array<{ id: string; code: string | null; name: string }>;
  foremanDays: number;
  teamDays: number;
  totalWorkerDays: number;
};

type DetailColumn = { iso: string; day: string; date: string };
type DetailRow = {
  employeeId: string;
  fullName: string;
  present: boolean[];
  daysWorked: number;
  isForeman?: boolean;
};

type ForemanSiteRow = {
  foremanName: string;
  jobNo: string;
  siteName: string;
  dailyCounts: number[];
  foremanPresence: boolean[];
  foremanDays: number;
  manDays: number;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
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

function foremanInitial(name: string): string {
  return name.trim().split(/\s+/)[0]?.slice(0, 1).toUpperCase() ?? "?";
}

function periodHeaderLabel(p: PeriodOption): string {
  const start = new Date(p.startISO + "T00:00:00Z");
  const end = new Date(p.endISO + "T00:00:00Z");
  const startMonth = start.toLocaleDateString("en-ZA", {
    month: "long",
    timeZone: "UTC",
  });
  const endMonth = end.toLocaleDateString("en-ZA", {
    month: "long",
    timeZone: "UTC",
  });
  const year = end.toLocaleDateString("en-ZA", {
    year: "numeric",
    timeZone: "UTC",
  });
  if (startMonth === endMonth) return `${startMonth} ${year}`;
  return `${startMonth} & ${endMonth} ${year}`;
}

function periodSelectLabel(p: PeriodOption): string {
  const a = new Date(`${p.startISO}T00:00:00.000Z`);
  const b = new Date(`${p.endISO}T00:00:00.000Z`);
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return `${fmt(a)} – ${fmt(b)} (Sat–Fri)`;
}

function parsePeriodId(
  periodId: string,
): { startISO: string; endISO: string } | null {
  // Expected from mobile: "YYYY-MM-DD__YYYY-MM-DD"
  const parts = String(periodId ?? "").split(/_+/); // tolerate multiple underscores
  if (parts.length < 2) return null;
  const startISO = parts[0];
  const endISO = parts[1];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startISO)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endISO)) return null;
  return { startISO, endISO };
}

function normalizePeriodIdForSupervisorList(periodId: string): string {
  // supervisor/timesheets expects query param `period` formatted as:
  // "YYYY-MM-DD_YYYY-MM-DD" (single underscore)
  const parsed = parsePeriodId(periodId);
  if (!parsed) return periodId;
  return `${parsed.startISO}_${parsed.endISO}`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

export default function TimesheetQuickViewClient() {
  const searchParams = useSearchParams();
  const apiToken = searchParams.get("token");
  const queryPeriodId = searchParams.get("periodId");
  const supervisorMode = Boolean(apiToken);
  const autoPrint = searchParams.get("autoprint") === "1";
  const embeddedPreview = searchParams.get("embedded") === "1";
  const hasAutoPrintedRef = useRef(false);

  const authHeaders: Record<string, string> = useMemo(() => {
    return apiToken
      ? { Authorization: `Bearer ${apiToken}` }
      : ({} as Record<string, string>);
  }, [apiToken]);

  const [supervisors, setSupervisors] = useState<SupervisorOption[]>([]);
  const [periods, setPeriods] = useState<PeriodOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);

  const [selectedSupervisorId, setSelectedSupervisorId] = useState("");
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption | null>(
    null,
  );
  const [supervisorName, setSupervisorName] = useState("");

  const [loading, setLoading] = useState(false);
  const [columns, setColumns] = useState<DetailColumn[]>([]);
  const [rows, setRows] = useState<ForemanSiteRow[]>([]);

  const periodFromQuery = useMemo(() => {
    if (!queryPeriodId) return null;
    const parsed = parsePeriodId(queryPeriodId);
    if (!parsed) return null;
    return {
      id: queryPeriodId,
      startISO: parsed.startISO,
      endISO: parsed.endISO,
      label: null,
    } satisfies PeriodOption;
  }, [queryPeriodId]);

  /* Load supervisors + periods once (ADMIN mode only) */
  useEffect(() => {
    if (supervisorMode) {
      // In supervisor mode we rely on periodId from query
      setOptionsLoading(false);
      if (periodFromQuery?.id) {
        setSelectedPeriodId(periodFromQuery.id);
        setSelectedPeriod(periodFromQuery);
      }
      return;
    }

    Promise.all([
      fetch("/api/app/admin/supervisors", { credentials: "include" })
        .then((r) => r.json())
        .then((d) => {
          const list: SupervisorOption[] = d.supervisors ?? [];
          setSupervisors(
            list.sort((a, b) =>
              (a.name ?? a.email).localeCompare(b.name ?? b.email),
            ),
          );
        }),
      fetch("/api/app/timesheets/periods", {
        credentials: "include",
      })
        .then((r) => r.json())
        .then(async (d) => {
          const list: PeriodOption[] = d.periods ?? [];
          list.sort((a, b) => b.startISO.localeCompare(a.startISO));
          setPeriods(list);
          if (list.length > 0) {
            let defaultId = list[0]?.id ?? "";
            const year = new Date().getUTCFullYear();
            const anchorISO = await getYearAnchorISO(year);
            if (anchorISO) {
              try {
                const anchor = utcDateFromISO(anchorISO);
                const current = getFortnightForDateUTC(new Date(), anchor);
                defaultId = current.id;
              } catch {
                // ignore
              }
            }
            const selected = list.find((p) => p.id === defaultId) ?? list[0];
            setSelectedPeriodId(selected.id);
            setSelectedPeriod(selected);
          }
        }),
    ])
      .catch(() => toast.error("Failed to load options"))
      .finally(() => setOptionsLoading(false));
  }, [supervisorMode, periodFromQuery]);

  useEffect(() => {
    if (supervisorMode) return;
    setSelectedPeriod(periods.find((p) => p.id === selectedPeriodId) ?? null);
  }, [selectedPeriodId, periods, supervisorMode]);

  /* Load all foremen under the selected supervisor for the period (ADMIN) */
  const load = useCallback(async () => {
    if (!selectedPeriodId) {
      setRows([]);
      setColumns([]);
      return;
    }

    setLoading(true);
    setRows([]);
    setColumns([]);

    try {
      if (supervisorMode) {
        const supervisorPeriodQuery =
          normalizePeriodIdForSupervisorList(selectedPeriodId);

        const listRes = await fetch(
          `/api/app/supervisor/timesheets?period=${encodeURIComponent(
            supervisorPeriodQuery,
          )}`,
          { headers: { ...authHeaders }, credentials: "include" },
        );

        const listData = await listRes.json();
        if (!listRes.ok) {
          throw new Error(listData.error ?? "Failed to load timesheets");
        }

        const supervisorRows: Array<{
          id: string;
          foremanName: string;
          siteId: string | null;
          siteCode: string | null;
          siteName: string | null;
          totalWorkerDays: number;
          totalWorkerWages: number;
          status: string;
        }> = listData.timesheets ?? [];

        if (supervisorRows.length === 0) {
          toast.info("No timesheets found for this period");
          setLoading(false);
          return;
        }

        setSupervisorName("Supervisor");

        /* Fetch per-(foreman, site) details in parallel */
        const details = await Promise.all(
          supervisorRows.map(async (row) => {
            const siteId = row.siteId;
            const qs = siteId ? `?siteId=${encodeURIComponent(siteId)}` : "";
            const res = await fetch(
              `/api/app/supervisor/timesheets/${row.id}${qs}`,
              { headers: { ...authHeaders }, credentials: "include" },
            );

            const data = await res.json();
            if (!res.ok) return null;

            const ts = data.timesheet ?? data;
            return {
              listRow: row,
              columns: (ts.columns ?? []) as DetailColumn[],
              workerRows: (ts.rows ?? []) as DetailRow[],
              // In supervisor mode we don't get isForeman flags; we'll render all employees as "team".
            };
          }),
        );

        const valid = details.filter(Boolean) as NonNullable<
          (typeof details)[0]
        >[];

        if (valid.length === 0) {
          toast.error("Could not load timesheet details");
          setLoading(false);
          return;
        }

        const cols = valid[0].columns;
        setColumns(cols);

        const displayRows: ForemanSiteRow[] = valid.map((d) => {
          const dailyCounts = cols.map(
            (_, dayIdx) => d.workerRows.filter((r) => r.present[dayIdx]).length,
          );

          const manDays = d.workerRows.reduce(
            (s, r) => s + (r.daysWorked ?? 0),
            0,
          );

          return {
            foremanName: d.listRow.foremanName,
            jobNo: d.listRow.siteCode ?? "",
            siteName: d.listRow.siteName ?? "",
            dailyCounts,
            foremanPresence: Array(cols.length).fill(false),
            foremanDays: 0,
            manDays,
          };
        });

        displayRows.sort((a, b) => {
          const n = a.foremanName.localeCompare(b.foremanName);
          return n !== 0 ? n : a.siteName.localeCompare(b.siteName);
        });

        setRows(displayRows);
        return;
      }

      /* -------------------------- ADMIN MODE -------------------------- */

      if (!selectedSupervisorId) return;

      const listRes = await fetch(
        `/api/app/admin/timesheets?period=${encodeURIComponent(selectedPeriodId)}`,
        { credentials: "include" },
      );
      const listData = await listRes.json();
      if (!listRes.ok)
        throw new Error(listData.error ?? "Failed to load timesheets");

      const allRows: ListRow[] = listData.timesheets ?? [];

      const sup = supervisors.find((s) => s.id === selectedSupervisorId);
      setSupervisorName(sup?.name ?? sup?.email ?? "");

      const supervisorRows = allRows.filter(
        (r) => r.supervisor?.id === selectedSupervisorId,
      );

      if (supervisorRows.length === 0) {
        toast.info("No timesheets found for this supervisor in this period");
        setLoading(false);
        return;
      }

      /* Fetch per-timesheet detail in parallel */
      const details = await Promise.all(
        supervisorRows.map(async (row) => {
          const res = await fetch(`/api/app/admin/timesheets/${row.id}`, {
            credentials: "include",
          });
          const data = await res.json();
          if (!res.ok) return null;
          const ts = data.timesheet ?? data;
          return {
            listRow: row,
            columns: (ts.columns ?? []) as DetailColumn[],
            workerRows: (ts.rows ?? []) as DetailRow[],
            foremanEmployeeId: (ts.foreman?.employeeId ?? null) as
              | string
              | null,
          };
        }),
      );

      const valid = details.filter(Boolean) as NonNullable<
        (typeof details)[0]
      >[];

      if (valid.length === 0) {
        toast.error("Could not load timesheet details");
        setLoading(false);
        return;
      }

      const cols = valid[0].columns;
      setColumns(cols);

      const displayRows: ForemanSiteRow[] = [];

      for (const d of valid) {
        const { listRow, workerRows, foremanEmployeeId } = d;
        const site = listRow.sites[0] ?? { code: null, name: "Unknown" };

        const foremanRow = workerRows.find(
          (r) =>
            r.isForeman ??
            (foremanEmployeeId ? r.employeeId === foremanEmployeeId : false),
        );

        const teamRows = workerRows.filter(
          (r) =>
            !(
              r.isForeman ??
              (foremanEmployeeId ? r.employeeId === foremanEmployeeId : false)
            ),
        );

        const dailyCounts = cols.map(
          (_, dayIdx) => teamRows.filter((r) => r.present[dayIdx]).length,
        );

        const foremanPresence: boolean[] = foremanRow
          ? foremanRow.present
          : Array(cols.length).fill(false);

        displayRows.push({
          foremanName: listRow.foreman.name,
          jobNo: site.code ?? "",
          siteName: site.name,
          dailyCounts,
          foremanPresence,
          foremanDays: listRow.foremanDays ?? 0,
          manDays: teamRows.reduce((s, r) => s + (r.daysWorked ?? 0), 0),
        });
      }

      displayRows.sort((a, b) => {
        const n = a.foremanName.localeCompare(b.foremanName);
        return n !== 0 ? n : a.siteName.localeCompare(b.siteName);
      });

      setRows(displayRows);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load timesheet");
    } finally {
      setLoading(false);
    }
  }, [
    selectedPeriodId,
    supervisorMode,
    selectedSupervisorId,
    supervisors,
    authHeaders,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  const totalForemanDays = rows.reduce((s, r) => s + r.foremanDays, 0);
  const totalManDays = rows.reduce((s, r) => s + r.manDays, 0);
  const headerDate = selectedPeriod ? periodHeaderLabel(selectedPeriod) : "";
  const todayISO = new Date().toISOString().slice(0, 10);

  const handleSavePdf = useCallback(async () => {
    const printRoot = document.getElementById("ts-print-root");
    if (!printRoot) return;

    const startISO = selectedPeriod?.startISO ?? "";
    const endISO = selectedPeriod?.endISO ?? "";

    const filename =
      startISO && endISO
        ? `timesheet-${startISO}-${endISO}.pdf`
        : "timesheet.pdf";

    try {
      await exportDomToPdf(printRoot, {
        filename,
        marginMm: 8,
        scale: 2,
        landscape: true,
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to export PDF");
    }
  }, [selectedPeriod]);

  const handleExportExcel = useCallback(async () => {
    if (!rows.length || !columns.length) {
      toast.error("No timesheet data to export");
      return;
    }

    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      wb.creator = "FCP Timesheet App";
      wb.created = new Date();

      const ws = wb.addWorksheet("Time Sheet", {
        pageSetup: { orientation: "landscape", fitToPage: true },
      });

      const dayColCount = columns.length;
      const fdCol = 4 + dayColCount;
      const mdCol = 5 + dayColCount;
      const totalCols = mdCol;

      const THIN = { style: "thin" as const, color: { argb: "FFBBBBBB" } };
      const MED = { style: "medium" as const, color: { argb: "FF222222" } };
      const cellBorder = { top: THIN, bottom: THIN, left: THIN, right: THIN };
      const headerBorder = { top: MED, bottom: MED, left: MED, right: MED };

      const fontTitle = {
        name: "Arial",
        size: 14,
        bold: true,
        underline: true,
      };
      const fontMeta = { name: "Arial", size: 10, bold: true };
      const fontHeader = { name: "Arial", size: 10, bold: true };
      const fontName = { name: "Arial", size: 10 };
      const fontJobNo = {
        name: "Arial",
        size: 14,
        bold: true,
        color: { argb: "FF555555" },
      };
      const fontSite = { name: "Arial", size: 9 };
      const fontCount = { name: "Arial", size: 9, bold: true };
      const fontTotal = { name: "Arial", size: 16, bold: true };

      // Title row
      ws.mergeCells(1, 1, 1, totalCols);
      const titleCell = ws.getCell(1, 1);
      titleCell.value = "TIME SHEET";
      titleCell.font = fontTitle;
      titleCell.alignment = { horizontal: "center" };
      ws.getRow(1).height = 22;

      // Meta row: Date ... Contract Manager
      const metaMid = Math.ceil(totalCols / 2);
      ws.mergeCells(2, 1, 2, metaMid);
      const dateCell = ws.getCell(2, 1);
      dateCell.value = `Date: ${headerDate}`;
      dateCell.font = fontMeta;

      ws.mergeCells(2, metaMid + 1, 2, totalCols);
      const mgrCell = ws.getCell(2, metaMid + 1);
      mgrCell.value = `Contract Manager: ${supervisorName}`;
      mgrCell.font = fontMeta;
      mgrCell.alignment = { horizontal: "right" };
      ws.getRow(2).height = 18;

      // Header row
      const headerRowIdx = 4;
      const headerRow = ws.getRow(headerRowIdx);
      const headers = [
        "Name",
        "Job No",
        "Site",
        ...columns.map((c) => `${c.day}\n${c.date}`),
        "F/man\nDays",
        "Man\nDays",
      ];
      headers.forEach((h, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = h;
        cell.font = fontHeader;
        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };
        cell.border = headerBorder;
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF2F2F2" },
        };
      });
      headerRow.height = 28;

      // Data rows
      let rowIdx = headerRowIdx + 1;
      for (const row of rows) {
        const initial = foremanInitial(row.foremanName);
        const r = ws.getRow(rowIdx++);

        r.getCell(1).value = row.foremanName;
        r.getCell(1).font = fontName;
        r.getCell(1).alignment = { horizontal: "left", vertical: "middle" };

        r.getCell(2).value = row.jobNo;
        r.getCell(2).font = fontJobNo;
        r.getCell(2).alignment = { horizontal: "left", vertical: "middle" };

        r.getCell(3).value = row.siteName;
        r.getCell(3).font = fontSite;
        r.getCell(3).alignment = { horizontal: "left", vertical: "middle" };

        row.dailyCounts.forEach((count, dayIdx) => {
          const cell = r.getCell(4 + dayIdx);
          const isFuture = (columns[dayIdx]?.iso ?? "") > todayISO;
          const foremanIn = row.foremanPresence[dayIdx] ?? false;
          const hasActivity = count > 0 || foremanIn;

          if (isFuture) {
            cell.value = "";
          } else if (hasActivity) {
            cell.value = foremanIn ? `${initial}+${count}` : `${count}`;
            cell.font = fontCount;
          } else {
            cell.value = "-";
            cell.font = fontSite;
          }
          cell.alignment = { horizontal: "center", vertical: "middle" };
        });

        const fdCell = r.getCell(fdCol);
        fdCell.value = row.foremanDays || "";
        fdCell.font = fontTotal;
        fdCell.alignment = { horizontal: "center", vertical: "middle" };

        const mdCell = r.getCell(mdCol);
        mdCell.value = row.manDays;
        mdCell.font = fontTotal;
        mdCell.alignment = { horizontal: "center", vertical: "middle" };

        for (let c = 1; c <= totalCols; c++) {
          r.getCell(c).border = cellBorder;
        }
        r.height = 22;
      }

      // Totals row
      const totalsRow = ws.getRow(rowIdx);
      ws.mergeCells(rowIdx, 1, rowIdx, 3 + dayColCount);
      const totalsLabelCell = totalsRow.getCell(1);
      totalsLabelCell.value = "TOTALS";
      totalsLabelCell.font = fontMeta;
      totalsLabelCell.alignment = { horizontal: "right", vertical: "middle" };

      const totalFdCell = totalsRow.getCell(fdCol);
      totalFdCell.value = totalForemanDays;
      totalFdCell.font = fontTotal;
      totalFdCell.alignment = { horizontal: "center", vertical: "middle" };

      const totalMdCell = totalsRow.getCell(mdCol);
      totalMdCell.value = totalManDays;
      totalMdCell.font = fontTotal;
      totalMdCell.alignment = { horizontal: "center", vertical: "middle" };

      for (let c = 1; c <= totalCols; c++) {
        totalsRow.getCell(c).border = { ...cellBorder, top: MED, bottom: MED };
        totalsRow.getCell(c).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF0F0F0" },
        };
      }
      totalsRow.height = 24;

      // Column widths
      ws.getColumn(1).width = 22;
      ws.getColumn(2).width = 14;
      ws.getColumn(3).width = 26;
      for (let i = 0; i < dayColCount; i++) {
        ws.getColumn(4 + i).width = 7;
      }
      ws.getColumn(fdCol).width = 12;
      ws.getColumn(mdCol).width = 12;

      const startISO = selectedPeriod?.startISO ?? "";
      const endISO = selectedPeriod?.endISO ?? "";
      const filename =
        startISO && endISO
          ? `timesheet-${startISO}-${endISO}.xlsx`
          : "timesheet.xlsx";

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("Excel exported");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to export Excel");
    }
  }, [
    rows,
    columns,
    headerDate,
    supervisorName,
    totalForemanDays,
    totalManDays,
    todayISO,
    selectedPeriod,
  ]);

  const handlePrint = useCallback(() => {
    const printRoot = document.getElementById("ts-print-root");
    if (!printRoot) return;

    // Force light mode before printing (mobile browsers may ignore theme otherwise)
    if (supervisorMode) {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    }

    const shouldClosePopup = autoPrint;
    const doPrint = () => {
      // Give the browser a tick to apply styles/classes.
      setTimeout(() => window.print(), 0);
    };

    const win = window.open("", "_blank");
    if (!win) {
      doPrint();
      return;
    }

    // Best-effort: render a dedicated print document.
    win.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Time Sheet</title><style>
@page { size: A4 landscape; margin: 8mm 12mm; }
body { margin: 0; }
.ts-no-print { display: none !important; }
.ts-sheet-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; font-size: 12px; font-family: Arial, sans-serif; }
.ts-title { font-size: 15px; font-weight: bold; text-decoration: underline; letter-spacing: 1.5px; }
.ts-table { width: 100%; border-collapse: collapse; font-size: 10px; font-family: Arial, sans-serif; }
.ts-table th { border: 1.5px solid #222; padding: 6px 5px; background: #f2f2f2; font-weight: 700; text-align: center; white-space: nowrap; }
.ts-table td { border: 1px solid #bbb; padding: 6px 4px; text-align: center; vertical-align: middle; }
.ts-th-name { text-align: left !important; min-width: 100px; }
.ts-th-jobno { text-align: left !important; min-width: 60px; }
.ts-th-site { text-align: left !important; min-width: 140px; }
.ts-th-day { width: 42px; min-width: 42px; max-width: 42px; padding: 2px !important; }
.ts-th-total { min-width: 70px; }
.ts-td-name { text-align: left !important; min-width: 100px; white-space: nowrap; font-weight: 500; }
.ts-td-jobno { text-align: left !important; min-width: 90px; font-size: 18px; font-weight: 700; color: #555; }
.ts-td-site { text-align: left !important; min-width: 140px; font-size: 9px; white-space: nowrap; }
.ts-td-count { font-weight: 700; font-size: 9px; color: #111; }
.ts-td-absent { padding: 2px; }
.ts-td-total { font-weight: 700; font-size: 20px; }
.ts-tfoot-row td { background: #f0f0f0; font-weight: 700; border-top: 2px solid #333; }
.ts-tfoot-label { text-align: right !important; padding-right: 8px !important; letter-spacing: 0.5px; }
.ts-dayhead-short { font-size: 8px; line-height: 1.2; font-weight: 400; }
.ts-dayhead-num { font-size: 10px; font-weight: 700; line-height: 1.3; }
</style></head><body>${printRoot.outerHTML}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => {
      try {
        win.print();
      } catch {
        // ignore
      }
      try {
        window.print();
      } catch {
        // ignore
      }

      // On mobile, closing the popup immediately can prevent the print/save
      // dialog from appearing. Only close when we are auto-printing.
      if (shouldClosePopup) {
        try {
          win.close();
        } catch {
          // ignore
        }
      }
    }, 2000);
  }, [supervisorMode, autoPrint]);

  // If mobile opened this page with ?autoprint=1, auto-trigger the browser print
  // once data is ready.
  useEffect(() => {
    if (!autoPrint) return;
    if (!supervisorMode) return;
    if (hasAutoPrintedRef.current) return;
    if (loading) return;
    if (!rows.length) return;

    hasAutoPrintedRef.current = true;
    handleSavePdf();
  }, [autoPrint, supervisorMode, loading, rows.length, handleSavePdf]);

  return (
    <>
      {/* ── Print stylesheet injected once per mount ── */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          .ts-sheet-header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 10px;
            font-size: 12px;
            font-family: Arial, sans-serif;
          }
          .ts-title {
            font-size: 15px;
            font-weight: bold;
            text-decoration: underline;
            letter-spacing: 1.5px;
          }
          .ts-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
            font-family: Arial, sans-serif;
          }
          .ts-table th {
            border: 1.5px solid #222;
            padding: 6px 5px;
            background: #f2f2f2;
            font-weight: 700;
            text-align: center;
            white-space: nowrap;
          }
          .ts-table td {
            border: 1px solid #bbb;
            padding: 6px 4px;
            text-align: center;
            vertical-align: middle;
          }
          .ts-th-name  { text-align: left !important; min-width: 100px; }
          .ts-th-jobno { text-align: left !important; min-width: 60px; }
          .ts-th-site  { text-align: left !important; min-width: 140px; }
          .ts-th-day   {
            width: 42px;
            min-width: 42px;
            max-width: 42px;
            padding: 2px !important;
          }
          .ts-th-total { min-width: 70px; }
          .ts-td-name  { text-align: left !important; min-width: 100px; white-space: nowrap; font-weight: 500; }
          .ts-td-jobno { text-align: left !important; min-width: 90px; font-size: 18px; font-weight: 700; color: #555; }
          .ts-td-site  { text-align: left !important; min-width: 140px; font-size: 9px; white-space: nowrap; }
          .ts-td-count { font-weight: 700; font-size: 9px; color: #111; }
          .ts-td-absent { padding: 2px; }
          .ts-td-total { font-weight: 700; font-size: 20px; }
          .ts-tfoot-row td {
            background: #f0f0f0;
            font-weight: 700;
            border-top: 2px solid #333;
          }
          .ts-tfoot-label { text-align: right !important; padding-right: 8px !important; letter-spacing: 0.5px; }
          .ts-dayhead-short { font-size: 8px; line-height: 1.2; font-weight: 400; }
          .ts-dayhead-num   { font-size: 10px; font-weight: 700; line-height: 1.3; }
          .ts-embedded-preview {
            min-width: 1180px;
            width: max-content;
            padding: 16px;
            background: #ffffff;
            color: #000000;
          }
          .ts-embedded-preview .ts-table {
            min-width: 1120px;
          }
        `,
        }}
      />

      <div className={embeddedPreview ? "" : "space-y-6"}>
        {/* ── Controls ── */}
        <div
          className={`ts-no-print flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between ${
            embeddedPreview ? "hidden" : ""
          }`}
        >
          {!supervisorMode && (
            <div className="space-y-1.5 lg:flex-1">
              <Label>Supervisor</Label>
              <Select
                value={selectedSupervisorId}
                onValueChange={setSelectedSupervisorId}
                disabled={optionsLoading}
              >
                <SelectTrigger className="w-full lg:w-60">
                  <SelectValue
                    placeholder={
                      optionsLoading ? "Loading…" : "— select supervisor —"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {supervisors.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name || s.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5 lg:flex-1">
            {!supervisorMode ? (
              <>
                <Label>Fortnight Period</Label>
                <Select
                  value={selectedPeriodId}
                  onValueChange={setSelectedPeriodId}
                  disabled={optionsLoading}
                >
                  <SelectTrigger className="w-full lg:w-68">
                    <SelectValue placeholder="— select period —" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {periods.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {periodSelectLabel(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            ) : (
              <>
                <Label>Fortnight Period</Label>
                <div className="w-full lg:w-68">
                  <div className="text-sm text-muted-foreground">
                    {selectedPeriod
                      ? periodSelectLabel(selectedPeriod)
                      : "Loading…"}
                  </div>
                </div>
              </>
            )}
          </div>

          {rows.length > 0 && (
            <div className="flex gap-3 lg:self-end">
              <Button variant="outline" onClick={handlePrint} className="gap-2">
                <Printer className="h-4 w-4" />
                Print
              </Button>

              <Button
                variant="outline"
                onClick={handleSavePdf}
                className="gap-2"
              >
                <FileText className="h-4 w-4" />
                Save PDF
              </Button>

              <Button
                variant="outline"
                onClick={handleExportExcel}
                className="gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Export Excel
              </Button>
            </div>
          )}
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground py-16">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading timesheet data…</span>
          </div>
        )}

        {/* ── Empty prompt ── */}
        {!loading && !selectedPeriodId && (
          <div className="ts-no-print flex flex-col items-center gap-3 py-16 border rounded-lg bg-muted/20 text-muted-foreground">
            <FileText className="h-10 w-10 opacity-30" />
            <p className="text-sm">
              Select a period to generate the timesheet view.
            </p>
          </div>
        )}

        {/* ── Sheet ── */}
        {!loading && rows.length > 0 && (
          <div
            id="ts-print-root"
            className={embeddedPreview ? "ts-embedded-preview" : "overflow-x-auto"}
          >
            {/* Header row — matches the handwritten sheet layout */}
            <div className="ts-sheet-header">
              <div>
                <span style={{ fontSize: 11 }}>Date:&nbsp;</span>
                <span style={{ fontWeight: 600 }}>{headerDate}</span>
              </div>
              <div className="ts-title">TIME SHEET</div>
              <div>
                <span style={{ fontSize: 11 }}>Contract Manager:&nbsp;</span>
                <span style={{ fontWeight: 600 }}>{supervisorName}</span>
              </div>
            </div>

            <table className="ts-table">
              <thead>
                <tr>
                  <th className="ts-th-name" style={{ textAlign: "left" }}>
                    Name
                  </th>
                  <th className="ts-th-jobno" style={{ textAlign: "left" }}>
                    Job No
                  </th>
                  <th className="ts-th-site" style={{ textAlign: "left" }}>
                    Site
                  </th>
                  {columns.map((col) => (
                    <th key={col.iso} className="ts-th-day">
                      <div className="ts-dayhead-short">{col.day}</div>
                      <div className="ts-dayhead-num">{col.date}</div>
                    </th>
                  ))}
                  <th className="ts-th-total">
                    F/man
                    <br />
                    Days
                  </th>
                  <th className="ts-th-total">
                    Man
                    <br />
                    Days
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const initial = foremanInitial(row.foremanName);
                  return (
                    <tr key={idx}>
                      <td className="ts-td-name" style={{ textAlign: "left" }}>
                        {row.foremanName}
                      </td>
                      <td className="ts-td-jobno" style={{ textAlign: "left" }}>
                        {row.jobNo}
                      </td>
                      <td className="ts-td-site" style={{ textAlign: "left" }}>
                        {row.siteName}
                      </td>
                      {row.dailyCounts.map((count, dayIdx) => {
                        const isFuture =
                          (columns[dayIdx]?.iso ?? "") > todayISO;
                        const foremanIn = row.foremanPresence[dayIdx] ?? false;
                        const hasActivity = count > 0 || foremanIn;
                        return (
                          <td
                            key={dayIdx}
                            className={
                              hasActivity ? "ts-td-count" : "ts-td-absent"
                            }
                          >
                            {isFuture ? null : hasActivity ? (
                              // In supervisor mode we always have foremanPresence=false,
                              // so this will just render `${count}`.
                              foremanIn ? (
                                `${initial}+${count}`
                              ) : (
                                `${count}`
                              )
                            ) : (
                              <svg
                                width="18"
                                height="12"
                                viewBox="0 0 18 12"
                                style={{ display: "block", margin: "auto" }}
                              >
                                <line
                                  x1="16.5"
                                  y1="1"
                                  x2="1.5"
                                  y2="11"
                                  stroke="#000"
                                  strokeWidth="1.2"
                                  strokeLinecap="round"
                                />
                              </svg>
                            )}
                          </td>
                        );
                      })}
                      <td className="ts-td-total">{row.foremanDays || ""}</td>
                      <td className="ts-td-total">{row.manDays}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="ts-tfoot-row">
                  <td
                    colSpan={3 + columns.length}
                    className="ts-tfoot-label"
                    style={{ textAlign: "right" }}
                  >
                    TOTALS
                  </td>
                  <td className="ts-td-total">{totalForemanDays}</td>
                  <td className="ts-td-total">{totalManDays}</td>
                </tr>
              </tfoot>
            </table>

            {/* Summary below table */}
            <div
              className="ts-no-print"
              style={{
                display: "flex",
                gap: 24,
                marginTop: 12,
                fontSize: 13,
                color: "#555",
              }}
            >
              <span>
                Foremen: <strong>{rows.length}</strong>
              </span>
              <span>
                Foreman Days: <strong>{totalForemanDays}</strong>
              </span>
              <span>
                Total Man Days: <strong>{totalManDays}</strong>
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
