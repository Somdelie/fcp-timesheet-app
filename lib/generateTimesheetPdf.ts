import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFPage,
  type PDFFont,
} from "pdf-lib";
import type { TimesheetGridModel } from "@/lib/timesheets/gridModel";

function formatCurrency(amount: number): string {
  return `R${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function truncateText(
  text: string,
  maxWidth: number,
  font: PDFFont,
  fontSize: number,
): string {
  let t = text;
  while (t.length > 0 && font.widthOfTextAtSize(t, fontSize) > maxWidth) {
    t = t.slice(0, -1);
  }
  if (t !== text && t.length > 0) {
    t = t.slice(0, Math.max(0, t.length - 1)) + "...";
  }
  return t;
}

// Web-matched color palette from your Tailwind theme
const colors = {
  // Background colors - match your web table
  white: rgb(1, 1, 1),
  cardBg: rgb(0.996, 0.996, 0.996),
  headerBg: rgb(0.02, 0.47, 0.76), // sky-600 (header)
  headerBgLight: rgb(0.94, 0.97, 1), // sky-50/60

  // Row backgrounds - match web row alternation
  foremanRowBg: rgb(0.94, 0.97, 1), // sky-50/70 for foreman
  evenRowBg: rgb(0.996, 0.996, 0.996), // white/off-white for even
  oddRowBg: rgb(1, 1, 1), // pure white for odd

  // Summary column backgrounds - match web amber/emerald sections
  amberBg: rgb(1, 0.98, 0.92), // amber-50/70
  emeraldBg: rgb(0.94, 0.99, 0.96), // emerald-50/70
  totalRowBg: rgb(0.02, 0.47, 0.76), // sky-600/70 for totals

  // Day cell colors - match web present/absent
  presentBg: rgb(0.13, 0.72, 0.53), // emerald-500 (green checkmark)
  absentBg: rgb(0.95, 0.87, 0.87), // rose-500/20 (red X)

  // Border colors - subtle gray lines matching web
  border: rgb(0.6, 0.6, 0.65),
  borderLight: rgb(0.8, 0.8, 0.82),

  // Text colors - match web text hierarchy
  textWhite: rgb(1, 1, 1),
  textPrimary: rgb(0.09, 0.09, 0.11), // zinc-900
  textSecondary: rgb(0.4, 0.4, 0.45), // muted-foreground
  textMuted: rgb(0.6, 0.6, 0.65),
  rose600: rgb(0.88, 0.28, 0.33), // for zero values in red
};

export interface TimesheetPdfMetadata {
  foremanName?: string;
  supervisorName?: string;
  siteName?: string;
  siteCode?: string;
  startISO?: string;
  endISO?: string;
  status?: string;
}

export async function generateTimesheetPdf(
  model: TimesheetGridModel,
  metadata?: TimesheetPdfMetadata,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // A4 Landscape
  const pageWidth = 841.89;
  const pageHeight = 595.28;
  const margin = 24;

  const columns = model.columns || [];
  const rows = model.rows || [];
  const totals = model.totals;
  const foremanName = model.foremanName || metadata?.foremanName || "";

  // Dynamic column widths based on number of days
  const nameColWidth = 140;
  const dayColWidth = Math.min(
    45,
    (pageWidth - margin * 2 - nameColWidth - 280) / Math.max(columns.length, 1),
  );
  const summaryColWidths = {
    fmanDays: 60,
    manDays: 60,
    fmanPay: 80,
    teamPay: 80,
  };

  const headerHeight = 40;
  const subHeaderHeight = 28;
  const rowHeight = 26;
  const fontSize = 9;
  const headerFontSize = 10;

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // ============ TITLE SECTION ============
  const title = "Timesheet Report";
  page.drawText(title, {
    x: margin,
    y: y - 18,
    size: 18,
    font: fontBold,
    color: colors.textPrimary,
  });

  // ============ METADATA ROW ============
  const metaY = y - 36;
  let metaX = margin;

  if (metadata?.startISO && metadata?.endISO) {
    const range = `${metadata.startISO} to ${metadata.endISO}`;
    page.drawText(`Period: ${range}`, {
      x: metaX,
      y: metaY,
      size: 9,
      font: font,
      color: colors.textSecondary,
    });
    metaX += 180;
  }

  if (foremanName) {
    page.drawText(`Foreman: ${foremanName}`, {
      x: metaX,
      y: metaY,
      size: 9,
      font: font,
      color: colors.textSecondary,
    });
    metaX += 150;
  }

  if (metadata?.supervisorName) {
    page.drawText(`Supervisor: ${metadata.supervisorName}`, {
      x: metaX,
      y: metaY,
      size: 9,
      font: font,
      color: colors.textSecondary,
    });
    metaX += 150;
  }

  if (metadata?.siteName || metadata?.siteCode) {
    const siteLabel = metadata.siteCode
      ? `${metadata.siteCode} · ${metadata.siteName || ""}`
      : metadata.siteName || "";
    page.drawText(`Site: ${siteLabel}`, {
      x: metaX,
      y: metaY,
      size: 9,
      font: font,
      color: colors.textSecondary,
    });
  }

  if (metadata?.status) {
    page.drawText(`Status: ${metadata.status}`, {
      x: pageWidth - margin - 100,
      y: metaY,
      size: 9,
      font: fontBold,
      color: colors.textPrimary,
    });
  }

  y -= 56;

  // Calculate table width
  const tableWidth =
    nameColWidth +
    columns.length * dayColWidth +
    summaryColWidths.fmanDays +
    summaryColWidths.manDays +
    summaryColWidths.fmanPay +
    summaryColWidths.teamPay;
  let tableStartY = 0;

  function drawTableHeader(pg: PDFPage, startY: number): number {
    tableStartY = startY;

    // Main header row (sky-600 background) - matching web header
    pg.drawRectangle({
      x: margin,
      y: startY - headerHeight,
      width: tableWidth,
      height: headerHeight,
      color: colors.headerBg,
    });

    // Header border
    pg.drawLine({
      start: { x: margin, y: startY },
      end: { x: margin + tableWidth, y: startY },
      thickness: 2,
      color: colors.border,
    });

    let xPos = margin;
    const textY = startY - headerHeight / 2 - 4;

    // Full Name header
    pg.drawText("Full Name", {
      x: xPos + 8,
      y: textY,
      size: headerFontSize,
      font: fontBold,
      color: colors.textWhite,
    });
    xPos += nameColWidth;

    // Day columns with proper centering
    for (const col of columns) {
      // Draw vertical line before each day column
      pg.drawLine({
        start: { x: xPos, y: startY },
        end: { x: xPos, y: startY - headerHeight },
        thickness: 1,
        color: colors.borderLight,
      });

      const dayText = col.dayLabel || "";
      const dateText = col.dateLabel || "";

      pg.drawText(dayText, {
        x: xPos + dayColWidth / 2 - font.widthOfTextAtSize(dayText, 8) / 2,
        y: textY + 6,
        size: 8,
        font: fontBold,
        color: colors.textWhite,
      });
      pg.drawText(dateText, {
        x: xPos + dayColWidth / 2 - font.widthOfTextAtSize(dateText, 7) / 2,
        y: textY - 4,
        size: 7,
        font: font,
        color: rgb(0.85, 0.9, 1),
      });
      xPos += dayColWidth;
    }

    // Summary headers with amber/emerald backgrounds (matching web)
    const summaryHeaders = [
      {
        label: "F/man Days",
        width: summaryColWidths.fmanDays,
        bg: colors.amberBg,
      },
      {
        label: "Man/Days",
        width: summaryColWidths.manDays,
        bg: colors.amberBg,
      },
      {
        label: "F/man Pay",
        width: summaryColWidths.fmanPay,
        bg: colors.emeraldBg,
      },
      {
        label: "Team Pay",
        width: summaryColWidths.teamPay,
        bg: colors.emeraldBg,
      },
    ];

    for (const h of summaryHeaders) {
      pg.drawLine({
        start: { x: xPos, y: startY },
        end: { x: xPos, y: startY - headerHeight },
        thickness: 1,
        color: colors.border,
      });

      // Light background for summary headers
      pg.drawRectangle({
        x: xPos,
        y: startY - headerHeight,
        width: h.width,
        height: headerHeight,
        color: h.bg,
      });

      const headerText = truncateText(h.label, h.width - 8, fontBold, 8);
      pg.drawText(headerText, {
        x: xPos + h.width / 2 - fontBold.widthOfTextAtSize(headerText, 8) / 2,
        y: textY,
        size: 8,
        font: fontBold,
        color: colors.textPrimary,
      });
      xPos += h.width;
    }

    // Bottom border of header
    pg.drawLine({
      start: { x: margin, y: startY - headerHeight },
      end: { x: margin + tableWidth, y: startY - headerHeight },
      thickness: 2,
      color: colors.border,
    });

    return startY - headerHeight;
  }

  function drawRow(
    pg: PDFPage,
    row: (typeof rows)[0],
    startY: number,
    isEven: boolean,
  ): number {
    const rowY = startY - rowHeight;
    const isForeman =
      row.isForeman || (foremanName && row.label.trim() === foremanName.trim());

    // Row background - match web alternation
    const rowBg = isForeman
      ? colors.foremanRowBg
      : isEven
        ? colors.evenRowBg
        : colors.oddRowBg;

    pg.drawRectangle({
      x: margin,
      y: rowY,
      width: tableWidth,
      height: rowHeight,
      color: rowBg,
    });

    let xPos = margin;
    const textY = rowY + rowHeight / 2 - 3;

    // Name column - with foreman indicator (👨‍💼 emoji equivalent)
    const nameLabel = isForeman ? `[F] ${row.label}` : row.label;
    const nameText = truncateText(
      nameLabel,
      nameColWidth - 12,
      isForeman ? fontBold : font,
      fontSize,
    );
    pg.drawText(nameText, {
      x: xPos + 8,
      y: textY,
      size: fontSize,
      font: isForeman ? fontBold : font,
      color: colors.textPrimary,
    });

    // Vertical border after name
    pg.drawLine({
      start: { x: xPos + nameColWidth, y: startY },
      end: { x: xPos + nameColWidth, y: rowY },
      thickness: 1,
      color: colors.borderLight,
    });
    xPos += nameColWidth;

    // Day cells - present (green) / absent (red)
    for (let i = 0; i < columns.length; i++) {
      const present = row.present?.[i] ?? false;

      // Cell background for present/absent
      pg.drawRectangle({
        x: xPos,
        y: rowY,
        width: dayColWidth,
        height: rowHeight,
        color: present ? colors.presentBg : colors.absentBg,
      });

      // Y for present, X for absent
      const symbol = present ? "Y" : "X";
      const symbolColor = present ? colors.textWhite : colors.rose600;
      pg.drawText(symbol, {
        x: xPos + dayColWidth / 2 - 4,
        y: textY,
        size: 11,
        font: fontBold,
        color: symbolColor,
      });

      // Vertical border
      pg.drawLine({
        start: { x: xPos + dayColWidth, y: startY },
        end: { x: xPos + dayColWidth, y: rowY },
        thickness: 0.5,
        color: colors.borderLight,
      });
      xPos += dayColWidth;
    }

    // Summary cells - separate foreman/team totals
    const foremanDays = isForeman ? row.daysWorked : 0;
    const teamDays = isForeman ? 0 : row.daysWorked;
    const foremanPay = isForeman ? row.pay : 0;
    const teamPay = isForeman ? 0 : row.pay;

    const summaryCells = [
      {
        value: foremanDays.toString(),
        width: summaryColWidths.fmanDays,
        isZero: foremanDays === 0,
      },
      {
        value: teamDays.toString(),
        width: summaryColWidths.manDays,
        isZero: teamDays === 0,
      },
      {
        value: foremanPay > 0 ? formatCurrency(foremanPay) : "0",
        width: summaryColWidths.fmanPay,
        isZero: foremanPay === 0,
      },
      {
        value: teamPay > 0 ? formatCurrency(teamPay) : "0",
        width: summaryColWidths.teamPay,
        isZero: teamPay === 0,
      },
    ];

    for (const cell of summaryCells) {
      // Sky-blue background for summary columns (matching web)
      pg.drawRectangle({
        x: xPos,
        y: rowY,
        width: cell.width,
        height: rowHeight,
        color: rgb(0.02, 0.47, 0.76),
        opacity: 0.7,
      });

      const cellText = truncateText(
        cell.value,
        cell.width - 8,
        fontBold,
        fontSize - 1,
      );

      // Zero values display in rose/red, non-zero in white
      const textColor = cell.isZero ? colors.rose600 : colors.textWhite;

      pg.drawText(cellText, {
        x:
          xPos +
          cell.width / 2 -
          fontBold.widthOfTextAtSize(cellText, fontSize - 1) / 2,
        y: textY,
        size: fontSize - 1,
        font: fontBold,
        color: textColor,
      });

      // Vertical border
      pg.drawLine({
        start: { x: xPos + cell.width, y: startY },
        end: { x: xPos + cell.width, y: rowY },
        thickness: 1,
        color: colors.borderLight,
      });
      xPos += cell.width;
    }

    // Row bottom border
    pg.drawLine({
      start: { x: margin, y: rowY },
      end: { x: margin + tableWidth, y: rowY },
      thickness: 1,
      color: colors.borderLight,
    });

    return rowY;
  }

  function drawTotalRow(pg: PDFPage, startY: number): number {
    const rowY = startY - rowHeight;

    // Total row background - dark sky-600 (matching web)
    pg.drawRectangle({
      x: margin,
      y: rowY,
      width: tableWidth,
      height: rowHeight,
      color: colors.totalRowBg,
      opacity: 0.7,
    });

    let xPos = margin;
    const textY = rowY + rowHeight / 2 - 3;

    // TOTAL label
    pg.drawText("TOTAL", {
      x: xPos + 8,
      y: textY,
      size: fontSize,
      font: fontBold,
      color: colors.textPrimary,
    });
    xPos += nameColWidth;

    // Empty day cells
    for (const _ of columns) {
      pg.drawRectangle({
        x: xPos,
        y: rowY,
        width: dayColWidth,
        height: rowHeight,
        color: rgb(0.02, 0.51, 0.8),
        opacity: 0.7,
      });
      xPos += dayColWidth;
    }

    // Total summary cells
    const totalCells = [
      {
        value: (totals?.foremanDays ?? 0).toString(),
        width: summaryColWidths.fmanDays,
      },
      {
        value: (totals?.teamDays ?? 0).toString(),
        width: summaryColWidths.manDays,
      },
      {
        value: formatCurrency(totals?.foremanPay ?? 0),
        width: summaryColWidths.fmanPay,
      },
      {
        value: formatCurrency(totals?.teamPay ?? 0),
        width: summaryColWidths.teamPay,
      },
    ];

    for (const cell of totalCells) {
      // Vertical border
      pg.drawLine({
        start: { x: xPos, y: startY },
        end: { x: xPos, y: rowY },
        thickness: 1,
        color: colors.border,
      });

      const cellText = truncateText(
        cell.value,
        cell.width - 8,
        fontBold,
        fontSize,
      );
      pg.drawText(cellText, {
        x:
          xPos +
          cell.width / 2 -
          fontBold.widthOfTextAtSize(cellText, fontSize) / 2,
        y: textY,
        size: fontSize,
        font: fontBold,
        color: colors.textWhite,
      });
      xPos += cell.width;
    }

    // Bottom border
    pg.drawLine({
      start: { x: margin, y: rowY },
      end: { x: margin + tableWidth, y: rowY },
      thickness: 2,
      color: colors.border,
    });

    return rowY;
  }

  function drawTableBorders(pg: PDFPage, topY: number, bottomY: number) {
    // Left border
    pg.drawLine({
      start: { x: margin, y: topY },
      end: { x: margin, y: bottomY },
      thickness: 2,
      color: colors.border,
    });
    // Right border
    pg.drawLine({
      start: { x: margin + tableWidth, y: topY },
      end: { x: margin + tableWidth, y: bottomY },
      thickness: 2,
      color: colors.border,
    });
  }

  // Sort rows: foreman first, then alphabetically (matching web grid)
  const sortedRows = [...rows].sort((a, b) => {
    const aF =
      a.isForeman || (foremanName && a.label.trim() === foremanName.trim())
        ? 0
        : 1;
    const bF =
      b.isForeman || (foremanName && b.label.trim() === foremanName.trim())
        ? 0
        : 1;
    if (aF !== bF) return aF - bF;
    return a.label.localeCompare(b.label);
  });

  // Draw header
  y = drawTableHeader(page, y);
  let currentPageTableTop = tableStartY;
  let rowIndex = 0;

  // Draw rows
  for (const row of sortedRows) {
    if (y - rowHeight < margin + 40) {
      drawTableBorders(page, currentPageTableTop, y);
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
      y = drawTableHeader(page, y);
      currentPageTableTop = tableStartY;
    }

    y = drawRow(page, row, y, rowIndex % 2 === 0);
    rowIndex++;
  }

  // Draw total row
  if (y - rowHeight < margin + 40) {
    drawTableBorders(page, currentPageTableTop, y);
    page = pdf.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
    y = drawTableHeader(page, y);
    currentPageTableTop = tableStartY;
  }
  y = drawTotalRow(page, y);

  // Draw final borders
  drawTableBorders(page, currentPageTableTop, y);

  // Calculate total amount to be paid to the foreman (foreman pay + team pay)
  const totalAmountToBePaid =
    (totals?.foremanPay ?? 0) + (totals?.teamPay ?? 0);

  // Footer summary - total amount to be paid to foreman
  const summaryY = y - 20;
  const summaryText = `Total amount to be paid to ${foremanName || "Foreman"}: ${formatCurrency(totalAmountToBePaid)}`;
  page.drawText(summaryText, {
    x: margin,
    y: summaryY,
    size: 10,
    font: fontBold,
    color: colors.textPrimary,
  });

  // Footer legend (matching web description)
  const legendY = summaryY - 16;
  page.drawText("Y = Present (scanned that day)  •  X = Absent (no scan)", {
    x: margin,
    y: legendY,
    size: 8,
    font: font,
    color: colors.textMuted,
  });

  // Page numbers
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawText(`Page ${i + 1} of ${pages.length}`, {
      x: pageWidth - margin - 60,
      y: 16,
      size: 8,
      font: font,
      color: colors.textMuted,
    });
  });

  pdf.setTitle("Timesheet Report");
  pdf.setCreator("Office App");
  pdf.setProducer("pdf-lib");

  return pdf.save();
}

export function downloadTimesheetPdf(pdfBytes: Uint8Array, filename: string) {
  try {
    // Use a copy of the buffer to ensure compatibility
    const blob = new Blob([pdfBytes.slice().buffer], {
      type: "application/pdf",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("PDF download failed:", err);
    // Optionally, fallback to opening in a new window
    try {
      const blob = new Blob([pdfBytes.slice().buffer], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (e) {
      console.error("All PDF download methods failed:", e);
      throw new Error(
        "Unable to download PDF. Please check your browser settings.",
      );
    }
  }
}
