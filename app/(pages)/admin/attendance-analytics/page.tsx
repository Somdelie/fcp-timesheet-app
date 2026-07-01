"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  FileSpreadsheet,
  Loader2,
  Minus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "react-toastify";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { addDays, currentFortnightSatFri, toISODate } from "@/lib/fortnight";

type DayRow = {
  date: string;
  total: number;
  percentChange: number | null;
};

type SiteDayRow = DayRow & {
  siteId: string;
  siteName: string;
  siteCode: string | null;
  supervisorName: string | null;
};

type SiteOption = {
  id: string;
  name: string;
  code: string | null;
  supervisorName: string | null;
};

type AnalyticsResponse = {
  period: {
    startISO: string;
    endISO: string;
    label: string;
  };
  summary: {
    totalAttendance: number;
    averagePerDay: number;
    bestDay: DayRow | null;
    activeSiteCount: number;
  };
  days: DayRow[];
  perSite: SiteDayRow[];
  sites: SiteOption[];
};

type SiteAnalyticsRow = {
  siteId: string;
  siteName: string;
  siteCode: string | null;
  supervisorName: string | null;
  total: number;
  days: SiteDayRow[];
};

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function shiftISODate(iso: string, days: number) {
  return toISODate(addDays(new Date(`${iso}T00:00:00`), days));
}

function siteRowLabel(site: Pick<SiteDayRow, "siteCode" | "siteName">) {
  return site.siteCode ? `${site.siteCode} - ${site.siteName}` : site.siteName;
}

function supervisorLabel(site: Pick<SiteDayRow, "supervisorName">) {
  return site.supervisorName?.trim() || "No supervisor";
}

function safeFilePart(value: string) {
  return value.replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "");
}

function formatPercent(value: number | null) {
  if (value === null) return "New";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatDayCell(day: DayRow) {
  return `${day.total} (${formatPercent(day.percentChange)})`;
}

function downloadBlob(data: BlobPart, filename: string, type: string) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function truncatePdfText(
  font: { widthOfTextAtSize: (text: string, size: number) => number },
  text: string,
  maxWidth: number,
  size: number,
) {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;

  let value = text;
  while (
    value.length > 1 &&
    font.widthOfTextAtSize(`${value}...`, size) > maxWidth
  ) {
    value = value.slice(0, -1);
  }
  return `${value}...`;
}

async function exportAttendanceExcel(input: {
  data: AnalyticsResponse;
  rows: SiteAnalyticsRow[];
  selectedSiteLabel: string;
}) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "FirstClass Projects";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Attendance Analytics", {
    views: [{ state: "frozen", ySplit: 7, xSplit: 1 }],
  });
  const columnCount = input.data.days.length + 2;
  const lastColumn = sheet.getColumn(columnCount).letter;

  sheet.mergeCells(`A1:${lastColumn}1`);
  sheet.getCell("A1").value = "Fortnight Attendance Report";
  sheet.getCell("A1").font = {
    bold: true,
    size: 16,
    color: { argb: "FF111827" },
  };

  sheet.mergeCells(`A2:${lastColumn}2`);
  sheet.getCell("A2").value =
    `${input.data.period.label} | ${input.selectedSiteLabel}`;
  sheet.getCell("A2").font = { size: 11, color: { argb: "FF475569" } };

  sheet.addRow([]);
  sheet.addRow([
    "Total attendance days",
    input.data.summary.totalAttendance,
    "Average per day",
    input.data.summary.averagePerDay,
    "Best day",
    input.data.summary.bestDay
      ? formatDate(input.data.summary.bestDay.date)
      : "-",
    "Sites with attendance",
    input.data.summary.activeSiteCount,
  ]);
  sheet.addRow([]);

  const headerRow = sheet.addRow([
    "Site",
    ...input.data.days.map(
      (day) => `${formatDate(day.date)}\nTotal: ${day.total}`,
    ),
    "Total",
  ]);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.height = 34;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F8F87" },
    };
    cell.alignment = { vertical: "middle", wrapText: true };
  });

  input.rows.forEach((site) => {
    const row = sheet.addRow([
      `${siteRowLabel(site)}\n${supervisorLabel(site)}`,
      ...site.days.map(formatDayCell),
      site.total,
    ]);
    row.height = 30;
  });

  sheet.columns = [
    { width: 34 },
    ...input.data.days.map(() => ({ width: 16 })),
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
        horizontal: colNumber === 1 ? "left" : "right",
        wrapText: true,
      };
      if (rowNumber > 7 && rowNumber % 2 === 0) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8FAFC" },
        };
      }
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    buffer,
    `attendance-analytics-${safeFilePart(input.data.period.startISO)}.xlsx`,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}

