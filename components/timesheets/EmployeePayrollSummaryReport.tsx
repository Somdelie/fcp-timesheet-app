"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Download,
  Loader2,
  Printer,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "react-toastify";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { addDays, currentFortnightSatFri, toISODate } from "@/lib/fortnight";
import { cn } from "@/lib/utils";

type EmployeeOption = {
  id: string;
  name: string;
  code: string;
};

type PayrollRow = {
  date: string;
  siteName: string;
  foremanName: string;
  regularDays: number;
  regularRate: number;
  regularWage: number;
  overtimeType: "NONE" | "HALF_DAY" | "FULL_DAY";
  overtimeDays: number;
  overtimeRate: number;
  overtimeWage: number;
  totalWage: number;
};

type PayrollSummary = {
  regularDays: number;
  regularWage: number;
  overtimeDays: number;
  overtimeWage: number;
  totalWage: number;
  regularRate: number;
  overtimeRate: number;
};

type PayrollResponse = {
  period: {
    startISO: string;
    endISO: string;
    label: string;
  };
  employees: EmployeeOption[];
  selectedEmployee: (EmployeeOption & { defaultDayRate: number }) | null;
  rows: PayrollRow[];
  summary: PayrollSummary | null;
};

type EditableCell = {
  rowIndex: number;
  field: keyof Pick<
    PayrollRow,
    | "siteName"
    | "regularDays"
    | "regularRate"
    | "regularWage"
    | "overtimeType"
    | "overtimeDays"
    | "overtimeWage"
    | "totalWage"
  >;
} | null;

type EditableHeaderCell =
  | "employeeName"
  | "summaryDate"
  | "regularRate"
  | "overtimeHourlyRate"
  | null;

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatShortDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number) {
  return value.toLocaleString("en-ZA", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  });
}

function safeFilePart(value: string) {
  return value.replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "");
}

function shiftISODate(iso: string, days: number) {
  return toISODate(addDays(new Date(`${iso}T00:00:00`), days));
}

function editTooltip(children: ReactNode) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top">Double-click to edit</TooltipContent>
    </Tooltip>
  );
}

function overtimeLabel(value: PayrollRow["overtimeType"]) {
  if (value === "HALF_DAY") return "Half";
  if (value === "FULL_DAY") return "Full";
  return "0";
}

function calculateSummary(rows: PayrollRow[]): PayrollSummary {
  const summary = rows.reduce(
    (acc, row) => {
      acc.regularDays += row.regularDays;
      acc.regularWage += row.regularWage;
      acc.overtimeDays += row.overtimeDays;
      acc.overtimeWage += row.overtimeWage;
      acc.totalWage += row.totalWage;
      return acc;
    },
    {
      regularDays: 0,
      regularWage: 0,
      overtimeDays: 0,
      overtimeWage: 0,
      totalWage: 0,
      regularRate: 0,
      overtimeRate: 0,
    },
  );

  summary.regularRate =
    summary.regularDays > 0 ? summary.regularWage / summary.regularDays : 0;
  summary.overtimeRate =
    summary.overtimeDays > 0
      ? summary.overtimeWage / summary.overtimeDays
      : summary.regularRate;

  return summary;
}

