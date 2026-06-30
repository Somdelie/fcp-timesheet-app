"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  FileSpreadsheet,
  Search,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatCurrency";
import type { SiteWageCostPeriod, SiteWageCostRow } from "./site-wage-costs";

const ALL_SUPERVISORS = "__all_supervisors__";
const UNASSIGNED_SUPERVISOR = "__unassigned_supervisor__";

type StatusFilter = "all" | "NOT_STARTED" | "ONGOING" | "COMPLETED" | "ON_HOLD";
type ShowFilter = "active" | "all" | "inactive";
type WageFilter = "all" | "with" | "without";
type SortValue =
  | "total-desc"
  | "current-desc"
  | "increased-desc"
  | "previous-desc"
  | "job-asc"
  | "site-asc";

function dateRangeLabel(period: SiteWageCostPeriod) {
  const start = parseISODate(period.startISO);
  const end = parseISODate(period.endISO);
  if (!start || !end) return `${period.startISO} to ${period.endISO}`;

  if (start.getFullYear() === end.getFullYear()) {
    return `${formatPeriodDayMonth(start)} to ${formatPeriodDayMonth(
      end,
    )} - ${end.getFullYear()}`;
  }

  return `${formatPeriodDayMonthYear(start)} to ${formatPeriodDayMonthYear(
    end,
  )}`;
}

function parseISODate(iso: string) {
  const date = new Date(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatPeriodDayMonth(date: Date) {
  return date.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "long",
  });
}