async function exportAttendancePdf(input: {
  data: AnalyticsResponse;
  rows: SiteAnalyticsRow[];
  selectedSiteLabel: string;
}) {
  const { PDFDocument, PageSizes, StandardFonts, rgb } =
    await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = PageSizes.A4[1];
  const pageHeight = PageSizes.A4[0];
  const margin = 24;
  const tableWidth = pageWidth - margin * 2;
  const siteWidth = 140;
  const totalWidth = 44;
  const dayWidth =
    (tableWidth - siteWidth - totalWidth) / input.data.days.length;
  const rowHeight = 22;
  const headerHeight = 30;
  const ink = rgb(0.08, 0.1, 0.14);
  const muted = rgb(0.35, 0.42, 0.54);
  const border = rgb(0.84, 0.88, 0.92);
  const headerBg = rgb(0.06, 0.56, 0.53);
  const lightBg = rgb(0.96, 0.98, 0.99);

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
    drawText("Fortnight Attendance Report", margin, y - 2, 15, bold);
    drawText(
      `${input.data.period.label} | ${input.selectedSiteLabel}`,
      margin,
      y - 17,
      8.5,
      regular,
      muted,
    );
    drawText(
      `Total ${input.data.summary.totalAttendance} | Average ${input.data.summary.averagePerDay.toFixed(
        1,
      )} | Best ${input.data.summary.bestDay ? formatDate(input.data.summary.bestDay.date) : "-"} | Sites ${input.data.summary.activeSiteCount}`,
      margin,
      y - 31,
      8.5,
      regular,
      muted,
    );
    y -= 48;
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
      borderWidth: 0.5,
    });

    const columns = [
      { label: "Site", total: "", width: siteWidth, align: "left" as const },
      ...input.data.days.map((day) => ({
        label: formatDate(day.date),
        total: `Total: ${day.total}`,
        width: dayWidth,
        align: "right" as const,
      })),
      { label: "Total", total: "", width: totalWidth, align: "right" as const },
    ];

    columns.forEach((column) => {
      page.drawLine({
        start: { x, y },
        end: { x, y: y - headerHeight },
        thickness: 0.4,
        color: border,
      });
      const label = truncatePdfText(bold, column.label, column.width - 6, 6.6);
      const labelWidth = bold.widthOfTextAtSize(label, 6.6);
      const labelX =
        column.align === "right" ? x + column.width - labelWidth - 3 : x + 3;
      drawText(label, labelX, y - 13, 6.6, bold, rgb(1, 1, 1));
      if (column.total) {
        const total = truncatePdfText(
          regular,
          column.total,
          column.width - 6,
          5.8,
        );
        const totalWidthText = regular.widthOfTextAtSize(total, 5.8);
        drawText(
          total,
          x + column.width - totalWidthText - 3,
          y - 24,
          5.8,
          regular,
          rgb(0.85, 1, 0.98),
        );
      }
      x += column.width;
    });
    y -= headerHeight;
  }

  function ensureSpace() {
    if (y - rowHeight < margin + 16) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
      drawHeader();
      drawTableHeader();
    }
  }

  function drawCell(
    text: string,
    x: number,
    width: number,
    align: "left" | "right",
    isTotal = false,
  ) {
    const size = isTotal ? 6.7 : 6.2;
    const font = isTotal ? bold : regular;
    const value = truncatePdfText(font, text, width - 6, size);
    const textWidth = font.widthOfTextAtSize(value, size);
    drawText(
      value,
      align === "right" ? x + width - textWidth - 3 : x + 3,
      y - 12,
      size,
      font,
    );
  }

  function drawSiteCell(site: SiteAnalyticsRow, x: number, width: number) {
    const siteText = truncatePdfText(bold, siteRowLabel(site), width - 6, 6.4);
    const supervisorText = truncatePdfText(
      regular,
      supervisorLabel(site),
      width - 6,
      5.6,
    );

    drawText(siteText, x + 3, y - 9, 6.4, bold);
    drawText(supervisorText, x + 3, y - 17, 5.6, regular, muted);
  }

  function drawPercentBadge(value: number | null, x: number, yBadge: number) {
    const label = formatPercent(value);
    const isIncrease = value !== null && value > 0;
    const isDecrease = value !== null && value < 0;
    const fill = isIncrease
      ? rgb(1, 0.94, 0.94)
      : isDecrease
        ? rgb(0.91, 0.98, 0.95)
        : rgb(0.96, 0.98, 1);
    const stroke = isIncrease
      ? rgb(0.99, 0.8, 0.8)
      : isDecrease
        ? rgb(0.65, 0.9, 0.78)
        : rgb(0.82, 0.87, 0.93);
    const textColor = isIncrease
      ? rgb(0.73, 0.11, 0.11)
      : isDecrease
        ? rgb(0.04, 0.47, 0.33)
        : muted;
    const width = Math.max(18, regular.widthOfTextAtSize(label, 5.4) + 8);

    page.drawRectangle({
      x,
      y: yBadge,
      width,
      height: 9,
      color: fill,
      borderColor: stroke,
      borderWidth: 0.45,
    });
    drawText(label, x + 4, yBadge + 2.2, 5.4, bold, textColor);
    return width;
  }

  function drawDayCell(day: SiteDayRow, x: number, width: number) {
    const countText = String(day.total);
    const countTextWidth = regular.widthOfTextAtSize(countText, 6.2);
    drawText(countText, x + 3, y - 12, 6.2);

    const badgeLabel = formatPercent(day.percentChange);
    const badgeWidth = Math.max(
      18,
      regular.widthOfTextAtSize(badgeLabel, 5.4) + 8,
    );
    const badgeX = x + width - badgeWidth - 3;

    if (badgeX > x + countTextWidth + 5) {
      drawPercentBadge(day.percentChange, badgeX, y - 13.5);
      return;
    }

    drawPercentBadge(day.percentChange, x + width - badgeWidth - 3, y - 13.5);
  }

  function drawRow(site: SiteAnalyticsRow, index: number) {
    ensureSpace();
    let x = margin;
    page.drawRectangle({
      x,
      y: y - rowHeight,
      width: tableWidth,
      height: rowHeight,
      color: index % 2 === 0 ? rgb(1, 1, 1) : lightBg,
      borderColor: border,
      borderWidth: 0.35,
    });
    drawSiteCell(site, x, siteWidth);
    x += siteWidth;
    site.days.forEach((day) => {
      page.drawLine({
        start: { x, y },
        end: { x, y: y - rowHeight },
        thickness: 0.25,
        color: border,
      });
      drawDayCell(day, x, dayWidth);
      x += dayWidth;
    });
    page.drawLine({
      start: { x, y },
      end: { x, y: y - rowHeight },
      thickness: 0.25,
      color: border,
    });
    drawCell(String(site.total), x, totalWidth, "right", true);
    y -= rowHeight;
  }

  drawHeader();
  drawTableHeader();
  input.rows.forEach(drawRow);

  const pages = pdf.getPages();
  pages.forEach((pdfPage, index) => {
    const pageText = `Page ${index + 1} of ${pages.length}`;
    pdfPage.drawText(pageText, {
      x: pageWidth - margin - regular.widthOfTextAtSize(pageText, 7),
      y: 12,
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
    `attendance-analytics-${safeFilePart(input.data.period.startISO)}.pdf`,
    "application/pdf",
  );
}

function PercentBadge({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <Minus className="h-3 w-3" />
        New
      </Badge>
    );
  }

  if (value === 0) {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <Minus className="h-3 w-3" />
        0.0%
      </Badge>
    );
  }

  const isIncrease = value > 0;
  const Icon = isIncrease ? TrendingUp : TrendingDown;

  return (
    <Badge
      variant="outline"
      className={
        isIncrease
          ? "gap-1 border-red-200 bg-red-50 text-red-700"
          : "gap-1 border-emerald-200 bg-emerald-50 text-emerald-700"
      }
    >
      <Icon className="h-3 w-3" />
      {isIncrease ? "+" : ""}
      {value.toFixed(1)}%
    </Badge>
  );
}

