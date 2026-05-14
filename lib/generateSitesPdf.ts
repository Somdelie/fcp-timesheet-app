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
  client?: string | null;
  location: string | null;
  isActive: boolean;
  createdAt: string;
  supervisorName?: string | null;
  totalWages?: number;
  totalMaterialCost?: number;
  jobStatus?: string | null;
};

export type SitesPrintColumns = {
  client?: boolean;
  supervisor?: boolean;
  wages?: boolean;
  material?: boolean;
  total?: boolean;
  created?: boolean;
};

function formatCurrencyPdf(amount: number): string {
  return `R${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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

type ColumnKey =
  | "code"
  | "name"
  | "client"
  | "supervisor"
  | "wages"
  | "material"
  | "total"
  | "created";

export async function generateSitesPdf(
  sites: SiteForPdf[],
  columns?: SitesPrintColumns,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await pdf.embedFont(StandardFonts.Courier);

  // A4 Landscape dimensions
  const pageWidth = 841.89;
  const pageHeight = 595.28;
  const margin = 32;

  // Column widths for landscape
  const colWidths: Record<ColumnKey, number> = {
    code: 80,
    name: 140,
    client: 100,
    supervisor: 110,
    wages: 90,
    material: 90,
    total: 90,
    created: 78,
  };

  const enabledCols: Record<ColumnKey, boolean> = {
    code: true,
    name: true,
    client: columns?.client ?? true,
    supervisor: columns?.supervisor ?? true,
    wages: columns?.wages ?? true,
    material: columns?.material ?? true,
    total: columns?.total ?? true,
    created: columns?.created ?? true,
  };

  const columnOrder: ColumnKey[] = [
    "code",
    "name",
    "client",
    "supervisor",
    "wages",
    "material",
    "total",
    "created",
  ];

  const activeColumns = columnOrder.filter((key) => enabledCols[key]);

  const tableWidth = activeColumns.reduce(
    (sum, key) => sum + colWidths[key],
    0,
  );

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

    for (const key of activeColumns) {
      switch (key) {
        case "code": {
          pg.drawRectangle({
            x: xPos,
            y: textY + 1,
            width: 8,
            height: 8,
            color: colors.indigo600,
          });
          pg.drawText("Job #", {
            x: xPos + 12,
            y: textY,
            size: headerFontSize,
            font: fontBold,
            color: colors.textPrimary,
          });
          xPos += colWidths.code;
          break;
        }
        case "name": {
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
          break;
        }
        case "client": {
          pg.drawText("Client", {
            x: xPos,
            y: textY,
            size: headerFontSize,
            font: fontBold,
            color: colors.textPrimary,
          });
          xPos += colWidths.client;
          break;
        }
        case "supervisor": {
          pg.drawText("Supervisor", {
            x: xPos,
            y: textY,
            size: headerFontSize,
            font: fontBold,
            color: colors.textPrimary,
          });
          xPos += colWidths.supervisor;
          break;
        }
        case "wages": {
          pg.drawRectangle({
            x: xPos,
            y: textY + 1,
            width: 8,
            height: 8,
            color: colors.emerald600,
          });
          pg.drawText("Wages", {
            x: xPos + 12,
            y: textY,
            size: headerFontSize,
            font: fontBold,
            color: colors.textPrimary,
          });
          xPos += colWidths.wages;
          break;
        }
        case "material": {
          pg.drawRectangle({
            x: xPos,
            y: textY + 1,
            width: 8,
            height: 8,
            color: colors.orange600,
          });
          pg.drawText("Material", {
            x: xPos + 12,
            y: textY,
            size: headerFontSize,
            font: fontBold,
            color: colors.textPrimary,
          });
          xPos += colWidths.material;
          break;
        }
        case "total": {
          pg.drawText("Total Cost", {
            x: xPos,
            y: textY,
            size: headerFontSize,
            font: fontBold,
            color: colors.textPrimary,
          });
          xPos += colWidths.total;
          break;
        }
        case "created": {
          pg.drawText("Created", {
            x: xPos,
            y: textY,
            size: headerFontSize,
            font: fontBold,
            color: colors.textPrimary,
          });
          xPos += colWidths.created;
          break;
        }
      }
    }

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

    for (const key of activeColumns) {
      switch (key) {
        case "code": {
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
          break;
        }
        case "name": {
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
          break;
        }
        case "client": {
          const clientText = truncateText(
            site.client || "—",
            colWidths.client - 8,
            font,
            fontSize - 1,
          );
          pg.drawText(clientText, {
            x: xPos,
            y: textY,
            size: fontSize - 1,
            font: font,
            color: colors.textPrimary,
          });
          xPos += colWidths.client;
          break;
        }
        case "supervisor": {
          const supText = truncateText(
            site.supervisorName || "—",
            colWidths.supervisor - 8,
            font,
            fontSize - 1,
          );
          pg.drawText(supText, {
            x: xPos,
            y: textY,
            size: fontSize - 1,
            font: font,
            color: colors.textPrimary,
          });
          xPos += colWidths.supervisor;
          break;
        }
        case "wages": {
          pg.drawText(formatCurrencyPdf(site.totalWages ?? 0), {
            x: xPos,
            y: textY,
            size: fontSize - 1,
            font: font,
            color: colors.textPrimary,
          });
          xPos += colWidths.wages;
          break;
        }
        case "material": {
          pg.drawText(formatCurrencyPdf(site.totalMaterialCost ?? 0), {
            x: xPos,
            y: textY,
            size: fontSize - 1,
            font: font,
            color: colors.textPrimary,
          });
          xPos += colWidths.material;
          break;
        }
        case "total": {
          pg.drawText(
            formatCurrencyPdf(
              (site.totalWages ?? 0) + (site.totalMaterialCost ?? 0),
            ),
            {
              x: xPos,
              y: textY,
              size: fontSize - 1,
              font: fontBold,
              color: colors.textPrimary,
            },
          );
          xPos += colWidths.total;
          break;
        }
        case "created": {
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
          xPos += colWidths.created;
          break;
        }
      }
    }

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
    let colX = margin;
    for (let i = 0; i < activeColumns.length - 1; i++) {
      const key = activeColumns[i];
      colX += colWidths[key];
      pg.drawLine({
        start: { x: colX, y: topY },
        end: { x: colX, y: bottomY },
        thickness: 0.5,
        color: colors.borderLight,
      });
    }
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

// ============ Print HTML function ============

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function generateSitesPrintHTML(
  sites: SiteForPdf[],
  columns?: SitesPrintColumns,
): string {
  const formatCurrencyHtml = (n: number) =>
    `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const showClient = columns?.client ?? true;

  // Only include ongoing sites that have at least some cost
  const sitesWithCosts = sites.filter(
    (s) =>
      s.jobStatus === "ONGOING" &&
      ((s.totalWages ?? 0) > 0 || (s.totalMaterialCost ?? 0) > 0),
  );

  // Group by supervisor
  const grouped = new Map<string, SiteForPdf[]>();
  for (const site of sitesWithCosts) {
    const key = site.supervisorName?.trim() || "Unassigned";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(site);
  }

  const sections = Array.from(grouped.entries())
    .map(([supervisorName, supervisorSites], idx) => {
      const rows = supervisorSites
        .map((site) => {
          const wages = site.totalWages ?? 0;
          const material = site.totalMaterialCost ?? 0;
          const total = wages + material;
          return `
            <tr>
              <td class="code-col">${escapeHTML(site.code ?? "—")}</td>
              <td class="name-col">${escapeHTML(site.name)}</td>
              ${showClient ? `<td class="client-col">${escapeHTML(site.client ?? "—")}</td>` : ""}
              <td class="wages-col">${formatCurrencyHtml(wages)}</td>
              <td class="material-col">${formatCurrencyHtml(material)}</td>
              <td class="total-col">${formatCurrencyHtml(total)}</td>
            </tr>`;
        })
        .join("");

      const totalWages = supervisorSites.reduce((s, x) => s + (x.totalWages ?? 0), 0);
      const totalMaterial = supervisorSites.reduce((s, x) => s + (x.totalMaterialCost ?? 0), 0);
      const totalCost = totalWages + totalMaterial;
      const colSpanBefore = showClient ? 3 : 2;

      return `
        <div class="supervisor-section${idx > 0 ? " page-break" : ""}">
          <h2 class="supervisor-name">${escapeHTML(supervisorName)}</h2>
          <div class="table-container">
            <table class="main-table">
              <thead>
                <tr>
                  <th class="code-col">Job #</th>
                  <th class="name-col">Name</th>
                  ${showClient ? '<th class="client-col">Client</th>' : ""}
                  <th class="wages-col">Wages</th>
                  <th class="material-col">Material</th>
                  <th class="total-col">Total Cost</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
                <tr class="totals-row">
                  <td colspan="${colSpanBefore}" class="totals-label">Total (${supervisorSites.length} job${supervisorSites.length === 1 ? "" : "s"})</td>
                  <td class="wages-col">${formatCurrencyHtml(totalWages)}</td>
                  <td class="material-col">${formatCurrencyHtml(totalMaterial)}</td>
                  <td class="total-col">${formatCurrencyHtml(totalCost)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>`;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Sites Report</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 12px;
          color: #27272a;
          background: #fafafa;
          min-height: 100vh;
        }
        .content {
          padding: 24px;
          max-width: 1200px;
          margin: 0 auto;
        }
        .actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          margin-bottom: 24px;
        }
        .btn {
          padding: 8px 16px;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          border: 1px solid #e4e4e7;
          background: white;
          color: #18181b;
        }
        .btn-primary {
          background: #16a34a;
          border-color: #16a34a;
          color: white;
        }
        .supervisor-section {
          margin-bottom: 40px;
        }
        .supervisor-name {
          font-size: 18px;
          font-weight: 700;
          color: #18181b;
          margin-bottom: 10px;
          padding-bottom: 6px;
          border-bottom: 2px solid #18181b;
        }
        .table-container {
          background: white;
          border: 1px solid #d4d4d8;
          border-radius: 4px;
          overflow: hidden;
        }
        table.main-table {
          width: 100%;
          border-collapse: collapse;
        }
        .main-table th, .main-table td {
          border: 1px solid #e4e4e7;
          padding: 8px 12px;
          text-align: left;
          font-size: 12px;
        }
        .main-table th {
          background: #52525b;
          font-weight: 600;
          color: white;
          text-transform: uppercase;
          font-size: 11px;
        }
        .main-table .code-col { font-family: monospace; width: 80px; }
        .main-table .name-col { font-weight: 500; }
        .main-table .client-col { min-width: 100px; }
        .main-table .wages-col { text-align: right; font-weight: 600; white-space: nowrap; }
        .main-table .material-col { text-align: right; font-weight: 600; white-space: nowrap; }
        .main-table .total-col { text-align: right; font-weight: 700; white-space: nowrap; }
        .main-table tbody tr:nth-child(even) { background: #fafafa; }
        .totals-row td {
          background: #f4f4f5 !important;
          font-weight: 700;
          border-top: 2px solid #d4d4d8;
        }
        .totals-label { color: #52525b; font-size: 11px; text-transform: uppercase; }
        .page-break { page-break-before: always; }

        @media print {
          body { background: white; }
          .content { padding: 0; max-width: none; }
          .actions { display: none; }
          .main-table th, .main-table td {
            padding: 6px 8px;
            border: 1px solid #aaa;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .main-table th {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .totals-row td {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="content">
        <div class="actions">
          <button class="btn btn-primary" id="print-btn">🖨️ Print</button>
          <button class="btn" id="close-btn">Close</button>
        </div>
        ${sections}
      </div>
      <script>
        document.getElementById('close-btn').addEventListener('click', function() { window.close(); });
        document.getElementById('print-btn').addEventListener('click', function() { window.print(); });
      </script>
    </body>
    </html>
  `;
}

/**
 * Open print preview in new window for sites
 */
export function printSites(
  sites: SiteForPdf[],
  columns?: SitesPrintColumns,
): void {
  const html = generateSitesPrintHTML(sites, columns);
  const printWindow = window.open("", "_blank", "width=1100,height=800");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  }
}