function formatPeriodDayMonthYear(date: Date) {
  return date.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function totalsFor(rows: SiteWageCostRow[]) {
  return rows.reduce(
    (acc, row) => ({
      previousWages: acc.previousWages + row.previousWages,
      currentWages: acc.currentWages + row.currentWages,
      totalWages: acc.totalWages + row.totalWages,
      previousScans: acc.previousScans + row.previousScans,
      currentScans: acc.currentScans + row.currentScans,
    }),
    {
      previousWages: 0,
      currentWages: 0,
      totalWages: 0,
      previousScans: 0,
      currentScans: 0,
    },
  );
}

function changePct(current: number, previous: number) {
  if (previous === 0) return current > 0 ? null : 0;
  return ((current - previous) / previous) * 100;
}

function formatChange(current: number, previous: number) {
  const pct = changePct(current, previous);
  if (pct === null) return "New";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function changeClass(current: number, previous: number) {
  const pct = changePct(current, previous);
  if (pct === null || pct > 0) return "text-emerald-700 dark:text-emerald-400";
  if (pct < 0) return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
}

function compareRows(sort: SortValue) {
  return (a: SiteWageCostRow, b: SiteWageCostRow) => {
    if (sort === "current-desc") return b.currentWages - a.currentWages;
    if (sort === "increased-desc") {
      return (
        b.currentWages - b.previousWages - (a.currentWages - a.previousWages)
      );
    }
    if (sort === "previous-desc") return b.previousWages - a.previousWages;
    if (sort === "job-asc")
      return (a.code ?? a.name).localeCompare(b.code ?? b.name);
    if (sort === "site-asc") return a.name.localeCompare(b.name);
    return b.totalWages - a.totalWages;
  };
}

function safeFilePart(value: string) {
  return value.replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "");
}

function downloadBlob(
  data: BlobPart,
  filename: string,
  type: string,
) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function textWidthSafe(
  font: { widthOfTextAtSize: (text: string, size: number) => number },
  text: string,
  size: number,
) {
  return font.widthOfTextAtSize(text, size);
}

function truncatePdfText(
  font: { widthOfTextAtSize: (text: string, size: number) => number },
  text: string,
  maxWidth: number,
  size: number,
) {
  let value = text;
  while (value.length > 0 && textWidthSafe(font, value, size) > maxWidth) {
    value = value.slice(0, -1);
  }
  return value.length === text.length ? value : `${value.slice(0, -1)}...`;
}

async function exportWageCostsExcel(input: {
  rows: SiteWageCostRow[];
  previousPeriod: SiteWageCostPeriod;
  currentPeriod: SiteWageCostPeriod;
  totals: ReturnType<typeof totalsFor>;
}) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "FirstClass Projects";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Wage Costs", {
    views: [{ state: "frozen", ySplit: 5 }],
  });

  const previousLabel = dateRangeLabel(input.previousPeriod);
  const currentLabel = dateRangeLabel(input.currentPeriod);

  sheet.mergeCells("A1:J1");
  sheet.getCell("A1").value = "Site Wage Costs";
  sheet.getCell("A1").font = { bold: true, size: 16, color: { argb: "FF111827" } };
  sheet.getCell("A1").alignment = { vertical: "middle" };

  sheet.mergeCells("A2:J2");
  sheet.getCell("A2").value = `${previousLabel} and ${currentLabel}`;
  sheet.getCell("A2").font = { size: 11, color: { argb: "FF475569" } };

  sheet.addRow([]);
  const totalsRow = sheet.addRow([
    "Filtered total",
    "",
    "",
    "",
    input.totals.previousWages,
    input.totals.currentWages,
    formatChange(input.totals.currentWages, input.totals.previousWages),
    input.totals.previousScans,
    input.totals.currentScans,
    formatChange(input.totals.currentScans, input.totals.previousScans),
  ]);
  totalsRow.font = { bold: true };
  totalsRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF8FAFC" },
  };

  const headerRow = sheet.addRow([
    "Job No.",
    "Site",
    "Supervisor",
    "Client",
    `Previous Wages (${previousLabel})`,
    `Current Wages (${currentLabel})`,
    "Wage %",
    "Previous Scans",
    "Current Scans",
    "Scan %",
  ]);
  headerRow.font = { bold: true, color: { argb: "FF111827" } };
  headerRow.height = 22;

  input.rows.forEach((row) => {
    sheet.addRow([
      row.code ?? "Uncoded",
      row.name,
      row.supervisorName ?? "-",
      row.client ?? "-",
      row.previousWages,
      row.currentWages,
      formatChange(row.currentWages, row.previousWages),
      row.previousScans,
      row.currentScans,
      formatChange(row.currentScans, row.previousScans),
    ]);
  });

  sheet.columns = [
    { width: 12 },
    { width: 34 },
    { width: 22 },
    { width: 24 },
    { width: 20 },
    { width: 20 },
    { width: 12 },
    { width: 16 },
    { width: 16 },
    { width: 12 },
  ];

  sheet.eachRow((row, rowNumber) => {
    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: colNumber >= 5 ? "right" : "left",
      };
      if (rowNumber === 5) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor:
            colNumber === 5 || colNumber === 8
              ? { argb: "FFD1FAE5" }
              : colNumber === 6 || colNumber === 9
                ? { argb: "FFDBEAFE" }
                : { argb: "FFF1F5F9" },
        };
      }
      if (colNumber === 5 || colNumber === 6) {
        cell.numFmt = '"R "#,##0.00';
      }
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    buffer,
    `site-wage-costs-${safeFilePart(input.currentPeriod.startISO)}.xlsx`,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}

