import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFPage,
  type PDFFont,
} from "pdf-lib";

export type SupervisorSummaryGroup = {
  supervisorId: string;
  supervisorName: string;
  foremen: Array<{
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
    totalForemanDays: number;
    totalForemanWages: number;
    totalTeamDays: number;
    totalTeamWages: number;
    grandTotal: number;
  }>;
  totalForemanDays: number;
  totalForemanWages: number;
  totalTeamDays: number;
  totalTeamWages: number;
  grandTotal: number;
};

function formatDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function truncate(text: string, maxWidth: number, font: PDFFont, size: number) {
  let value = text;
  while (value && font.widthOfTextAtSize(value, size) > maxWidth) {
    value = value.slice(0, -1);
  }
  return value === text ? value : `${value.slice(0, -3)}...`;
}

export async function generateSupervisorSummaryPdf(
  summary: SupervisorSummaryGroup,
  startISO: string,
  endISO: string,
): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const width = 841.89;
  const height = 595.28;
  const margin = 28;
  const rowHeight = 25;
  const columns = [
    { label: "Foreman", width: 190 },
    { label: "Site", width: 315 },
    { label: "Code", width: 100 },
    { label: "Team Days", width: 110 },
  ];
  const tableWidth = columns.reduce((total, column) => total + column.width, 0);
  const border = rgb(0.75, 0.78, 0.82);
  const header = rgb(0.15, 0.19, 0.31);
  const light = rgb(0.94, 0.95, 0.97);
  const totalFill = rgb(0.89, 0.91, 0.94);

  let page: PDFPage = undefined as unknown as PDFPage;
  let y = 0;

  const drawCell = (
    text: string,
    x: number,
    cellY: number,
    cellWidth: number,
    options: { isBold?: boolean; center?: boolean; fill?: ReturnType<typeof rgb>; white?: boolean } = {},
  ) => {
    const textFont = options.isBold ? bold : font;
    const textValue = truncate(text, cellWidth - 12, textFont, 9);
    if (options.fill) {
      page.drawRectangle({ x, y: cellY, width: cellWidth, height: rowHeight, color: options.fill });
    }
    page.drawRectangle({ x, y: cellY, width: cellWidth, height: rowHeight, borderColor: border, borderWidth: 0.7 });
    const textWidth = textFont.widthOfTextAtSize(textValue, 9);
    page.drawText(textValue, {
      x: options.center ? x + (cellWidth - textWidth) / 2 : x + 6,
      y: cellY + 9,
      size: 9,
      font: textFont,
      color: options.white ? rgb(1, 1, 1) : rgb(0.08, 0.1, 0.15),
    });
  };

  const beginPage = () => {
    page = pdf.addPage([width, height]);
    page.drawText("TIME SHEET SUMMARY", {
      x: margin,
      y: height - margin - 14,
      size: 19,
      font: bold,
      color: rgb(0.08, 0.1, 0.15),
    });
    page.drawText(`${formatDate(startISO)} - ${formatDate(endISO)}`, {
      x: margin,
      y: height - margin - 32,
      size: 10,
      font,
      color: rgb(0.38, 0.42, 0.48),
    });
    const supervisorText = truncate(`Supervisor: ${summary.supervisorName}`, 300, bold, 11);
    page.drawText(supervisorText, {
      x: width - margin - bold.widthOfTextAtSize(supervisorText, 11),
      y: height - margin - 20,
      size: 11,
      font: bold,
      color: rgb(0.08, 0.1, 0.15),
    });

    const cardY = height - margin - 76;
    const cardWidth = 175;
    page.drawRectangle({ x: margin, y: cardY, width: cardWidth, height: 38, color: light, borderColor: border, borderWidth: 0.7 });
    page.drawText("FOREMEN", { x: margin + 10, y: cardY + 23, size: 8, font: bold, color: rgb(0.4, 0.44, 0.5) });
    page.drawText(String(summary.foremen.length), { x: margin + 10, y: cardY + 8, size: 13, font: bold, color: rgb(0.08, 0.1, 0.15) });
    page.drawRectangle({ x: margin + cardWidth + 10, y: cardY, width: cardWidth, height: 38, color: light, borderColor: border, borderWidth: 0.7 });
    page.drawText("TOTAL TEAM DAYS", { x: margin + cardWidth + 20, y: cardY + 23, size: 8, font: bold, color: rgb(0.4, 0.44, 0.5) });
    page.drawText(String(summary.totalTeamDays ?? 0), { x: margin + cardWidth + 20, y: cardY + 8, size: 13, font: bold, color: rgb(0.08, 0.1, 0.15) });

    y = cardY - 18;
    let x = margin;
    columns.forEach((column, index) => {
      drawCell(column.label, x, y - rowHeight, column.width, {
        isBold: true,
        center: index > 1,
        fill: header,
        white: true,
      });
      x += column.width;
    });
    y -= rowHeight;
  };

  beginPage();
  for (const foreman of summary.foremen ?? []) {
    for (const [index, site] of foreman.sites.entries()) {
      if (y - rowHeight < margin + rowHeight) beginPage();
      let x = margin;
      drawCell(index === 0 ? foreman.foremanName : "", x, y - rowHeight, columns[0].width, { isBold: index === 0 }); x += columns[0].width;
      drawCell(site.siteName, x, y - rowHeight, columns[1].width); x += columns[1].width;
      drawCell(site.siteCode ?? "-", x, y - rowHeight, columns[2].width, { center: true }); x += columns[2].width;
      drawCell(String(site.teamDays ?? 0), x, y - rowHeight, columns[3].width, { center: true, isBold: true });
      y -= rowHeight;
    }
    if (y - rowHeight < margin + rowHeight) beginPage();
    drawCell(`${foreman.foremanName} total`, margin, y - rowHeight, tableWidth - columns[3].width, { isBold: true, fill: totalFill });
    drawCell(String(foreman.totalTeamDays ?? 0), margin + tableWidth - columns[3].width, y - rowHeight, columns[3].width, { isBold: true, center: true, fill: totalFill });
    y -= rowHeight;
  }

  if (y - rowHeight < margin) beginPage();
  drawCell("GRAND TOTAL DAYS", margin, y - rowHeight, tableWidth - columns[3].width, { isBold: true, fill: header, white: true });
  drawCell(String(summary.totalTeamDays ?? 0), margin + tableWidth - columns[3].width, y - rowHeight, columns[3].width, { isBold: true, center: true, fill: header, white: true });

  return Buffer.from(await pdf.save());
}