export default function AdminAttendancePayrollSummaryPage() {
  const current = currentFortnightSatFri();
  const [startISO, setStartISO] = useState(current.startISO);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [employeeOpen, setEmployeeOpen] = useState(false);
  const [data, setData] = useState<PayrollResponse | null>(null);
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [reportMode, setReportMode] = useState<"date" | "month">("date");
  const [editingCell, setEditingCell] = useState<EditableCell>(null);
  const [editingHeaderCell, setEditingHeaderCell] =
    useState<EditableHeaderCell>(null);
  const [headerEdits, setHeaderEdits] = useState({
    employeeName: "",
    summaryDate: "",
  });
  const [radixControlsMounted, setRadixControlsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const selectedEmployeeLabel = data?.selectedEmployee
    ? `${data.selectedEmployee.name} (${data.selectedEmployee.code})`
    : "Search employee...";

  const loadReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ start: startISO });
      if (employeeSearch.trim()) params.set("q", employeeSearch.trim());
      if (employeeId) params.set("employeeId", employeeId);

      const res = await fetch(`/api/admin/employee-payroll-summary?${params}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to load payroll summary");
      }

      setData(await res.json());
    } catch (error: any) {
      toast.error(error?.message || "Failed to load payroll summary");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(loadReport, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startISO, employeeSearch, employeeId]);

  useEffect(() => {
    setRadixControlsMounted(true);
  }, []);

  useEffect(() => {
    setRows(data?.rows ?? []);
    setEditingCell(null);
    setEditingHeaderCell(null);
  }, [data?.selectedEmployee?.id, data?.period.startISO, data?.rows]);

  useEffect(() => {
    setHeaderEdits({
      employeeName: data?.selectedEmployee?.name ?? "",
      summaryDate: data
        ? `${formatDate(data.period.startISO)} - ${formatDate(data.period.endISO)}`
        : "",
    });
  }, [data?.selectedEmployee?.id, data?.period.startISO, data?.period.endISO]);

  const activeRows = useMemo(
    () => rows.filter((row) => row.regularDays > 0),
    [rows],
  );
  const editedSummary = useMemo(() => calculateSummary(rows), [rows]);
  const monthSummaryRows = useMemo(() => {
    const grouped = new Map<string, PayrollRow>();
    const sitesByMonth = new Map<string, Set<string>>();

    for (const row of rows) {
      const monthKey = row.date.slice(0, 7);
      if (row.siteName.trim()) {
        const sites = sitesByMonth.get(monthKey) ?? new Set<string>();
        sites.add(row.siteName.trim());
        sitesByMonth.set(monthKey, sites);
      }

      const existing = grouped.get(monthKey);

      if (!existing) {
        grouped.set(monthKey, {
          ...row,
          date: `${monthKey}-01`,
          siteName: "0",
          foremanName: "",
          overtimeType: "NONE",
        });
        continue;
      }

      existing.regularDays += row.regularDays;
      existing.regularWage += row.regularWage;
      existing.overtimeDays += row.overtimeDays;
      existing.overtimeWage += row.overtimeWage;
      existing.totalWage += row.totalWage;
      existing.regularRate =
        existing.regularDays > 0
          ? existing.regularWage / existing.regularDays
          : 0;
      existing.overtimeRate =
        existing.overtimeDays > 0
          ? existing.overtimeWage / existing.overtimeDays
          : existing.regularRate;
    }

    return Array.from(grouped.entries()).map(([monthKey, row]) => ({
      ...row,
      siteName: String(sitesByMonth.get(monthKey)?.size ?? 0),
    }));
  }, [rows]);
  const reportRows = reportMode === "date" ? rows : monthSummaryRows;
  const displayEmployeeName =
    headerEdits.employeeName || data?.selectedEmployee?.name || "";
  const displaySummaryDate =
    headerEdits.summaryDate ||
    (data
      ? `${formatDate(data.period.startISO)} - ${formatDate(data.period.endISO)}`
      : "");
  const overtimeHourlyRate = editedSummary.overtimeRate / 8;

  function updateRow(rowIndex: number, patch: Partial<PayrollRow>) {
    setRows((current) =>
      current.map((row, index) => {
        if (index !== rowIndex) return row;
        const next = { ...row, ...patch };
        const regularWage =
          "regularWage" in patch
            ? Number(patch.regularWage ?? 0)
            : next.regularDays * next.regularRate;
        const overtimeWage =
          "overtimeWage" in patch
            ? Number(patch.overtimeWage ?? 0)
            : next.overtimeDays * next.overtimeRate;
        return {
          ...next,
          regularWage,
          overtimeWage,
          totalWage:
            "totalWage" in patch
              ? Number(patch.totalWage ?? 0)
              : regularWage + overtimeWage,
        };
      }),
    );
  }

  function commitNumber(
    rowIndex: number,
    field: Exclude<EditableCell, null>["field"],
    value: string,
  ) {
    const numericValue = Number(value);
    updateRow(rowIndex, {
      [field]: Number.isFinite(numericValue) ? numericValue : 0,
    } as Partial<PayrollRow>);
    setEditingCell(null);
  }

  function applyRegularRate(value: string) {
    const rate = Number(value);
    const regularRate = Number.isFinite(rate) ? rate : 0;

    setRows((current) =>
      current.map((row) => {
        const regularWage = row.regularDays * regularRate;
        return {
          ...row,
          regularRate,
          regularWage,
          totalWage: regularWage + row.overtimeWage,
        };
      }),
    );
    setEditingHeaderCell(null);
  }

  function applyOvertimeHourlyRate(value: string) {
    const rate = Number(value);
    const overtimeRate = (Number.isFinite(rate) ? rate : 0) * 8;

    setRows((current) =>
      current.map((row) => {
        const overtimeWage = row.overtimeDays * overtimeRate;
        return {
          ...row,
          overtimeRate,
          overtimeWage,
          totalWage: row.regularWage + overtimeWage,
        };
      }),
    );
    setEditingHeaderCell(null);
  }

  function editableHeaderTextCell(
    field: "employeeName" | "summaryDate",
    value: string,
  ) {
    const isEditing = editingHeaderCell === field;

    if (isEditing) {
      return (
        <Input
          autoFocus
          defaultValue={value}
          className="h-6 px-1 py-0 text-center"
          onBlur={(event) => {
            setHeaderEdits((current) => ({
              ...current,
              [field]: event.target.value,
            }));
            setEditingHeaderCell(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              setHeaderEdits((current) => ({
                ...current,
                [field]: event.currentTarget.value,
              }));
              setEditingHeaderCell(null);
            }
            if (event.key === "Escape") setEditingHeaderCell(null);
          }}
        />
      );
    }

    return editTooltip(
      <button
        type="button"
        className="min-h-5 w-full text-center leading-tight"
        onDoubleClick={() => setEditingHeaderCell(field)}
      >
        {value || "0"}
      </button>,
    );
  }

  function editableHeaderRateCell(
    field: "regularRate" | "overtimeHourlyRate",
    value: number,
    onCommit: (value: string) => void,
  ) {
    const isEditing = editingHeaderCell === field;

    if (isEditing) {
      return (
        <Input
          autoFocus
          type="number"
          step="0.01"
          defaultValue={String(value)}
          className="h-6 px-1 py-0 text-center"
          onBlur={(event) => onCommit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onCommit(event.currentTarget.value);
            if (event.key === "Escape") setEditingHeaderCell(null);
          }}
        />
      );
    }

    return editTooltip(
      <button
        type="button"
        className="min-h-5 w-full text-center tabular-nums leading-tight"
        onDoubleClick={() => setEditingHeaderCell(field)}
      >
        {formatCurrency(value)}
      </button>,
    );
  }

  function editableTextCell(
    rowIndex: number,
    field: "siteName",
    value: string,
  ) {
    const isEditing =
      editingCell?.rowIndex === rowIndex && editingCell.field === field;

    if (isEditing) {
      return (
        <Input
          autoFocus
          defaultValue={value}
          className="h-5 px-1 py-0 text-center"
          onBlur={(event) => {
            updateRow(rowIndex, { [field]: event.target.value });
            setEditingCell(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              updateRow(rowIndex, {
                [field]: event.currentTarget.value,
              });
              setEditingCell(null);
            }
            if (event.key === "Escape") setEditingCell(null);
          }}
        />
      );
    }

    return editTooltip(
      <button
        type="button"
        className="min-h-4 w-full text-center leading-none"
        onDoubleClick={() => setEditingCell({ rowIndex, field })}
      >
        {value || "0"}
      </button>,
    );
  }

  function editableNumberCell(
    rowIndex: number,
    field: Exclude<EditableCell, null>["field"],
    value: number,
    formatter: (value: number) => string,
    className = "text-right",
  ) {
    const isEditing =
      editingCell?.rowIndex === rowIndex && editingCell.field === field;

    if (isEditing) {
      return (
        <Input
          autoFocus
          type="number"
          step="0.01"
          defaultValue={String(value)}
          className={cn("h-5 px-1 py-0", className)}
          onBlur={(event) => commitNumber(rowIndex, field, event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              commitNumber(rowIndex, field, event.currentTarget.value);
            }
            if (event.key === "Escape") setEditingCell(null);
          }}
        />
      );
    }

    return editTooltip(
      <button
        type="button"
        className={cn("min-h-4 w-full tabular-nums leading-none", className)}
        onDoubleClick={() => setEditingCell({ rowIndex, field })}
      >
        {formatter(value)}
      </button>,
    );
  }

  function editableOvertimeHoursCell(
    rowIndex: number,
    overtimeDays: number,
    editable: boolean,
  ) {
    const value = overtimeDays * 8;
    const isEditing =
      editable &&
      editingCell?.rowIndex === rowIndex &&
      editingCell.field === "overtimeDays";

    if (isEditing) {
      return (
        <Input
          autoFocus
          type="number"
          step="0.5"
          defaultValue={String(value)}
          className="h-5 px-1 py-0 text-center"
          onBlur={(event) => {
            const hours = Number(event.target.value);
            updateRow(rowIndex, {
              overtimeDays: Number.isFinite(hours) ? hours / 8 : 0,
            });
            setEditingCell(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              const hours = Number(event.currentTarget.value);
              updateRow(rowIndex, {
                overtimeDays: Number.isFinite(hours) ? hours / 8 : 0,
              });
              setEditingCell(null);
            }
            if (event.key === "Escape") setEditingCell(null);
          }}
        />
      );
    }

    if (!editable) {
      return (
        <span className="block min-h-4 w-full text-center tabular-nums leading-none">
          {formatNumber(value)}
        </span>
      );
    }

    return editTooltip(
      <button
        type="button"
        className="min-h-4 w-full text-center tabular-nums leading-none"
        onDoubleClick={() =>
          setEditingCell({ rowIndex, field: "overtimeDays" })
        }
      >
        {formatNumber(value)}
      </button>,
    );
  }

  function editableOvertimeTypeCell(
    rowIndex: number,
    value: PayrollRow["overtimeType"],
  ) {
    const isEditing =
      editingCell?.rowIndex === rowIndex &&
      editingCell.field === "overtimeType";

    if (isEditing) {
      return (
        <select
          autoFocus
          defaultValue={value}
          className="h-5 rounded border bg-background px-1 text-xs"
          onBlur={(event) => {
            updateRow(rowIndex, {
              overtimeType: event.target.value as PayrollRow["overtimeType"],
            });
            setEditingCell(null);
          }}
          onChange={(event) => {
            updateRow(rowIndex, {
              overtimeType: event.target.value as PayrollRow["overtimeType"],
            });
            setEditingCell(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setEditingCell(null);
          }}
        >
          <option value="NONE">0</option>
          <option value="HALF_DAY">Half</option>
          <option value="FULL_DAY">Full</option>
        </select>
      );
    }

    return editTooltip(
      <button
        type="button"
        className="min-h-4 w-full text-center leading-none"
        onDoubleClick={() =>
          setEditingCell({ rowIndex, field: "overtimeType" })
        }
      >
        {overtimeLabel(value)}
      </button>,
    );
  }

  const exportExcel = async () => {
    if (!data?.selectedEmployee) return;

    setExporting(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Payroll Summary");

      sheet.mergeCells("A1:I1");
      sheet.getCell("A1").value = "Payroll Summary Report";
      sheet.getCell("A1").font = {
        bold: true,
        size: 20,
        color: { argb: "FFFFFFFF" },
      };
      sheet.getCell("A1").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1F2937" },
      };

      sheet.addRow([]);
      sheet.addRow([
        "Employee Name",
        displayEmployeeName,
        "",
        "",
        "Regular Rate (Day)",
        editedSummary.regularRate,
      ]);
      sheet.addRow([
        "Summary Date",
        displaySummaryDate,
        "",
        "",
        "Overtime Rate (Hr)",
        overtimeHourlyRate,
      ]);
      sheet.addRow([]);
      const exportHeaders =
        reportMode === "date"
          ? [
              "Date",
              "Site",
              "Regular Days",
              "Regular Wage",
              "Overtime Hours",
              "Overtime Minutes",
              "Overtime Wage",
              "Total Wage",
              "Foreman",
            ]
          : [
              "Month",
              "Site",
              "Regular Days",
              "Regular Wage",
              "Overtime Hours",
              "Overtime Minutes",
              "Overtime Wage",
              "Total Wage",
            ];

      sheet.addRow(exportHeaders);

      for (const row of reportRows) {
        const rowLabel =
          reportMode === "date"
            ? formatShortDate(row.date)
            : new Date(`${row.date}T00:00:00`).toLocaleDateString("en-ZA", {
                month: "long",
                year: "numeric",
              });

        sheet.addRow(
          reportMode === "date"
            ? [
                rowLabel,
                row.siteName || "0",
                row.regularDays || 0,
                row.regularWage || 0,
                row.overtimeDays * 8 || 0,
                0,
                row.overtimeWage || 0,
                row.totalWage || 0,
                row.foremanName || "0",
              ]
            : [
                rowLabel,
                row.siteName || "0",
                row.regularDays || 0,
                row.regularWage || 0,
                row.overtimeDays * 8 || 0,
                0,
                row.overtimeWage || 0,
                row.totalWage || 0,
              ],
        );
      }

      sheet.addRow(
        reportMode === "date"
          ? [
              "TOTAL",
              "",
              editedSummary.regularDays,
              editedSummary.regularWage,
              editedSummary.overtimeDays * 8,
              0,
              editedSummary.overtimeWage,
              editedSummary.totalWage,
              "",
            ]
          : [
              "TOTAL",
              "",
              editedSummary.regularDays,
              editedSummary.regularWage,
              editedSummary.overtimeDays * 8,
              0,
              editedSummary.overtimeWage,
              editedSummary.totalWage,
            ],
      );

      sheet.columns =
        reportMode === "date"
          ? [
              { width: 16 },
              { width: 28 },
              { width: 14 },
              { width: 16 },
              { width: 16 },
              { width: 14 },
              { width: 16 },
              { width: 16 },
              { width: 24 },
            ]
          : [
              { width: 18 },
              { width: 14 },
              { width: 14 },
              { width: 16 },
              { width: 16 },
              { width: 14 },
              { width: 16 },
              { width: 16 },
            ];

      sheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin", color: { argb: "FF888888" } },
            left: { style: "thin", color: { argb: "FF888888" } },
            bottom: { style: "thin", color: { argb: "FF888888" } },
            right: { style: "thin", color: { argb: "FF888888" } },
          };
          if (rowNumber === 6 || rowNumber === reportRows.length + 7) {
            cell.font = { bold: true };
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFE5E7EB" },
            };
          }
        });
      });

      for (const row of sheet.getRows(7, reportRows.length + 1) ?? []) {
        if (reportMode === "date") {
          row.getCell(4).numFmt = '"R"#,##0.00';
          row.getCell(7).numFmt = '"R"#,##0.00';
          row.getCell(8).numFmt = '"R"#,##0.00';
        } else {
          row.getCell(4).numFmt = '"R"#,##0.00';
          row.getCell(7).numFmt = '"R"#,##0.00';
          row.getCell(8).numFmt = '"R"#,##0.00';
        }
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `payroll-summary-${safeFilePart(data.selectedEmployee.name)}-${safeFilePart(data.period.startISO)}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("Payroll summary exported");
    } catch (error: any) {
      toast.error(error?.message || "Failed to export payroll summary");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4 px-4 pb-6">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Payroll Summary Report
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Search an employee, select them, then view their fortnight payroll
            report.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            title="Previous fortnight"
            onClick={() => setStartISO((value) => shiftISODate(value, -14))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="date"
              value={startISO}
              onChange={(event) => setStartISO(event.target.value)}
              className="w-41 pl-9"
              aria-label="Fortnight start date"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            title="Next fortnight"
            onClick={() => setStartISO((value) => shiftISODate(value, 14))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setStartISO(current.startISO)}
          >
            Current
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            title="Refresh"
            onClick={loadReport}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => window.print()}
            disabled={!data?.selectedEmployee}
          >
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button
            type="button"
            onClick={exportExcel}
            disabled={!data?.selectedEmployee || exporting}
          >
            <Download className="mr-2 h-4 w-4" />
            {exporting ? "Excel..." : "Excel"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={employeeSearch}
            onChange={(event) => {
              setEmployeeSearch(event.target.value);
              if (!event.target.value.trim()) setEmployeeId("");
            }}
            placeholder="Search employee name or code..."
            className="pl-9"
          />
        </div>

        {radixControlsMounted ? (
          <Select
            value={reportMode}
            onValueChange={(value) =>
              setReportMode(value as "date" | "month")
            }
          >
            <SelectTrigger
              className="w-full sm:w-48"
              aria-label="Report row mode"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Date rows</SelectItem>
              <SelectItem value="month">Month summary</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled
            className="w-full justify-between font-normal sm:w-48"
            aria-label="Report row mode"
          >
            {reportMode === "date" ? "Date rows" : "Month summary"}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        )}

        {radixControlsMounted ? (
          <Popover open={employeeOpen} onOpenChange={setEmployeeOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={employeeOpen}
                className="w-full justify-between font-normal sm:w-85"
              >
                <span className="truncate">{selectedEmployeeLabel}</span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-85 p-0" align="start">
              <Command>
                <CommandInput
                  value={employeeSearch}
                  onValueChange={setEmployeeSearch}
                  placeholder="Search employees..."
                />
                <CommandList>
                  <CommandEmpty>
                    No employees found for this fortnight.
                  </CommandEmpty>
                  <CommandGroup>
                    {(data?.employees ?? []).map((employee) => (
                      <CommandItem
                        key={employee.id}
                        value={`${employee.name} ${employee.code}`}
                        onSelect={() => {
                          setEmployeeId(employee.id);
                          setEmployeeSearch(employee.name);
                          setEmployeeOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            employee.id === employeeId
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                        <div>
                          <div className="font-medium">{employee.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {employee.code}
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled
            className="w-full justify-between font-normal sm:w-85"
          >
            <span className="truncate">{selectedEmployeeLabel}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        )}

        {data ? (
          <Badge variant="outline" className="h-9 px-3">
            {data.period.label}
          </Badge>
        ) : null}
      </div>

      {loading && !data ? (
        <div className="flex min-h-70 items-center justify-center rounded border bg-card">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading payroll summary
        </div>
      ) : null}

      {!loading && data && !data.selectedEmployee ? (
        <div className="rounded border bg-card p-10 text-center text-muted-foreground">
          Search for an employee above, then select them to generate the payroll
          summary report.
        </div>
      ) : null}

      {data?.selectedEmployee ? (
        // <div className="rounded border bg-muted/20 md:p-6">
        <div className="mx-auto max-w-7xl overflow-hidden rounded border-2 border-foreground bg-card shadow-sm">
          <div className="bg-primary px-6 py-2 text-primary-foreground">
            <div className="font-['Brush_Script_MT','Segoe_Script','Lucida_Handwriting',cursive] text-4xl font-normal italic leading-none tracking-wide">
              Payroll Summary Report
            </div>
          </div>

          <div className="grid border-y border-foreground/70 md:grid-cols-2">
            <div className="grid grid-cols-[180px_1fr] border-r border-foreground/70">
              <div className="border-b border-r border-foreground/70 bg-primary/20 px-3 py-2 text-sm font-bold">
                Employee Name
              </div>
              <div className="border-b border-foreground/70 px-3 py-2 text-center text-sm font-medium">
                {editableHeaderTextCell("employeeName", displayEmployeeName)}
              </div>
              <div className="border-r border-foreground/70 bg-primary/20 px-3 py-2 text-sm font-bold">
                Summary Date
              </div>
              <div className="px-3 py-2 text-center text-sm font-medium">
                {editableHeaderTextCell("summaryDate", displaySummaryDate)}
              </div>
            </div>

            <div className="grid grid-cols-[180px_1fr]">
              <div className="border-b border-r border-foreground/70 bg-primary/20 px-3 py-2 text-sm font-bold">
                Regular Rate (Day)
              </div>
              <div className="border-b border-foreground/70 px-3 py-2 text-center text-sm font-medium">
                {editableHeaderRateCell(
                  "regularRate",
                  editedSummary.regularRate,
                  applyRegularRate,
                )}
              </div>
              <div className="border-r border-foreground/70 bg-primary/20 px-3 py-2 text-sm font-bold">
                Overtime Rate (Hr)
              </div>
              <div className="px-3 py-2 text-center text-sm font-medium">
                {editableHeaderRateCell(
                  "overtimeHourlyRate",
                  overtimeHourlyRate,
                  applyOvertimeHourlyRate,
                )}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table className="min-w-260 border-collapse text-xs">
              <TableHeader>
                <TableRow className="border-0 hover:bg-transparent">
                  <TableHead
                    rowSpan={2}
                    className="w-37.5 border border-foreground/70 bg-primary py-0 text-center text-primary-foreground"
                  >
                    {reportMode === "date" ? "DATE" : "MONTHS"}
                  </TableHead>
                  <TableHead
                    rowSpan={2}
                    className="w-57.5 border border-foreground/70 bg-primary py-0 text-center text-primary-foreground"
                  >
                    SITE
                  </TableHead>
                  <TableHead
                    colSpan={3}
                    className="border border-foreground/70 bg-primary py-0 text-center text-primary-foreground"
                  >
                    REGULAR
                  </TableHead>
                  <TableHead
                    colSpan={3}
                    className="border border-foreground/70 bg-primary py-0 text-center text-primary-foreground"
                  >
                    OVERTIME
                  </TableHead>
                  <TableHead
                    rowSpan={2}
                    className="w-[150px] border border-foreground/70 bg-primary py-0 text-center text-primary-foreground"
                  >
                    TOTAL WAGE
                  </TableHead>
                </TableRow>
                <TableRow className="border-0 hover:bg-transparent">
                  <TableHead className="border border-foreground/70 bg-primary/20 py-0 text-center text-foreground">
                    Days
                  </TableHead>
                  <TableHead className="border border-foreground/70 bg-primary/20 py-0 text-center text-foreground">
                    Rate
                  </TableHead>
                  <TableHead className="border border-foreground/70 bg-primary/20 py-0 text-center text-foreground">
                    Wage
                  </TableHead>
                  <TableHead className="border border-foreground/70 bg-primary/20 py-0 text-center text-foreground">
                    Hours
                  </TableHead>
                  <TableHead className="border border-foreground/70 bg-primary/20 py-0 text-center text-foreground">
                    Minutes
                  </TableHead>
                  <TableHead className="border border-foreground/70 bg-primary/20 py-0 text-center text-foreground">
                    Wage
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportRows.map((row, rowIndex) => (
                  <TableRow key={row.date}>
                    <TableCell className="border border-foreground/40 bg-muted/30 py-1.5 text-center font-medium">
                      {reportMode === "date"
                        ? formatShortDate(row.date)
                        : new Date(`${row.date}T00:00:00`).toLocaleDateString(
                            "en-ZA",
                            {
                              month: "long",
                              year: "numeric",
                            },
                          )}
                    </TableCell>
                    <TableCell className="border border-foreground/40 py-0 text-center">
                      {reportMode === "date"
                        ? editableTextCell(rowIndex, "siteName", row.siteName)
                        : row.siteName || "0"}
                    </TableCell>
                    <TableCell className="border border-foreground/40 py-0 text-center tabular-nums">
                      {reportMode === "date"
                        ? editableNumberCell(
                            rowIndex,
                            "regularDays",
                            row.regularDays,
                            formatNumber,
                            "text-center",
                          )
                        : formatNumber(row.regularDays)}
                    </TableCell>
                    <TableCell className="border border-foreground/40 py-0 text-right tabular-nums">
                      {reportMode === "date"
                        ? editableNumberCell(
                            rowIndex,
                            "regularRate",
                            row.regularRate,
                            formatCurrency,
                          )
                        : formatCurrency(row.regularRate)}
                    </TableCell>
                    <TableCell className="border border-foreground/40 py-0 text-right tabular-nums">
                      {reportMode === "date"
                        ? editableNumberCell(
                            rowIndex,
                            "regularWage",
                            row.regularWage,
                            formatCurrency,
                          )
                        : formatCurrency(row.regularWage)}
                    </TableCell>
                    <TableCell className="border border-foreground/40 py-0 text-center">
                      {editableOvertimeHoursCell(
                        rowIndex,
                        row.overtimeDays,
                        reportMode === "date",
                      )}
                    </TableCell>
                    <TableCell className="border border-foreground/40 py-0 text-center tabular-nums">
                      0
                    </TableCell>
                    <TableCell className="border border-foreground/40 py-0 text-right tabular-nums">
                      {reportMode === "date"
                        ? editableNumberCell(
                            rowIndex,
                            "overtimeWage",
                            row.overtimeWage,
                            formatCurrency,
                          )
                        : formatCurrency(row.overtimeWage)}
                    </TableCell>
                    <TableCell className="border border-foreground/40 py-0 text-right font-semibold tabular-nums">
                      {reportMode === "date"
                        ? editableNumberCell(
                            rowIndex,
                            "totalWage",
                            row.totalWage,
                            formatCurrency,
                          )
                        : formatCurrency(row.totalWage)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell
                    colSpan={2}
                    className="border border-foreground/70 bg-primary/20 py-0 text-center font-bold"
                  >
                    TOTAL
                  </TableCell>
                  <TableCell className="border border-foreground/70 bg-primary/20 py-0 text-center font-bold tabular-nums">
                    {formatNumber(editedSummary.regularDays)}
                  </TableCell>
                  <TableCell className="border border-foreground/70 bg-primary/20 py-0 text-right font-bold tabular-nums">
                    {formatCurrency(editedSummary.regularRate)}
                  </TableCell>
                  <TableCell className="border border-foreground/70 bg-primary/20 py-0 text-right font-bold tabular-nums">
                    {formatCurrency(editedSummary.regularWage)}
                  </TableCell>
                  <TableCell className="border border-foreground/70 bg-primary/20 py-0 text-center font-bold tabular-nums">
                    {formatNumber(editedSummary.overtimeDays * 8)}
                  </TableCell>
                  <TableCell className="border border-foreground/70 bg-primary/20 py-0 text-center font-bold tabular-nums">
                    0
                  </TableCell>
                  <TableCell className="border border-foreground/70 bg-primary/20 py-0 text-right font-bold tabular-nums">
                    {formatCurrency(editedSummary.overtimeWage)}
                  </TableCell>
                  <TableCell className="border border-foreground/70 bg-primary/20 py-0 text-right font-bold tabular-nums">
                    {formatCurrency(editedSummary.totalWage)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="border-t border-foreground/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            {activeRows.length} attended day
            {activeRows.length === 1 ? "" : "s"} for{" "}
            {data.selectedEmployee.name} in this fortnight.
          </div>
        </div>
      ) : // </div>
      null}
    </div>
  );
}