async function exportWageCostsPdf(input: {
  rows: SiteWageCostRow[];
  previousPeriod: SiteWageCostPeriod;
  currentPeriod: SiteWageCostPeriod;
  totals: ReturnType<typeof totalsFor>;
}) {
  const { PDFDocument, StandardFonts, rgb, PageSizes } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const pageSize = PageSizes.A4;
  const pageWidth = pageSize[1];
  const pageHeight = pageSize[0];
  const margin = 28;
  const rowHeight = 20;
  const headerHeight = 28;
  const tableWidth = pageWidth - margin * 2;
  const columns = [
    { label: "Job No.", width: 48, align: "left" as const },
    { label: "Site", width: 135, align: "left" as const },
    { label: "Supervisor", width: 88, align: "left" as const },
    { label: "Client", width: 82, align: "left" as const },
    { label: "Previous", width: 86, align: "right" as const },
    { label: "Current", width: 86, align: "right" as const },
    { label: "Wage %", width: 54, align: "right" as const },
    { label: "Prev Scans", width: 62, align: "right" as const },
    { label: "Curr Scans", width: 62, align: "right" as const },
    { label: "Scan %", width: tableWidth - 703, align: "right" as const },
  ];

  const ink = rgb(0.08, 0.1, 0.14);
  const muted = rgb(0.35, 0.42, 0.54);
  const border = rgb(0.86, 0.88, 0.91);
  const headerBg = rgb(0.95, 0.97, 0.99);
  const greenBg = rgb(0.9, 0.98, 0.94);
  const blueBg = rgb(0.91, 0.95, 1);

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  function drawText(
    text: string,
    x: number,
    yText: number,
    size: number,
    font = regular,
    color = ink,
  ) {
    page.drawText(text, { x, y: yText, size, font, color });
  }

  function drawHeader() {
    drawText("Site Wage Costs", margin, y - 4, 15, bold);
    drawText(
      `${dateRangeLabel(input.previousPeriod)} and ${dateRangeLabel(
        input.currentPeriod,
      )}`,
      margin,
      y - 20,
      8.5,
      regular,
      muted,
    );
    const totalText = `Total: ${formatCurrency(input.totals.totalWages)}`;
    drawText(
      totalText,
      pageWidth - margin - bold.widthOfTextAtSize(totalText, 10),
      y - 12,
      10,
      bold,
    );
    y -= 42;
  }

  function drawTableHeader() {
    let x = margin;
    page.drawRectangle({
      x,
      y: y - headerHeight,
      width: tableWidth,
      height: headerHeight,
      color: headerBg,
      borderColor: border,
      borderWidth: 1,
    });
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const bg = i === 4 || i === 7 ? greenBg : i === 5 || i === 8 ? blueBg : null;
      if (bg) {
        page.drawRectangle({
          x,
          y: y - headerHeight,
          width: col.width,
          height: headerHeight,
          color: bg,
        });
      }
      page.drawLine({
        start: { x, y },
        end: { x, y: y - headerHeight },
        thickness: 0.5,
        color: border,
      });
      const labelWidth = bold.widthOfTextAtSize(col.label, 7.5);
      const labelX =
        col.align === "right" ? x + col.width - labelWidth - 4 : x + 4;
      drawText(col.label, labelX, y - 17, 7.5, bold);
      x += col.width;
    }
    y -= headerHeight;
  }

  function ensureSpace() {
    if (y - rowHeight < margin + 18) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
      drawHeader();
      drawTableHeader();
    }
  }

  function drawRow(values: string[], isTotal = false) {
    ensureSpace();
    let x = margin;
    page.drawRectangle({
      x,
      y: y - rowHeight,
      width: tableWidth,
      height: rowHeight,
      color: isTotal ? headerBg : rgb(1, 1, 1),
      borderColor: border,
      borderWidth: 0.5,
    });
    values.forEach((value, i) => {
      const col = columns[i];
      const font = isTotal ? bold : regular;
      const text = truncatePdfText(font, value, col.width - 8, 7.5);
      const w = font.widthOfTextAtSize(text, 7.5);
      const textX = col.align === "right" ? x + col.width - w - 4 : x + 4;
      drawText(text, textX, y - 13, 7.5, font);
      page.drawLine({
        start: { x, y },
        end: { x, y: y - rowHeight },
        thickness: 0.4,
        color: border,
      });
      x += col.width;
    });
    y -= rowHeight;
  }

  drawHeader();
  drawTableHeader();
  drawRow(
    [
      "TOTAL",
      "",
      "",
      "",
      formatCurrency(input.totals.previousWages),
      formatCurrency(input.totals.currentWages),
      formatChange(input.totals.currentWages, input.totals.previousWages),
      String(input.totals.previousScans),
      String(input.totals.currentScans),
      formatChange(input.totals.currentScans, input.totals.previousScans),
    ],
    true,
  );

  input.rows.forEach((row) => {
    drawRow([
      row.code ?? "Uncoded",
      row.name,
      row.supervisorName ?? "-",
      row.client ?? "-",
      formatCurrency(row.previousWages),
      formatCurrency(row.currentWages),
      formatChange(row.currentWages, row.previousWages),
      String(row.previousScans),
      String(row.currentScans),
      formatChange(row.currentScans, row.previousScans),
    ]);
  });

  const pages = pdf.getPages();
  pages.forEach((pdfPage, index) => {
    const pageText = `Page ${index + 1} of ${pages.length}`;
    pdfPage.drawText(pageText, {
      x: pageWidth - margin - regular.widthOfTextAtSize(pageText, 7),
      y: 14,
      size: 7,
      font: regular,
      color: muted,
    });
  });

  const bytes = await pdf.save();
  const pdfBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(pdfBuffer).set(bytes);
  downloadBlob(
    pdfBuffer,
    `site-wage-costs-${safeFilePart(input.currentPeriod.startISO)}.pdf`,
    "application/pdf",
  );
}

