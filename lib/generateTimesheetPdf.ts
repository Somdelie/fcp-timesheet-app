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

// Web-matched color palette from your Tailwind theme (zinc scheme)
const colors = {
  // Background colors - match your web table
  white: rgb(1, 1, 1),
  cardBg: rgb(0.996, 0.996, 0.996),
  headerBg: rgb(0.32, 0.32, 0.35), // zinc-600 (header)
  headerBgLight: rgb(0.95, 0.95, 0.96), // zinc-100/60

  // Row backgrounds - match web row alternation
  foremanRowBg: rgb(0.9, 0.9, 0.91), // zinc-200/70 for foreman
  evenRowBg: rgb(0.996, 0.996, 0.996), // white/off-white for even
  oddRowBg: rgb(1, 1, 1), // pure white for odd

  // Summary column backgrounds - match web zinc scheme
  amberBg: rgb(1, 0.98, 0.92), // amber-50/70 (header only)
  emeraldBg: rgb(0.94, 0.99, 0.96), // emerald-50/70 (header only)
  summaryBg: rgb(0.78, 0.78, 0.8), // zinc-300/70 for summary cells
  totalRowBg: rgb(0.7, 0.7, 0.72), // zinc-400/70 for totals

  // Day cell colors - match web present/absent
  presentBg: rgb(0.13, 0.72, 0.53), // emerald-500 (green checkmark)
  absentBg: rgb(0.95, 0.87, 0.87), // rose-500/20 (red X)

  // Border colors - visible gray lines matching web
  border: rgb(0.4, 0.4, 0.45),
  borderLight: rgb(0.55, 0.55, 0.6),

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

  // Calculate table width (needed for meta cards and table)
  const tableWidth =
    nameColWidth +
    columns.length * dayColWidth +
    summaryColWidths.fmanDays +
    summaryColWidths.manDays +
    summaryColWidths.fmanPay +
    summaryColWidths.teamPay;

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // ============ TITLE SECTION ============
  const title = "Timesheet Report";
  page.drawText(title, {
    x: margin,
    y: y - 18,
    size: 20,
    font: fontBold,
    color: colors.textPrimary,
  });

  // Subtitle with date range
  if (metadata?.startISO && metadata?.endISO) {
    page.drawText(`${metadata.startISO} to ${metadata.endISO}`, {
      x: margin,
      y: y - 36,
      size: 11,
      font: font,
      color: colors.textSecondary,
    });
  }

  y -= 60;

  // ============ META CARDS (matching print HTML) ============
  const cardHeight = 44;
  const cardPadding = 10;
  const cardGap = 10;

  // Calculate number of cards and their widths
  const metaItems: Array<{ label: string; value: string }> = [];
  if (foremanName) metaItems.push({ label: "FOREMAN", value: foremanName });
  if (metadata?.supervisorName)
    metaItems.push({ label: "MANAGER", value: metadata.supervisorName });
  if (metadata?.siteName || metadata?.siteCode) {
    const siteLabel = metadata.siteCode
      ? `${metadata.siteCode} - ${metadata.siteName || ""}`
      : metadata.siteName || "";
    metaItems.push({ label: "SITES", value: siteLabel });
  }
  if (metadata?.status)
    metaItems.push({ label: "STATUS", value: metadata.status });

  if (metaItems.length > 0) {
    const totalGaps = (metaItems.length - 1) * cardGap;
    const availableWidth = tableWidth - totalGaps;
    const cardWidth = availableWidth / metaItems.length;

    let cardX = margin;
    for (const item of metaItems) {
      // Card background
      page.drawRectangle({
        x: cardX,
        y: y - cardHeight,
        width: cardWidth,
        height: cardHeight,
        color: colors.white,
        borderColor: colors.borderLight,
        borderWidth: 1,
      });

      // Label
      page.drawText(item.label, {
        x: cardX + cardPadding,
        y: y - 14,
        size: 9,
        font: fontBold,
        color: colors.textSecondary,
      });

      // Value
      const valueText = truncateText(
        item.value,
        cardWidth - cardPadding * 2,
        fontBold,
        11,
      );
      page.drawText(valueText, {
        x: cardX + cardPadding,
        y: y - 32,
        size: 11,
        font: fontBold,
        color: colors.textPrimary,
      });

      cardX += cardWidth + cardGap;
    }

    y -= cardHeight + 16;
  }

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
        color: colors.border,
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
      thickness: 1.5,
      color: colors.border,
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

      if (present) {
        // Draw checkmark for present (✓ shape)
        const cx = xPos + dayColWidth / 2;
        const cy = rowY + rowHeight / 2;
        // Checkmark lines
        pg.drawLine({
          start: { x: cx - 6, y: cy },
          end: { x: cx - 2, y: cy - 4 },
          thickness: 2,
          color: colors.textWhite,
        });
        pg.drawLine({
          start: { x: cx - 2, y: cy - 4 },
          end: { x: cx + 6, y: cy + 5 },
          thickness: 2,
          color: colors.textWhite,
        });
      } else {
        // Draw diagonal line for absent (strikethrough)
        pg.drawLine({
          start: { x: xPos + dayColWidth - 4, y: rowY + rowHeight - 4 },
          end: { x: xPos + 4, y: rowY + 4 },
          thickness: 2,
          color: colors.rose600,
        });
      }

      // Vertical border
      pg.drawLine({
        start: { x: xPos + dayColWidth, y: startY },
        end: { x: xPos + dayColWidth, y: rowY },
        thickness: 1,
        color: colors.border,
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
      // Zinc background for summary columns (matching web)
      pg.drawRectangle({
        x: xPos,
        y: rowY,
        width: cell.width,
        height: rowHeight,
        color: colors.summaryBg,
      });

      const cellText = truncateText(
        cell.value,
        cell.width - 8,
        fontBold,
        fontSize - 1,
      );

      // Zero values display in rose/red, non-zero in dark text
      const textColor = cell.isZero ? colors.rose600 : colors.textPrimary;

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
        thickness: 1.5,
        color: colors.border,
      });
      xPos += cell.width;
    }

    // Row bottom border
    pg.drawLine({
      start: { x: margin, y: rowY },
      end: { x: margin + tableWidth, y: rowY },
      thickness: 1,
      color: colors.border,
    });

    return rowY;
  }

  function drawTotalRow(pg: PDFPage, startY: number): number {
    const rowY = startY - rowHeight;

    // Thick top border for total row
    pg.drawLine({
      start: { x: margin, y: startY },
      end: { x: margin + tableWidth, y: startY },
      thickness: 2.5,
      color: colors.border,
    });

    // Total row background - zinc-400/70 (matching web)
    pg.drawRectangle({
      x: margin,
      y: rowY,
      width: tableWidth,
      height: rowHeight,
      color: colors.totalRowBg,
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
        color: colors.totalRowBg,
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
        thickness: 1.5,
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
        color: colors.textPrimary,
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

  // Legend row (matching print HTML)
  const legendY = y - 18;
  page.drawText("Y = Present (scanned that day)  |  X = Absent (no scan)", {
    x: margin,
    y: legendY,
    size: 9,
    font: font,
    color: colors.textMuted,
  });

  // ============ THREE SUMMARY CARDS (matching print HTML) ============
  const summaryCardStartY = legendY - 30;
  const summaryCardWidth = (tableWidth - 24) / 3;
  const summaryCardHeight = 60;
  const summaryCardGap = 12;

  // Card 1: FOREMAN
  const card1X = margin;
  page.drawRectangle({
    x: card1X,
    y: summaryCardStartY - summaryCardHeight,
    width: summaryCardWidth,
    height: summaryCardHeight,
    color: colors.white,
    borderColor: colors.borderLight,
    borderWidth: 1,
  });
  page.drawText("FOREMAN", {
    x: card1X + 12,
    y: summaryCardStartY - 16,
    size: 9,
    font: fontBold,
    color: colors.textSecondary,
  });
  page.drawText("Days", {
    x: card1X + 12,
    y: summaryCardStartY - 32,
    size: 9,
    font: font,
    color: colors.textSecondary,
  });
  page.drawText((totals?.foremanDays ?? 0).toString(), {
    x: card1X + summaryCardWidth - 50,
    y: summaryCardStartY - 32,
    size: 11,
    font: fontBold,
    color: colors.textPrimary,
  });
  page.drawText("Pay", {
    x: card1X + 12,
    y: summaryCardStartY - 48,
    size: 9,
    font: font,
    color: colors.textSecondary,
  });
  page.drawText(formatCurrency(totals?.foremanPay ?? 0), {
    x: card1X + summaryCardWidth - 80,
    y: summaryCardStartY - 48,
    size: 11,
    font: fontBold,
    color: colors.textPrimary,
  });

  // Card 2: TEAM
  const card2X = card1X + summaryCardWidth + summaryCardGap;
  page.drawRectangle({
    x: card2X,
    y: summaryCardStartY - summaryCardHeight,
    width: summaryCardWidth,
    height: summaryCardHeight,
    color: colors.white,
    borderColor: colors.borderLight,
    borderWidth: 1,
  });
  page.drawText("TEAM", {
    x: card2X + 12,
    y: summaryCardStartY - 16,
    size: 9,
    font: fontBold,
    color: colors.textSecondary,
  });
  page.drawText("Days", {
    x: card2X + 12,
    y: summaryCardStartY - 32,
    size: 9,
    font: font,
    color: colors.textSecondary,
  });
  page.drawText((totals?.teamDays ?? 0).toString(), {
    x: card2X + summaryCardWidth - 50,
    y: summaryCardStartY - 32,
    size: 11,
    font: fontBold,
    color: colors.textPrimary,
  });
  page.drawText("Pay", {
    x: card2X + 12,
    y: summaryCardStartY - 48,
    size: 9,
    font: font,
    color: colors.textSecondary,
  });
  page.drawText(formatCurrency(totals?.teamPay ?? 0), {
    x: card2X + summaryCardWidth - 80,
    y: summaryCardStartY - 48,
    size: 11,
    font: fontBold,
    color: colors.textPrimary,
  });

  // Card 3: GRAND TOTAL (dark background)
  const card3X = card2X + summaryCardWidth + summaryCardGap;
  page.drawRectangle({
    x: card3X,
    y: summaryCardStartY - summaryCardHeight,
    width: summaryCardWidth,
    height: summaryCardHeight,
    color: rgb(0.09, 0.09, 0.11), // zinc-900
    borderColor: rgb(0.09, 0.09, 0.11),
    borderWidth: 1,
  });
  page.drawText("GRAND TOTAL", {
    x: card3X + 12,
    y: summaryCardStartY - 16,
    size: 9,
    font: fontBold,
    color: colors.textWhite,
  });
  page.drawText("Days", {
    x: card3X + 12,
    y: summaryCardStartY - 32,
    size: 9,
    font: font,
    color: rgb(0.7, 0.7, 0.7),
  });
  page.drawText((totals?.totalDays ?? 0).toString(), {
    x: card3X + summaryCardWidth - 50,
    y: summaryCardStartY - 32,
    size: 11,
    font: fontBold,
    color: colors.textWhite,
  });
  page.drawText("Pay", {
    x: card3X + 12,
    y: summaryCardStartY - 48,
    size: 9,
    font: font,
    color: rgb(0.7, 0.7, 0.7),
  });
  page.drawText(formatCurrency(totals?.totalPay ?? 0), {
    x: card3X + summaryCardWidth - 80,
    y: summaryCardStartY - 48,
    size: 11,
    font: fontBold,
    color: colors.textWhite,
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

// ============ HTML PRINT FUNCTIONS (matching desktop app) ============

export interface TimesheetPrintMeta {
  foremanName?: string;
  contractManagerName?: string;
  startDate?: string;
  endDate?: string;
  sites?: Array<{ code?: string; name?: string }>;
  status?: string;
  // Optional financial extras for print view
  overtimeTotal?: number;
  deductionsTotal?: number;
  netTotal?: number;
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Generate printable HTML for timesheet (matching desktop app)
 */
export function generateTimesheetPrintHTML(
  model: TimesheetGridModel,
  meta?: TimesheetPrintMeta,
): string {
  const formatCurrencyHtml = (n: number) =>
    `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const totals = model.totals;

  const overtimeTotal = Number(meta?.overtimeTotal ?? 0);
  const deductionsTotal = Number(meta?.deductionsTotal ?? 0);
  const netTotal =
    typeof meta?.netTotal === "number"
      ? meta.netTotal
      : (totals?.totalPay ?? 0) + overtimeTotal - deductionsTotal;

  // Build main table headers
  const tableHeaders = `
    <tr>
      <th class="name-col">Full Name</th>
      ${model.columns.map((c) => `<th class="day-col">${c.dayLabel}<br/>${c.dateLabel}</th>`).join("")}
      <th class="num-col">F/man Days</th>
      <th class="num-col">Man/Days</th>
      <th class="num-col">F/man Pay</th>
      <th class="num-col">Team Pay</th>
    </tr>
  `;

  // Sort rows: foreman first, then alphabetically
  const foremanName = model.foremanName || meta?.foremanName || "";
  const sortedRows = [...model.rows].sort((a, b) => {
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

  const tableRows = sortedRows
    .map((row) => {
      const isForeman =
        row.isForeman ||
        (foremanName && row.label.trim() === foremanName.trim());
      const rowClass = isForeman ? "foreman-row" : "";

      const foremanDays = isForeman ? row.daysWorked : 0;
      const teamDays = isForeman ? 0 : row.daysWorked;
      const foremanPay = isForeman ? row.pay : 0;
      const teamPay = isForeman ? 0 : row.pay;

      return `
      <tr class="${rowClass}">
        <td class="name-col">${isForeman ? "👨‍💼 " : ""}${escapeHTML(row.label)}</td>
        ${row.present.map((p) => `<td class="day-col ${p ? "present" : "absent"}">${p ? "✓" : ""}</td>`).join("")}
        <td class="num-col summary-col ${foremanDays === 0 ? "zero-val" : ""}">${foremanDays}</td>
        <td class="num-col summary-col ${teamDays === 0 ? "zero-val" : ""}">${teamDays}</td>
        <td class="num-col summary-col ${foremanPay === 0 ? "zero-val" : ""}">${foremanPay > 0 ? formatCurrencyHtml(foremanPay) : "0"}</td>
        <td class="num-col summary-col ${teamPay === 0 ? "zero-val" : ""}">${teamPay > 0 ? formatCurrencyHtml(teamPay) : "0"}</td>
      </tr>
    `;
    })
    .join("");

  // Total row
  const totalRow = `
    <tr class="total-row">
      <td class="name-col">TOTAL</td>
      ${model.columns.map(() => `<td class="day-col total-day"></td>`).join("")}
      <td class="num-col summary-col">${totals.foremanDays}</td>
      <td class="num-col summary-col">${totals.teamDays}</td>
      <td class="num-col summary-col">${formatCurrencyHtml(totals.foremanPay)}</td>
      <td class="num-col summary-col">${formatCurrencyHtml(totals.teamPay)}</td>
    </tr>
  `;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Timesheet - ${meta?.startDate ?? "Export"}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
          font-size: 12px; 
          color: #27272a;
          background: #fafafa;
          min-height: 100vh;
        }
        
        /* Content */
        .content {
          padding: 24px;
          max-width: 1400px;
          margin: 0 auto;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
        }
        h1 { 
          font-size: 24px; 
          font-weight: 700;
          color: #18181b;
          margin-bottom: 4px;
        }
        .subtitle {
          font-size: 13px;
          color: #71717a;
        }
        .actions {
          display: flex;
          gap: 8px;
        }
        .btn {
          padding: 8px 16px;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
          border: 1px solid #e4e4e7;
          background: white;
          color: #18181b;
        }
        .btn:hover {
          background: #f4f4f5;
          border-color: #d4d4d8;
        }
        .btn-primary {
          background: #16a34a;
          border-color: #16a34a;
          color: white;
        }
        .btn-primary:hover {
          background: #15803d;
          border-color: #15803d;
        }
        
        /* Meta info cards */
        .meta-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }
        .meta-card {
          background: white;
          border: 1px solid #e4e4e7;
          border-radius: 4px;
          padding: 12px 16px;
        }
        .meta-card-label {
          font-size: 11px;
          text-transform: uppercase;
          color: #71717a;
          font-weight: 600;
          margin-bottom: 4px;
        }
        .meta-card-value {
          font-size: 14px;
          font-weight: 500;
          color: #18181b;
        }
        
        /* Table */
        .table-container {
          background: white;
          border: 2px solid #52525b;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 20px;
        }
        table.main-table { 
          width: 100%; 
          border-collapse: collapse;
        }
        .main-table th, .main-table td { 
          border: 2px solid #52525b;
          padding: 10px 12px; 
          text-align: center;
          font-size: 12px;
        }
        .main-table th { 
          background: #52525b; 
          font-weight: 600;
          color: white;
          text-transform: uppercase;
          font-size: 11px;
        }
        .main-table .name-col { 
          text-align: left; 
          min-width: 180px;
          font-weight: 500;
        }
        .main-table .day-col { 
          width: 45px;
          padding: 8px 4px;
        }
        .main-table .num-col { 
          text-align: center; 
          min-width: 80px;
        }
        .main-table .summary-col {
          background: #d4d4d8;
          font-weight: 600;
        }
        .main-table .zero-val {
          color: #dc2626;
          font-weight: 800;
        }
        .main-table .present { 
          background: #22c55e; 
          color: white;
          font-weight: bold;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .main-table .absent { 
          background-color: #fecaca;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'%3E%3Cline x1='85' y1='15' x2='15' y2='85' stroke='%23dc2626' stroke-width='6'/%3E%3C/svg%3E");
          background-size: 100% 100%;
          background-repeat: no-repeat;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .main-table .foreman-row { 
          background: #e4e4e7; 
        }
        .main-table .foreman-row .name-col {
          font-weight: 700;
        }
        .main-table .foreman-row td.absent {
          background-color: #fecaca;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'%3E%3Cline x1='85' y1='15' x2='15' y2='85' stroke='%23dc2626' stroke-width='6'/%3E%3C/svg%3E");
          background-size: 100% 100%;
          background-repeat: no-repeat;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .main-table .total-row {
          background: #a1a1aa;
          font-weight: 700;
        }
        .main-table .total-row .name-col {
          font-weight: 800;
        }
        .main-table .total-row .total-day {
          background: #a1a1aa;
        }
        .main-table .total-row .summary-col {
          background: #a1a1aa;
        }
        
        /* Legend */
        .legend {
          padding: 12px 16px;
          font-size: 12px;
          color: #71717a;
          border-top: 1px solid #e4e4e7;
        }
        
        /* Totals */
        .totals-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }
        .totals-card {
          background: white;
          border: 1px solid #e4e4e7;
          border-radius: 4px;
          padding: 16px;
        }
        .totals-card.grand {
          background: #18181b;
          border-color: #18181b;
        }
        .totals-card.grand .totals-label,
        .totals-card.grand .totals-value {
          color: white;
        }
        .totals-label {
          font-size: 11px;
          text-transform: uppercase;
          color: #71717a;
          font-weight: 600;
          margin-bottom: 8px;
        }
        .totals-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
        }
        .totals-value {
          font-size: 14px;
          font-weight: 600;
          color: #18181b;
        }
        
        @media print {
          body { background: white; }
          .content { padding: 0; max-width: none; }
          .actions { display: none; }
          .meta-card, .table-container, .totals-card { 
            border: 1px solid #666; 
            box-shadow: none;
          }
          .main-table th, .main-table td {
            padding: 6px 8px;
            border: 1px solid #666;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          .main-table .present,
          .main-table .absent,
          .main-table .summary-col,
          .main-table .total-row,
          .main-table th {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="content">
        <div class="header">
          <div>
            <h1>Timesheet Report</h1>
            <p class="subtitle">${meta?.startDate && meta?.endDate ? `${meta.startDate} to ${meta.endDate}` : "Export"}</p>
          </div>
          <div class="actions">
            <button class="btn btn-primary" id="print-btn">
              🖨️ Print
            </button>
            <button class="btn" id="close-btn">
              Close
            </button>
          </div>
        </div>
        
        <div class="meta-cards">
          ${meta?.foremanName ? `<div class="meta-card"><div class="meta-card-label">Foreman</div><div class="meta-card-value">${escapeHTML(meta.foremanName)}</div></div>` : ""}
          ${meta?.contractManagerName ? `<div class="meta-card"><div class="meta-card-label">Manager</div><div class="meta-card-value">${escapeHTML(meta.contractManagerName)}</div></div>` : ""}
          ${meta?.sites?.length ? `<div class="meta-card"><div class="meta-card-label">Sites</div><div class="meta-card-value">${escapeHTML(meta.sites.map((s) => [s.code, s.name].filter(Boolean).join(" - ")).join(", "))}</div></div>` : ""}
          ${meta?.status ? `<div class="meta-card"><div class="meta-card-label">Status</div><div class="meta-card-value">${escapeHTML(meta.status)}</div></div>` : ""}
        </div>
        
        <div class="table-container">
          <table class="main-table">
            <thead>${tableHeaders}</thead>
            <tbody>${tableRows}${totalRow}</tbody>
          </table>
          <div class="legend">
            ✅ Present = scanned that day • ❌ Absent = no scan
          </div>
        </div>
        
        <div class="totals-grid">
          <div class="totals-card">
            <div class="totals-label">Foreman</div>
            <div class="totals-row"><span>Days</span><span class="totals-value">${totals.foremanDays}</span></div>
            <div class="totals-row"><span>Pay</span><span class="totals-value">${formatCurrencyHtml(totals.foremanPay)}</span></div>
          </div>
          <div class="totals-card">
            <div class="totals-label">Team</div>
            <div class="totals-row"><span>Days</span><span class="totals-value">${totals.teamDays}</span></div>
            <div class="totals-row"><span>Pay</span><span class="totals-value">${formatCurrencyHtml(totals.teamPay)}</span></div>
          </div>
          <div class="totals-card grand">
            <div class="totals-label">Grand Total</div>
            <div class="totals-row"><span>Days</span><span class="totals-value">${totals.totalDays}</span></div>
            <div class="totals-row"><span>Wages</span><span class="totals-value">${formatCurrencyHtml(totals.totalPay)}</span></div>
            ${overtimeTotal > 0 ? `<div class="totals-row"><span>Overtime</span><span class="totals-value">${formatCurrencyHtml(overtimeTotal)}</span></div>` : ""}
            ${deductionsTotal > 0 ? `<div class="totals-row"><span>Deductions</span><span class="totals-value">-${formatCurrencyHtml(deductionsTotal)}</span></div>` : ""}
            <div class="totals-row"><span>Net Pay</span><span class="totals-value">${formatCurrencyHtml(netTotal)}</span></div>
          </div>
        </div>
      </div>
      
      <script>
        document.getElementById('close-btn').addEventListener('click', function() {
          window.close();
        });
        document.getElementById('print-btn').addEventListener('click', function() {
          window.print();
        });
      </script>
    </body>
    </html>
  `;
}

/**
 * Open print preview in new window (matching desktop app)
 */
export function printTimesheet(
  model: TimesheetGridModel,
  meta?: TimesheetPrintMeta,
): void {
  const html = generateTimesheetPrintHTML(model, meta);
  const printWindow = window.open("", "_blank", "width=1100,height=800");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    // Auto-trigger print after a short delay
    setTimeout(() => {
      printWindow.print();
    }, 300);
  }
}

// ============ FOREMAN SUMMARY PDF (multi-page) ============

export interface ForemanSummaryData {
  foremanId: string;
  foremanName: string;
  startISO: string;
  endISO: string;
  sitesCount: number;
  foremanDays: number;
  foremanWages: number;
  teamDays: number;
  teamWages: number;
  grandTotal: number;
  sites: Array<{
    siteId: string;
    siteName: string;
    siteCode?: string;
    foremanDays: number;
    foremanWages: number;
    teamDays: number;
    teamWages: number;
    totalWages: number;
  }>;
}

export interface ForemanTimesheetData {
  siteId: string;
  siteName: string;
  siteCode?: string;
  gridModel: TimesheetGridModel;
  supervisorName?: string;
}

function formatCurrencySummary(amount: number): string {
  return `R${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Generate a multi-page PDF for a foreman's fortnight summary:
 * - Page 1: Summary with foreman info and breakdown by site
 * - Pages 2+: Individual timesheet grids for each site
 */
export async function generateForemanSummaryPdf(
  summary: ForemanSummaryData,
  timesheets: ForemanTimesheetData[],
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // A4 Landscape
  const pageWidth = 841.89;
  const pageHeight = 595.28;
  const margin = 40;

  // ============ PAGE 1: SUMMARY ============
  const summaryPage = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // Title
  summaryPage.drawText("Foreman Summary Report", {
    x: margin,
    y: y - 20,
    size: 22,
    font: fontBold,
    color: colors.textPrimary,
  });
  y -= 50;

  // Foreman Info Box
  summaryPage.drawRectangle({
    x: margin,
    y: y - 80,
    width: pageWidth - margin * 2,
    height: 80,
    color: rgb(0.96, 0.96, 0.97),
    borderColor: colors.border,
    borderWidth: 1,
  });

  // Info row 1
  summaryPage.drawText("Foreman:", {
    x: margin + 15,
    y: y - 25,
    size: 10,
    font: font,
    color: colors.textSecondary,
  });
  summaryPage.drawText(summary.foremanName, {
    x: margin + 80,
    y: y - 25,
    size: 12,
    font: fontBold,
    color: colors.textPrimary,
  });

  summaryPage.drawText("Period:", {
    x: margin + 280,
    y: y - 25,
    size: 10,
    font: font,
    color: colors.textSecondary,
  });
  summaryPage.drawText(`${summary.startISO} to ${summary.endISO}`, {
    x: margin + 330,
    y: y - 25,
    size: 12,
    font: fontBold,
    color: colors.textPrimary,
  });

  // Info row 2
  summaryPage.drawText("Total Sites:", {
    x: margin + 15,
    y: y - 50,
    size: 10,
    font: font,
    color: colors.textSecondary,
  });
  summaryPage.drawText(summary.sitesCount.toString(), {
    x: margin + 95,
    y: y - 50,
    size: 12,
    font: fontBold,
    color: colors.textPrimary,
  });

  summaryPage.drawText("Grand Total:", {
    x: margin + 280,
    y: y - 50,
    size: 10,
    font: font,
    color: colors.textSecondary,
  });
  summaryPage.drawText(formatCurrencySummary(summary.grandTotal), {
    x: margin + 360,
    y: y - 50,
    size: 14,
    font: fontBold,
    color: rgb(0.05, 0.6, 0.35), // emerald
  });

  y -= 100;

  // Summary Table Header
  const tableY = y - 10;
  const colWidths = [200, 80, 100, 80, 100, 120];
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);
  const rowHeight = 28;
  const headerHeight = 32;

  // Header background
  summaryPage.drawRectangle({
    x: margin,
    y: tableY - headerHeight,
    width: tableWidth,
    height: headerHeight,
    color: colors.headerBg,
  });

  // Header text
  const headers = [
    "Site",
    "F/man Days",
    "F/man Amount",
    "Team Days",
    "Team Amount",
    "Site Total",
  ];
  let xPos = margin;
  for (let i = 0; i < headers.length; i++) {
    summaryPage.drawText(headers[i], {
      x: xPos + 8,
      y: tableY - headerHeight / 2 - 4,
      size: 10,
      font: fontBold,
      color: colors.textWhite,
    });
    // Vertical border
    if (i > 0) {
      summaryPage.drawLine({
        start: { x: xPos, y: tableY },
        end: { x: xPos, y: tableY - headerHeight },
        thickness: 1,
        color: colors.borderLight,
      });
    }
    xPos += colWidths[i];
  }

  // Header border
  summaryPage.drawLine({
    start: { x: margin, y: tableY },
    end: { x: margin + tableWidth, y: tableY },
    thickness: 2,
    color: colors.border,
  });
  summaryPage.drawLine({
    start: { x: margin, y: tableY - headerHeight },
    end: { x: margin + tableWidth, y: tableY - headerHeight },
    thickness: 2,
    color: colors.border,
  });

  // Data rows
  let rowY = tableY - headerHeight;
  for (let r = 0; r < summary.sites.length; r++) {
    const site = summary.sites[r];
    const isEven = r % 2 === 0;

    summaryPage.drawRectangle({
      x: margin,
      y: rowY - rowHeight,
      width: tableWidth,
      height: rowHeight,
      color: isEven ? colors.evenRowBg : colors.oddRowBg,
    });

    xPos = margin;
    const rowData = [
      site.siteCode ? `${site.siteCode} · ${site.siteName}` : site.siteName,
      site.foremanDays.toString(),
      formatCurrencySummary(site.foremanWages),
      site.teamDays.toString(),
      formatCurrencySummary(site.teamWages),
      formatCurrencySummary(site.totalWages),
    ];

    for (let c = 0; c < rowData.length; c++) {
      const isLast = c === rowData.length - 1;
      const cellFont = isLast ? fontBold : font;
      const cellColor = isLast ? rgb(0.05, 0.6, 0.35) : colors.textPrimary;

      const text = truncateText(rowData[c], colWidths[c] - 16, cellFont, 9);
      summaryPage.drawText(text, {
        x: xPos + 8,
        y: rowY - rowHeight / 2 - 3,
        size: 9,
        font: cellFont,
        color: cellColor,
      });

      // Vertical border
      if (c > 0) {
        summaryPage.drawLine({
          start: { x: xPos, y: rowY },
          end: { x: xPos, y: rowY - rowHeight },
          thickness: 0.5,
          color: colors.borderLight,
        });
      }
      xPos += colWidths[c];
    }

    // Row bottom border
    summaryPage.drawLine({
      start: { x: margin, y: rowY - rowHeight },
      end: { x: margin + tableWidth, y: rowY - rowHeight },
      thickness: 0.5,
      color: colors.borderLight,
    });

    rowY -= rowHeight;
  }

  // Totals row
  summaryPage.drawRectangle({
    x: margin,
    y: rowY - rowHeight,
    width: tableWidth,
    height: rowHeight,
    color: colors.totalRowBg,
  });

  xPos = margin;
  const totalData = [
    "TOTAL",
    summary.foremanDays.toString(),
    formatCurrencySummary(summary.foremanWages),
    summary.teamDays.toString(),
    formatCurrencySummary(summary.teamWages),
    formatCurrencySummary(summary.grandTotal),
  ];

  for (let c = 0; c < totalData.length; c++) {
    const isLast = c === totalData.length - 1;
    const cellColor = isLast ? rgb(0.05, 0.6, 0.35) : colors.textPrimary;

    summaryPage.drawText(totalData[c], {
      x: xPos + 8,
      y: rowY - rowHeight / 2 - 3,
      size: 10,
      font: fontBold,
      color: cellColor,
    });

    if (c > 0) {
      summaryPage.drawLine({
        start: { x: xPos, y: rowY },
        end: { x: xPos, y: rowY - rowHeight },
        thickness: 1,
        color: colors.border,
      });
    }
    xPos += colWidths[c];
  }

  // Totals row border
  summaryPage.drawLine({
    start: { x: margin, y: rowY - rowHeight },
    end: { x: margin + tableWidth, y: rowY - rowHeight },
    thickness: 2,
    color: colors.border,
  });

  // Left/right borders
  summaryPage.drawLine({
    start: { x: margin, y: tableY },
    end: { x: margin, y: rowY - rowHeight },
    thickness: 2,
    color: colors.border,
  });
  summaryPage.drawLine({
    start: { x: margin + tableWidth, y: tableY },
    end: { x: margin + tableWidth, y: rowY - rowHeight },
    thickness: 2,
    color: colors.border,
  });

  // Page footer
  summaryPage.drawText(`Page 1 of ${timesheets.length + 1}`, {
    x: pageWidth - margin - 80,
    y: 20,
    size: 9,
    font: font,
    color: colors.textMuted,
  });

  // ============ PAGES 2+: INDIVIDUAL TIMESHEET GRIDS ============
  // Generate each site's timesheet using existing logic
  for (let i = 0; i < timesheets.length; i++) {
    const ts = timesheets[i];
    const metadata: TimesheetPdfMetadata = {
      foremanName: summary.foremanName,
      supervisorName: ts.supervisorName,
      siteName: ts.siteName,
      siteCode: ts.siteCode,
      startISO: summary.startISO,
      endISO: summary.endISO,
    };

    // Generate a separate PDF for this timesheet and merge pages
    const sitePdfBytes = await generateTimesheetPdf(ts.gridModel, metadata);
    const sitePdf = await PDFDocument.load(sitePdfBytes);
    const pages = await pdf.copyPages(sitePdf, sitePdf.getPageIndices());
    for (const page of pages) {
      pdf.addPage(page);
    }
  }

  // Update page numbers on all pages
  const pageCount = pdf.getPageCount();
  const allPages = pdf.getPages();
  for (let p = 1; p < pageCount; p++) {
    allPages[p].drawText(`Page ${p + 1} of ${pageCount}`, {
      x: pageWidth - margin - 80,
      y: 20,
      size: 9,
      font: font,
      color: colors.textMuted,
    });
  }

  pdf.setTitle(`Foreman Summary - ${summary.foremanName}`);
  pdf.setCreator("Office App");
  pdf.setProducer("pdf-lib");

  return pdf.save();
}

/**
 * Generate print HTML for foreman summary (multi-page)
 */
export function generateForemanSummaryPrintHTML(
  summary: ForemanSummaryData,
  timesheetHtmls: string[],
): string {
  const sitesTableRows = summary.sites
    .map(
      (site, idx) => `
      <tr class="${idx % 2 === 0 ? "even" : "odd"}">
        <td>${escapeHTML(site.siteCode ? `${site.siteCode} · ${site.siteName}` : site.siteName)}</td>
        <td class="num">${site.foremanDays}</td>
        <td class="num">${formatCurrencySummary(site.foremanWages)}</td>
        <td class="num">${site.teamDays}</td>
        <td class="num">${formatCurrencySummary(site.teamWages)}</td>
        <td class="num total-col">${formatCurrencySummary(site.totalWages)}</td>
      </tr>
    `,
    )
    .join("");

  const summaryHtml = `
    <div class="summary-page">
      <h1>Foreman Summary Report</h1>
      <div class="info-box">
        <div class="info-row">
          <span class="label">Foreman:</span>
          <span class="value">${escapeHTML(summary.foremanName)}</span>
          <span class="label" style="margin-left: 60px;">Period:</span>
          <span class="value">${summary.startISO} to ${summary.endISO}</span>
        </div>
        <div class="info-row">
          <span class="label">Total Sites:</span>
          <span class="value">${summary.sitesCount}</span>
          <span class="label" style="margin-left: 60px;">Net Pay:</span>
          <span class="value grand-total">${formatCurrencySummary(summary.grandTotal)}</span>
        </div>
      </div>
      <table class="summary-table">
        <thead>
          <tr>
            <th>Site</th>
            <th class="num">F/man Days</th>
            <th class="num">F/man Amount</th>
            <th class="num">Team Days</th>
            <th class="num">Team Amount</th>
            <th class="num">Site Total</th>
          </tr>
        </thead>
        <tbody>
          ${sitesTableRows}
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td>TOTAL</td>
            <td class="num">${summary.foremanDays}</td>
            <td class="num">${formatCurrencySummary(summary.foremanWages)}</td>
            <td class="num">${summary.teamDays}</td>
            <td class="num">${formatCurrencySummary(summary.teamWages)}</td>
            <td class="num total-col">${formatCurrencySummary(summary.grandTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;

  const timesheetPages = timesheetHtmls
    .map((html) => `<div class="timesheet-page">${html}</div>`)
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Foreman Summary - ${escapeHTML(summary.foremanName)}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #27272a; background: #fafafa; }
        
        @media print {
          body { background: white; }
          .summary-page, .timesheet-page { page-break-after: always; }
          .no-print { display: none !important; }
          .actions { display: none !important; }
          .meta-card, .table-container, .totals-card { 
            border: 1px solid #666; 
            box-shadow: none;
          }
          .main-table th, .main-table td {
            padding: 6px 8px;
            border: 1px solid #666;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          .main-table .present,
          .main-table .absent,
          .main-table .summary-col,
          .main-table .total-row,
          .main-table th {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
        }
        
        .no-print { position: fixed; top: 10px; right: 10px; z-index: 1000; }
        .no-print button { padding: 8px 16px; margin-left: 8px; cursor: pointer; border-radius: 4px; border: 1px solid #d4d4d8; background: white; }
        .no-print button:hover { background: #f4f4f5; }
        
        /* Summary page styles */
        .summary-page { padding: 30px; max-width: 1400px; margin: 0 auto; }
        .summary-page h1 { font-size: 22px; margin-bottom: 20px; font-weight: 700; color: #18181b; }
        .info-box { background: #f4f4f5; border: 1px solid #d4d4d8; padding: 15px 20px; margin-bottom: 25px; border-radius: 4px; }
        .info-row { margin-bottom: 8px; }
        .info-row .label { color: #71717a; font-size: 11px; text-transform: uppercase; }
        .info-row .value { font-weight: 600; margin-left: 8px; }
        .info-row .grand-total { color: #059669; font-size: 16px; }
        
        .summary-table { width: 100%; border-collapse: collapse; }
        .summary-table th, .summary-table td { padding: 10px 12px; border: 1px solid #d4d4d8; text-align: left; }
        .summary-table th { background: #3f3f46; color: white; font-weight: 600; }
        .summary-table th.num, .summary-table td.num { text-align: right; }
        .summary-table .even { background: #fafafa; }
        .summary-table .odd { background: white; }
        .summary-table .total-row { background: #a1a1aa; font-weight: 700; }
        .summary-table .total-col { color: #059669; font-weight: 700; }
        
        /* Timesheet page styles (from generateTimesheetPrintHTML) */
        .timesheet-page { padding: 24px; max-width: 1400px; margin: 0 auto; }
        .timesheet-page .content { padding: 0; }
        
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
        }
        .header h1 { 
          font-size: 24px; 
          font-weight: 700;
          color: #18181b;
          margin-bottom: 4px;
        }
        .subtitle {
          font-size: 13px;
          color: #71717a;
        }
        .actions {
          display: flex;
          gap: 8px;
        }
        .btn {
          padding: 8px 16px;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
          border: 1px solid #e4e4e7;
          background: white;
          color: #18181b;
        }
        .btn:hover {
          background: #f4f4f5;
          border-color: #d4d4d8;
        }
        .btn-primary {
          background: #16a34a;
          border-color: #16a34a;
          color: white;
        }
        .btn-primary:hover {
          background: #15803d;
          border-color: #15803d;
        }
        
        /* Meta info cards */
        .meta-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }
        .meta-card {
          background: white;
          border: 1px solid #e4e4e7;
          border-radius: 4px;
          padding: 12px 16px;
        }
        .meta-card-label {
          font-size: 11px;
          text-transform: uppercase;
          color: #71717a;
          font-weight: 600;
          margin-bottom: 4px;
        }
        .meta-card-value {
          font-size: 14px;
          font-weight: 500;
          color: #18181b;
        }
        
        /* Table */
        .table-container {
          background: white;
          border: 2px solid #52525b;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 20px;
        }
        table.main-table { 
          width: 100%; 
          border-collapse: collapse;
        }
        .main-table th, .main-table td { 
          border: 2px solid #52525b;
          padding: 10px 12px; 
          text-align: center;
          font-size: 12px;
        }
        .main-table th { 
          background: #52525b; 
          font-weight: 600;
          color: white;
          text-transform: uppercase;
          font-size: 11px;
        }
        .main-table .name-col { 
          text-align: left; 
          min-width: 180px;
          font-weight: 500;
        }
        .main-table .day-col { 
          width: 45px;
          padding: 8px 4px;
        }
        .main-table .num-col { 
          text-align: center; 
          min-width: 80px;
        }
        .main-table .summary-col {
          background: #d4d4d8;
          font-weight: 600;
        }
        .main-table .zero-val {
          color: #dc2626;
          font-weight: 800;
        }
        .main-table .present { 
          background: #22c55e; 
          color: white;
          font-weight: bold;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .main-table .absent { 
          background-color: #fecaca;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'%3E%3Cline x1='85' y1='15' x2='15' y2='85' stroke='%23dc2626' stroke-width='6'/%3E%3C/svg%3E");
          background-size: 100% 100%;
          background-repeat: no-repeat;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .main-table .foreman-row { 
          background: #e4e4e7; 
        }
        .main-table .foreman-row .name-col {
          font-weight: 700;
        }
        .main-table .foreman-row td.absent {
          background-color: #fecaca;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'%3E%3Cline x1='85' y1='15' x2='15' y2='85' stroke='%23dc2626' stroke-width='6'/%3E%3C/svg%3E");
          background-size: 100% 100%;
          background-repeat: no-repeat;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .main-table .total-row {
          background: #a1a1aa;
          font-weight: 700;
        }
        .main-table .total-row .name-col {
          font-weight: 800;
        }
        .main-table .total-row .total-day {
          background: #a1a1aa;
        }
        .main-table .total-row .summary-col {
          background: #a1a1aa;
        }
        
        /* Legend */
        .legend {
          padding: 12px 16px;
          font-size: 12px;
          color: #71717a;
          border-top: 1px solid #e4e4e7;
        }
        
        /* Totals grid */
        .totals-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }
        .totals-card {
          background: white;
          border: 1px solid #e4e4e7;
          border-radius: 4px;
          padding: 16px;
        }
        .totals-card.grand {
          background: #18181b;
          border-color: #18181b;
        }
        .totals-card.grand .totals-label,
        .totals-card.grand .totals-value {
          color: white;
        }
        .totals-label {
          font-size: 11px;
          text-transform: uppercase;
          color: #71717a;
          font-weight: 600;
          margin-bottom: 8px;
        }
        .totals-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
        }
        .totals-value {
          font-size: 14px;
          font-weight: 600;
          color: #18181b;
        }
      </style>
    </head>
    <body>
      <div class="no-print">
        <button id="close-btn">Close</button>
        <button id="print-btn">Print</button>
      </div>
      ${summaryHtml}
      ${timesheetPages}
      <script>
        document.getElementById('close-btn').addEventListener('click', function() { window.close(); });
        document.getElementById('print-btn').addEventListener('click', function() { window.print(); });
      </script>
    </body>
    </html>
  `;
}

/**
 * Open print preview for foreman summary
 */
export function printForemanSummary(
  summary: ForemanSummaryData,
  timesheets: Array<{
    gridModel: TimesheetGridModel;
    meta: TimesheetPrintMeta;
  }>,
): void {
  // Generate individual timesheet HTML bodies
  const timesheetHtmlBodies = timesheets.map((ts) => {
    const fullHtml = generateTimesheetPrintHTML(ts.gridModel, ts.meta);
    // Extract body content between <body> tags
    const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    return bodyMatch ? bodyMatch[1] : "";
  });

  const html = generateForemanSummaryPrintHTML(summary, timesheetHtmlBodies);
  const printWindow = window.open("", "_blank", "width=1100,height=800");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  }
}