export default function AdminAttendanceAnalyticsPage() {
  const current = currentFortnightSatFri();
  const [startISO, setStartISO] = useState(current.startISO);
  const [siteId, setSiteId] = useState("ALL");
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ start: startISO });
      if (siteId !== "ALL") params.set("siteId", siteId);

      const res = await fetch(`/api/admin/attendance-analytics?${params}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to load attendance analytics");
      }

      setData(await res.json());
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Failed to load attendance analytics"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startISO, siteId]);

  const siteRows = useMemo(() => {
    if (!data) return [];

    const grouped = new Map<
      string,
      {
        siteId: string;
        siteName: string;
        siteCode: string | null;
        supervisorName: string | null;
        total: number;
        days: SiteDayRow[];
      }
    >();

    for (const row of data.perSite) {
      if (!grouped.has(row.siteId)) {
        grouped.set(row.siteId, {
          siteId: row.siteId,
          siteName: row.siteName,
          siteCode: row.siteCode,
          supervisorName: row.supervisorName,
          total: 0,
          days: [],
        });
      }
      const group = grouped.get(row.siteId)!;
      group.total += row.total;
      group.days.push(row);
    }

    return Array.from(grouped.values()).sort((a, b) => b.total - a.total);
  }, [data]);

  const pageCount = Math.max(1, Math.ceil(siteRows.length / pageSize));
  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  const pagedSiteRows = siteRows.slice(
    safePageIndex * pageSize,
    safePageIndex * pageSize + pageSize,
  );
  const canPreviousPage = safePageIndex > 0;
  const canNextPage = safePageIndex < pageCount - 1;
  const showingFrom = siteRows.length === 0 ? 0 : safePageIndex * pageSize + 1;
  const showingTo = Math.min(
    safePageIndex * pageSize + pageSize,
    siteRows.length,
  );

  useEffect(() => {
    setPageIndex(0);
  }, [siteRows.length, pageSize]);

  const bestDayLabel = data?.summary.bestDay
    ? formatDate(data.summary.bestDay.date)
    : "-";
  const selectedSite =
    siteId === "ALL" ? null : data?.sites.find((site) => site.id === siteId);
  const selectedSiteLabel =
    siteId === "ALL"
      ? "All sites"
      : selectedSite
        ? siteRowLabel({
            siteName: selectedSite.name,
            siteCode: selectedSite.code,
          })
        : "Selected site";

  async function handleExcelDownload() {
    if (!data || siteRows.length === 0) return;
    setExporting("excel");
    try {
      await exportAttendanceExcel({ data, rows: siteRows, selectedSiteLabel });
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Failed to export Excel"));
    } finally {
      setExporting(null);
    }
  }

  async function handlePdfDownload() {
    if (!data || siteRows.length === 0) return;
    setExporting("pdf");
    try {
      await exportAttendancePdf({ data, rows: siteRows, selectedSiteLabel });
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Failed to export PDF"));
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-4 px-4 pb-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Fortnight Attendance Report
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Daily attendance movement and per-site totals for the selected
            fortnight.
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
              className="w-[164px] pl-9"
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
            onClick={loadAnalytics}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={siteId} onValueChange={setSiteId}>
          <SelectTrigger className="w-full sm:w-[280px]">
            <SelectValue placeholder="All sites" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All sites</SelectItem>
            {(data?.sites ?? []).map((site) => (
              <SelectItem key={site.id} value={site.id}>
                {site.code ? `${site.code} - ${site.name}` : site.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {data ? (
          <Badge variant="outline" className="h-9 px-3">
            {data.period.label}
          </Badge>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 px-2.5"
            onClick={handlePdfDownload}
            disabled={!data || siteRows.length === 0 || exporting !== null}
          >
            {exporting === "pdf" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 px-2.5"
            onClick={handleExcelDownload}
            disabled={!data || siteRows.length === 0 || exporting !== null}
          >
            {exporting === "excel" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-3.5 w-3.5" />
            )}
            Excel
          </Button>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex min-h-[280px] items-center justify-center rounded border bg-card">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading attendance analytics
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <Card className="gap-3 py-4">
              <CardHeader className="px-4">
                <CardTitle className="text-sm text-muted-foreground">
                  Total attendance days
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 text-2xl font-semibold">
                {data.summary.totalAttendance}
              </CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="px-4">
                <CardTitle className="text-sm text-muted-foreground">
                  Average per day
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 text-2xl font-semibold">
                {data.summary.averagePerDay.toFixed(1)}
              </CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="px-4">
                <CardTitle className="text-sm text-muted-foreground">
                  Best day
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 text-2xl font-semibold">
                {bestDayLabel}
              </CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="px-4">
                <CardTitle className="text-sm text-muted-foreground">
                  Sites with attendance
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 text-2xl font-semibold">
                {data.summary.activeSiteCount}
              </CardContent>
            </Card>
          </div>

          <div className="overflow-x-auto rounded border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[220px] bg-primary text-primary-foreground">
                    Site
                  </TableHead>
                  {data.days.map((day) => (
                    <TableHead
                      key={day.date}
                      className="min-w-[118px] bg-primary text-primary-foreground"
                    >
                      <div className="space-y-1">
                        <div>{formatDate(day.date)}</div>
                        <div className="text-xs font-semibold text-primary-foreground/80">
                          Total: {day.total}
                        </div>
                      </div>
                    </TableHead>
                  ))}
                  <TableHead className="bg-primary text-right text-primary-foreground">
                    Total
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedSiteRows.length ? (
                  pagedSiteRows.map((site) => (
                    <TableRow key={site.siteId}>
                      <TableCell className="font-medium">
                        <div className="space-y-0.5">
                          <div>{siteRowLabel(site)}</div>
                          <div className="text-xs font-normal text-muted-foreground">
                            {supervisorLabel(site)}
                          </div>
                        </div>
                      </TableCell>
                      {site.days.map((day) => (
                        <TableCell key={`${site.siteId}-${day.date}`}>
                          <div className="flex min-w-[96px] items-center justify-between gap-2">
                            <span className="tabular-nums">{day.total}</span>
                            <PercentBadge value={day.percentChange} />
                          </div>
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-semibold tabular-nums">
                        {site.total}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={data.days.length + 2}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No attendance scans found for this fortnight.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between border-t bg-muted/60 px-4 py-3">
              <div className="hidden text-sm text-muted-foreground lg:flex">
                Showing {showingFrom} to {showingTo} of {siteRows.length} sites
              </div>
              <div className="flex w-full items-center gap-4 lg:w-fit lg:gap-8">
                <div className="hidden items-center gap-2 lg:flex">
                  <span className="text-sm font-medium">Rows per page</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(value) => setPageSize(Number(value))}
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
                    type="button"
                    variant="outline"
                    size="icon"
                    className="hidden h-8 w-8 lg:flex"
                    onClick={() => setPageIndex(0)}
                    disabled={!canPreviousPage}
                  >
                    <span className="sr-only">Go to first page</span>
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      setPageIndex((value) => Math.max(0, value - 1))
                    }
                    disabled={!canPreviousPage}
                  >
                    <span className="sr-only">Go to previous page</span>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      setPageIndex((value) =>
                        Math.min(pageCount - 1, value + 1),
                      )
                    }
                    disabled={!canNextPage}
                  >
                    <span className="sr-only">Go to next page</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="hidden h-8 w-8 lg:flex"
                    onClick={() => setPageIndex(pageCount - 1)}
                    disabled={!canNextPage}
                  >
                    <span className="sr-only">Go to last page</span>
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
