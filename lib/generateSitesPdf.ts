import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFPage,
  type PDFFont,
} from "pdf-lib";

export type SiteForPdf = {
  id: string;
  name: string;
  code: string | null;
  location: string | null;
  isActive: boolean;
  createdAt: string;
};

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
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

// Color palette matching Tailwind classes from the web app
const colors = {
  // Background colors
  white: rgb(1, 1, 1),
  cardBg: rgb(0.996, 0.996, 0.996),
  headerBg: rgb(0.976, 0.976, 0.98),

  // Border colors - matching border-zinc-200/50
  border: rgb(0.878, 0.878, 0.878),
  borderLight: rgb(0.922, 0.922, 0.922),

  // Text colors
  textPrimary: rgb(0.09, 0.09, 0.11),
  textSecondary: rgb(0.4, 0.4, 0.45),
  textMuted: rgb(0.6, 0.6, 0.65),

  // Icon/accent colors from the web table
  indigo600: rgb(0.31, 0.27, 0.9),
  sky600: rgb(0.02, 0.47, 0.76),
  orange600: rgb(0.92, 0.38, 0.08),
  emerald600: rgb(0.02, 0.53, 0.38),
  emerald500: rgb(0.06, 0.73, 0.51),

  // Status colors
  activeText: rgb(0.02, 0.53, 0.38),
  inactiveText: rgb(0.4, 0.4, 0.45),
  inactiveBg: rgb(0.898, 0.898, 0.898),
  zinc400: rgb(0.62, 0.62, 0.67),
};