export default function SiteWageCostsClient({
  rows,
  previousPeriod,
  currentPeriod,
}: {
  rows: SiteWageCostRow[];
  previousPeriod: SiteWageCostPeriod;
  currentPeriod: SiteWageCostPeriod;
}) {
  const [query, setQuery] = React.useState("");
  const [supervisorFilter, setSupervisorFilter] =
    React.useState(ALL_SUPERVISORS);
  const [statusFilter, setStatusFilter] =
    React.useState<StatusFilter>("ONGOING");
  const [showFilter, setShowFilter] = React.useState<ShowFilter>("active");
  const [wageFilter, setWageFilter] = React.useState<WageFilter>("all");
  const [sort, setSort] = React.useState<SortValue>("total-desc");
  const [pageIndex, setPageIndex] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(10);
  const [exporting, setExporting] = React.useState<"pdf" | "excel" | null>(
    null,
  );

  const supervisorOptions = React.useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .map((row) => row.supervisorName?.trim())
            .filter((name): name is string => Boolean(name)),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [rows],
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();

    return rows
      .filter((row) => {
        if (showFilter === "active" && !row.isActive) return false;
        if (showFilter === "inactive" && row.isActive) return false;
        if (statusFilter !== "all" && row.jobStatus !== statusFilter) {
          return false;
        }
        if (
          supervisorFilter !== ALL_SUPERVISORS &&
          supervisorFilter !== UNASSIGNED_SUPERVISOR &&
          row.supervisorName?.trim() !== supervisorFilter
        ) {
          return false;
        }
        if (
          supervisorFilter === UNASSIGNED_SUPERVISOR &&
          row.supervisorName?.trim()
        ) {
          return false;
        }
        if (wageFilter === "with" && row.totalWages <= 0) return false;
        if (wageFilter === "without" && row.totalWages > 0) return false;
        if (
          sort === "increased-desc" &&
          row.currentWages <= row.previousWages
        ) {
          return false;
        }
        if (!q) return true;

        return (
          row.name.toLowerCase().includes(q) ||
          (row.code ?? "").toLowerCase().includes(q) ||
          (row.client ?? "").toLowerCase().includes(q) ||
          (row.supervisorName ?? "").toLowerCase().includes(q)
        );
      })
      .sort(compareRows(sort));
  }, [
    rows,
    query,
    showFilter,
    statusFilter,
    supervisorFilter,
    wageFilter,
    sort,
  ]);

  React.useEffect(() => {
    setPageIndex(0);
  }, [query, showFilter, statusFilter, supervisorFilter, wageFilter, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  const pageRows = filtered.slice(
    safePageIndex * pageSize,
    safePageIndex * pageSize + pageSize,
  );
  const totals = totalsFor(filtered);
  const activeFilterCount =
    (query.trim() ? 1 : 0) +
    (supervisorFilter !== ALL_SUPERVISORS ? 1 : 0) +
    (statusFilter !== "ONGOING" ? 1 : 0) +
    (showFilter !== "active" ? 1 : 0) +
    (wageFilter !== "all" ? 1 : 0);

  const showingFrom = filtered.length === 0 ? 0 : safePageIndex * pageSize + 1;
  const showingTo = Math.min((safePageIndex + 1) * pageSize, filtered.length);

  function clearFilters() {
    setQuery("");
    setSupervisorFilter(ALL_SUPERVISORS);
    setStatusFilter("ONGOING");
    setShowFilter("active");
    setWageFilter("all");
    setSort("total-desc");
  }

  async function handleExcelDownload() {
    setExporting("excel");
    try {
      await exportWageCostsExcel({
        rows: filtered,
        previousPeriod,
        currentPeriod,
        totals,
      });
    } finally {
      setExporting(null);
    }
  }

  async function handlePdfDownload() {
    setExporting("pdf");
    try {
      await exportWageCostsPdf({
        rows: filtered,
        previousPeriod,
        currentPeriod,
        totals,
      });
    } finally {
      setExporting(null);
    }
  }

  return (
    <section className="space-y-3">
      <div className="rounded border border-zinc-200/50 bg-white/80 px-3 py-2 shadow-sm backdrop-blur-sm transition-all hover:shadow-md dark:border-zinc-700/50 dark:bg-card/40">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search..."
              className="h-8 pl-8 text-sm dark:border-zinc-700/50 dark:bg-zinc-800/50"
            />
          </div>

          <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-700" />

          <Select value={supervisorFilter} onValueChange={setSupervisorFilter}>
            <SelectTrigger className="h-8 w-48 text-xs md:text-sm dark:border-zinc-700/50 dark:bg-zinc-800/50">
              <SelectValue placeholder="Supervisor" />
            </SelectTrigger>
            <SelectContent side="top">
              <SelectItem value={ALL_SUPERVISORS}>All supervisors</SelectItem>
              <SelectItem value={UNASSIGNED_SUPERVISOR}>Unassigned</SelectItem>
              {supervisorOptions.map((supervisorName) => (
                <SelectItem key={supervisorName} value={supervisorName}>
                  {supervisorName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as StatusFilter)}
          >
            <SelectTrigger className="h-8 w-40 text-xs md:text-sm dark:border-zinc-700/50 dark:bg-zinc-800/50">
              <SelectValue placeholder="Job status" />
            </SelectTrigger>
            <SelectContent side="top">
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="ONGOING">Ongoing</SelectItem>
              <SelectItem value="NOT_STARTED">Not Started</SelectItem>
              <SelectItem value="ON_HOLD">On Hold</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={showFilter}
            onValueChange={(value) => setShowFilter(value as ShowFilter)}
          >
            <SelectTrigger className="h-8 w-32 text-xs md:text-sm dark:border-zinc-700/50 dark:bg-zinc-800/50">
              <SelectValue placeholder="Sites" />
            </SelectTrigger>
            <SelectContent side="top">
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="all">All sites</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={wageFilter}
            onValueChange={(value) => setWageFilter(value as WageFilter)}
          >
            <SelectTrigger className="h-8 w-36 text-xs md:text-sm dark:border-zinc-700/50 dark:bg-zinc-800/50">
              <SelectValue placeholder="Wages" />
            </SelectTrigger>
            <SelectContent side="top">
              <SelectItem value="all">All wages</SelectItem>
              <SelectItem value="with">With wages</SelectItem>
              <SelectItem value="without">No wages</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={sort}
            onValueChange={(value) => setSort(value as SortValue)}
          >
            <SelectTrigger className="h-8 w-40 text-xs md:text-sm dark:border-zinc-700/50 dark:bg-zinc-800/50">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent side="top">
              <SelectItem value="total-desc">Combined high</SelectItem>
              <SelectItem value="current-desc">Current high</SelectItem>
              <SelectItem value="increased-desc">Increased</SelectItem>
              <SelectItem value="previous-desc">Previous high</SelectItem>
              <SelectItem value="job-asc">Job number</SelectItem>
              <SelectItem value="site-asc">Site name</SelectItem>
            </SelectContent>
          </Select>

          {activeFilterCount > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 px-2"
              onClick={clearFilters}
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          ) : null}

          <div className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 px-2"
              onClick={handlePdfDownload}
              disabled={filtered.length === 0 || exporting !== null}
            >
              <Download className="h-3.5 w-3.5" />
              {exporting === "pdf" ? "PDF..." : "PDF"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 px-2"
              onClick={handleExcelDownload}
              disabled={filtered.length === 0 || exporting !== null}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              {exporting === "excel" ? "Excel..." : "Excel"}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded border bg-background p-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Site Wage Costs
          </h1>
          <p className="text-sm text-muted-foreground">
            {dateRangeLabel(previousPeriod)} and {dateRangeLabel(currentPeriod)}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-right text-sm">
          <div className="border-r pr-2 border-zinc-400 dark:border-zinc-700">
            <div className="text-xs text-muted-foreground">Previous</div>
            <div className="font-semibold">
              {formatCurrency(totals.previousWages)}
            </div>
          </div>
          <div className="border-r pr-2 border-zinc-400 dark:border-zinc-700">
            <div className="text-xs text-muted-foreground">Current</div>
            <div className="font-semibold">
              {formatCurrency(totals.currentWages)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Combined</div>
            <div className="font-semibold">
              {formatCurrency(totals.totalWages)}
            </div>
          </div>
        </div>
      </div>

      <div className="border bg-card">
        <div className="overflow-x-auto">
          <Table className="border-separate border-spacing-0">
            <TableHeader className="bg-muted/60">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[110px] border border-zinc-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide dark:border-zinc-700">
                  Job No.
                </TableHead>
                <TableHead className="min-w-[220px] border border-zinc-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide dark:border-zinc-700">
                  Site
                </TableHead>
                <TableHead className="min-w-[150px] border border-zinc-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide dark:border-zinc-700">
                  Supervisor
                </TableHead>
                <TableHead className="min-w-[140px] border border-zinc-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide dark:border-zinc-700">
                  Client
                </TableHead>
                <TableHead className="min-w-[160px] border border-zinc-200 bg-emerald-100 px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide dark:border-zinc-700 dark:bg-emerald-900/40">
                  Previous
                  <span className="block text-[11px] font-normal normal-case text-muted-foreground">
                    {dateRangeLabel(previousPeriod)}
                  </span>
                </TableHead>
                <TableHead className="min-w-[160px] border border-zinc-200 bg-blue-100 px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide dark:border-zinc-700 dark:bg-blue-900/40">
                  Current
                  <span className="block text-[11px] font-normal normal-case text-muted-foreground">
                    {dateRangeLabel(currentPeriod)}
                  </span>
                </TableHead>
                <TableHead className="w-[120px] border border-zinc-200 bg-emerald-100 px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide dark:border-zinc-700 dark:bg-emerald-900/40">
                  Previous Scans
                  <span className="block text-[11px] font-normal normal-case text-muted-foreground">
                    {dateRangeLabel(previousPeriod)}
                  </span>
                </TableHead>
                <TableHead className="w-[120px] border border-zinc-200 bg-blue-100 px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide dark:border-zinc-700 dark:bg-blue-900/40">
                  Current Scans
                  <span className="block text-[11px] font-normal normal-case text-muted-foreground">
                    {dateRangeLabel(currentPeriod)}
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length ? (
                pageRows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                  >
                    <TableCell className="border border-zinc-200 px-3 py-2 font-medium dark:border-zinc-700">
                      {row.code ?? "Uncoded"}
                    </TableCell>
                    <TableCell className="border border-zinc-200 px-3 py-2 dark:border-zinc-700">
                      <div className="font-medium text-foreground">
                        {row.name}
                      </div>
                      {!row.isActive ? (
                        <div className="text-xs text-muted-foreground">
                          Inactive
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="border border-zinc-200 px-3 py-2 text-muted-foreground dark:border-zinc-700">
                      {row.supervisorName ?? "-"}
                    </TableCell>
                    <TableCell className="border border-zinc-200 px-3 py-2 text-muted-foreground dark:border-zinc-700">
                      {row.client ?? "-"}
                    </TableCell>
                    <TableCell className="border border-zinc-200 bg-emerald-50 px-3 py-2 text-right tabular-nums dark:border-zinc-700 dark:bg-emerald-900/20">
                      {formatCurrency(row.previousWages)}
                    </TableCell>
                    <TableCell className="border border-zinc-200 bg-blue-50 px-3 py-2 tabular-nums dark:border-zinc-700 dark:bg-blue-900/20">
                      <div className="flex items-center justify-between gap-3">
                        <span
                          className={`font-semibold ${changeClass(
                            row.currentWages,
                            row.previousWages,
                          )}`}
                        >
                          {formatChange(row.currentWages, row.previousWages)}
                        </span>
                        <span>{formatCurrency(row.currentWages)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="border border-zinc-200 bg-emerald-50 px-3 py-2 text-right text-muted-foreground tabular-nums dark:border-zinc-700 dark:bg-emerald-900/20">
                      {row.previousScans}
                    </TableCell>
                    <TableCell className="border border-zinc-200 bg-blue-50 px-3 py-2 tabular-nums dark:border-zinc-700 dark:bg-blue-900/20">
                      <div className="flex items-center justify-between gap-3">
                        <span
                          className={`font-semibold ${changeClass(
                            row.currentScans,
                            row.previousScans,
                          )}`}
                        >
                          {formatChange(row.currentScans, row.previousScans)}
                        </span>
                        <span className="text-muted-foreground">
                          {row.currentScans}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4}>Filtered total</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(totals.previousWages)}
                </TableCell>
                <TableCell className="tabular-nums">
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={changeClass(
                        totals.currentWages,
                        totals.previousWages,
                      )}
                    >
                      {formatChange(totals.currentWages, totals.previousWages)}
                    </span>
                    <span>{formatCurrency(totals.currentWages)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {totals.previousScans}
                </TableCell>
                <TableCell className="tabular-nums">
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={changeClass(
                        totals.currentScans,
                        totals.previousScans,
                      )}
                    >
                      {formatChange(totals.currentScans, totals.previousScans)}
                    </span>
                    <span>{totals.currentScans}</span>
                  </div>
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>

        <div className="flex items-center justify-between border-t bg-muted/60 px-4 py-3">
          <div className="hidden text-sm text-muted-foreground lg:flex">
            Showing {showingFrom} to {showingTo} of {filtered.length} sites
          </div>
          <div className="flex w-full items-center gap-4 lg:w-fit lg:gap-8">
            <div className="hidden items-center gap-2 lg:flex">
              <span className="text-sm font-medium">Rows per page</span>
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  setPageIndex(0);
                }}
              >
                <SelectTrigger className="h-8 w-20">
                  <SelectValue placeholder={pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                  {[5, 10, 25, 50, 100].map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-fit items-center justify-center text-sm font-medium">
              Page {safePageIndex + 1} of {pageCount}
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button
                variant="outline"
                size="icon"
                className="hidden h-8 w-8 lg:flex"
                onClick={() => setPageIndex(0)}
                disabled={safePageIndex === 0}
              >
                <span className="sr-only">Go to first page</span>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPageIndex((page) => Math.max(0, page - 1))}
                disabled={safePageIndex === 0}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() =>
                  setPageIndex((page) => Math.min(pageCount - 1, page + 1))
                }
                disabled={safePageIndex >= pageCount - 1}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="hidden h-8 w-8 lg:flex"
                onClick={() => setPageIndex(pageCount - 1)}
                disabled={safePageIndex >= pageCount - 1}
              >
                <span className="sr-only">Go to last page</span>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