export async function generateSitesPdf(
  sites: SiteForPdf[],
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await pdf.embedFont(StandardFonts.Courier);

  // A4 Landscape dimensions
  const pageWidth = 841.89;
  const pageHeight = 595.28;
  const margin = 32;
  const tableWidth = pageWidth - margin * 2;

  // Column widths for landscape
  const colWidths = {
    code: 100,
    name: 220,
    location: 280,
    status: 90,
    created: 88,
  };

  const headerHeight = 36;
  const rowHeight = 32;
  const fontSize = 10;
  const headerFontSize = 10;
  const titleFontSize = 20;

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;
  let tableStartY = 0;

  // Title
  page.drawText("Sites Report", {
    x: margin,
    y: y - titleFontSize,
    size: titleFontSize,
    font: fontBold,
    color: colors.textPrimary,
  });

  // Subtitle
  const subtitle = `Generated: ${new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })} • ${sites.length} site${sites.length === 1 ? "" : "s"}`;
  page.drawText(subtitle, {
    x: margin,
    y: y - titleFontSize - 16,
    size: 10,
    font: font,
    color: colors.textSecondary,
  });
  y -= titleFontSize + 36;

  function drawTableHeader(pg: PDFPage, startY: number): number {
    tableStartY = startY;

    pg.drawRectangle({
      x: margin,
      y: startY - headerHeight,
      width: tableWidth,
      height: headerHeight,
      color: colors.headerBg,
      borderColor: colors.border,
      borderWidth: 1,
    });

    let xPos = margin + 12;
    const textY = startY - headerHeight / 2 - 4;

    // Job Number (indigo)
    pg.drawRectangle({
      x: xPos,
      y: textY + 1,
      width: 8,
      height: 8,
      color: colors.indigo600,
    });
    pg.drawText("Job Number", {
      x: xPos + 12,
      y: textY,
      size: headerFontSize,
      font: fontBold,
      color: colors.textPrimary,
    });
    xPos += colWidths.code;

    // Name (sky)
    pg.drawRectangle({
      x: xPos,
      y: textY + 1,
      width: 8,
      height: 8,
      color: colors.sky600,
    });
    pg.drawText("Name", {
      x: xPos + 12,
      y: textY,
      size: headerFontSize,
      font: fontBold,
      color: colors.textPrimary,
    });
    xPos += colWidths.name;

    // Location (orange)
    pg.drawRectangle({
      x: xPos,
      y: textY + 1,
      width: 8,
      height: 8,
      color: colors.orange600,
    });
    pg.drawText("Location", {
      x: xPos + 12,
      y: textY,
      size: headerFontSize,
      font: fontBold,
      color: colors.textPrimary,
    });
    xPos += colWidths.location;

    // Status
    pg.drawText("Status", {
      x: xPos,
      y: textY,
      size: headerFontSize,
      font: fontBold,
      color: colors.textPrimary,
    });
    xPos += colWidths.status;

    // Created (emerald)
    pg.drawRectangle({
      x: xPos,
      y: textY + 1,
      width: 8,
      height: 8,
      color: colors.emerald600,
    });
    pg.drawText("Created", {
      x: xPos + 12,
      y: textY,
      size: headerFontSize,
      font: fontBold,
      color: colors.textPrimary,
    });

    return startY - headerHeight;
  }

  function drawRow(
    pg: PDFPage,
    site: SiteForPdf,
    startY: number,
    isEven: boolean,
  ): number {
    const rowY = startY - rowHeight;

    if (isEven) {
      pg.drawRectangle({
        x: margin,
        y: rowY,
        width: tableWidth,
        height: rowHeight,
        color: colors.cardBg,
      });
    }

    pg.drawLine({
      start: { x: margin, y: rowY },
      end: { x: margin + tableWidth, y: rowY },
      thickness: 0.5,
      color: colors.borderLight,
    });

    let xPos = margin + 12;
    const textY = rowY + rowHeight / 2 - 4;

    // Code (monospace)
    const codeText = truncateText(
      site.code || "—",
      colWidths.code - 16,
      fontMono,
      fontSize - 1,
    );
    pg.drawText(codeText, {
      x: xPos,
      y: textY,
      size: fontSize - 1,
      font: fontMono,
      color: colors.textPrimary,
    });
    xPos += colWidths.code;

    // Name (bold)
    const nameText = truncateText(
      site.name,
      colWidths.name - 16,
      fontBold,
      fontSize,
    );
    pg.drawText(nameText, {
      x: xPos,
      y: textY,
      size: fontSize,
      font: fontBold,
      color: colors.textPrimary,
    });
    xPos += colWidths.name;

    // Location
    const locText = truncateText(
      site.location || "—",
      colWidths.location - 16,
      font,
      fontSize,
    );
    pg.drawText(locText, {
      x: xPos,
      y: textY,
      size: fontSize,
      font: font,
      color: colors.textPrimary,
    });
    xPos += colWidths.location;

    // Status pill
    const statusText = site.isActive ? "Active" : "Inactive";
    const statusWidth = font.widthOfTextAtSize(statusText, fontSize - 1) + 20;
    const pillHeight = 18;
    const pillY = textY - 3;

    pg.drawRectangle({
      x: xPos,
      y: pillY,
      width: statusWidth,
      height: pillHeight,
      color: site.isActive ? rgb(0.94, 0.99, 0.96) : colors.inactiveBg,
    });

    pg.drawCircle({
      x: xPos + 8,
      y: pillY + pillHeight / 2,
      size: 3,
      color: site.isActive ? colors.emerald500 : colors.zinc400,
    });

    pg.drawText(statusText, {
      x: xPos + 16,
      y: textY,
      size: fontSize - 1,
      font: font,
      color: site.isActive ? colors.activeText : colors.inactiveText,
    });
    xPos += colWidths.status;

    // Created
    const createdText = truncateText(
      formatDate(site.createdAt),
      colWidths.created - 12,
      font,
      fontSize - 1,
    );
    pg.drawText(createdText, {
      x: xPos,
      y: textY,
      size: fontSize - 1,
      font: font,
      color: colors.textSecondary,
    });

    return rowY;
  }

  function drawTableBorders(pg: PDFPage, topY: number, bottomY: number) {
    // Left border
    pg.drawLine({
      start: { x: margin, y: topY },
      end: { x: margin, y: bottomY },
      thickness: 1,
      color: colors.border,
    });
    // Right border
    pg.drawLine({
      start: { x: margin + tableWidth, y: topY },
      end: { x: margin + tableWidth, y: bottomY },
      thickness: 1,
      color: colors.border,
    });
    // Bottom border
    pg.drawLine({
      start: { x: margin, y: bottomY },
      end: { x: margin + tableWidth, y: bottomY },
      thickness: 1,
      color: colors.border,
    });

    // Vertical column dividers
    let colX = margin + colWidths.code;
    // After Code column
    pg.drawLine({
      start: { x: colX, y: topY },
      end: { x: colX, y: bottomY },
      thickness: 0.5,
      color: colors.borderLight,
    });
    colX += colWidths.name;
    // After Name column
    pg.drawLine({
      start: { x: colX, y: topY },
      end: { x: colX, y: bottomY },
      thickness: 0.5,
      color: colors.borderLight,
    });
    colX += colWidths.location;
    // After Location column
    pg.drawLine({
      start: { x: colX, y: topY },
      end: { x: colX, y: bottomY },
      thickness: 0.5,
      color: colors.borderLight,
    });
    colX += colWidths.status;
    // After Status column
    pg.drawLine({
      start: { x: colX, y: topY },
      end: { x: colX, y: bottomY },
      thickness: 0.5,
      color: colors.borderLight,
    });
  }

  y = drawTableHeader(page, y);
  let rowIndex = 0;
  let currentPageTableTop = tableStartY;

  for (const site of sites) {
    if (y - rowHeight < margin + 20) {
      drawTableBorders(page, currentPageTableTop, y);
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
      y = drawTableHeader(page, y);
      currentPageTableTop = tableStartY;
    }

    y = drawRow(page, site, y, rowIndex % 2 === 0);
    rowIndex++;
  }

  drawTableBorders(page, currentPageTableTop, y);

  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawText(`Page ${i + 1} of ${pages.length}`, {
      x: pageWidth - margin - 60,
      y: 20,
      size: 8,
      font: font,
      color: colors.textMuted,
    });
  });

  pdf.setTitle("Sites Report");
  pdf.setCreator("Office App");
  pdf.setProducer("pdf-lib");

  return pdf.save();
}

export function downloadPdfBlob(pdfBytes: Uint8Array, filename: string) {
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], {
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
}
