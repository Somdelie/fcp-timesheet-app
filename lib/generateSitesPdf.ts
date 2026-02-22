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
  supervisorName?: string | null;
  totalWages?: number;
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

// ============ Print HTML function ============

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function generateSitesPrintHTML(sites: SiteForPdf[]): string {
  const formatCurrencyHtml = (n: number) =>
    `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const tableRows = sites
    .map((site) => {
      const statusClass = site.isActive ? "active" : "inactive";
      return `
        <tr>
          <td class="code-col">${escapeHTML(site.code ?? "—")}</td>
          <td class="name-col">${escapeHTML(site.name)}</td>
          <td class="supervisor-col">${escapeHTML(site.supervisorName ?? "—")}</td>
          <td class="wages-col">${formatCurrencyHtml(site.totalWages ?? 0)}</td>
          <td class="status-col"><span class="status-pill ${statusClass}">${site.isActive ? "Active" : "Inactive"}</span></td>
          <td class="created-col">${formatDate(site.createdAt)}</td>
        </tr>
      `;
    })
    .join("");

  // Calculate totals
  const totalWagesSum = sites.reduce((sum, s) => sum + (s.totalWages ?? 0), 0);
  const activeSites = sites.filter((s) => s.isActive).length;

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
        
        /* Summary cards */
        .summary-cards {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }
        .summary-card {
          background: white;
          border: 1px solid #e4e4e7;
          border-radius: 4px;
          padding: 16px;
        }
        .summary-label {
          font-size: 11px;
          text-transform: uppercase;
          color: #71717a;
          font-weight: 600;
          margin-bottom: 4px;
        }
        .summary-value {
          font-size: 20px;
          font-weight: 700;
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
          border: 1px solid #d4d4d8;
          padding: 10px 12px; 
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
        .main-table .code-col { 
          font-family: monospace;
          width: 100px;
        }
        .main-table .name-col { 
          font-weight: 500;
          min-width: 180px;
        }
        .main-table .supervisor-col { 
          min-width: 150px;
        }
        .main-table .wages-col { 
          text-align: right;
          font-weight: 600;
          min-width: 120px;
        }
        .main-table .status-col { 
          text-align: center;
          width: 90px;
        }
        .main-table .created-col { 
          width: 100px;
        }
        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 600;
        }
        .status-pill.active {
          background: #dcfce7;
          color: #166534;
        }
        .status-pill.inactive {
          background: #e4e4e7;
          color: #52525b;
        }
        .status-pill::before {
          content: '';
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
        .status-pill.active::before {
          background: #22c55e;
        }
        .status-pill.inactive::before {
          background: #a1a1aa;
        }
        .main-table tbody tr:nth-child(even) {
          background: #fafafa;
        }
        .main-table tbody tr:hover {
          background: #f4f4f5;
        }
        
        @media print {
          body { background: white; }
          .content { padding: 0; max-width: none; }
          .actions { display: none; }
          .summary-card, .table-container { 
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
          .main-table th,
          .status-pill {
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
            <h1>Sites Report</h1>
            <p class="subtitle">Generated: ${new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })} • ${sites.length} site${sites.length === 1 ? "" : "s"}</p>
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
        
        <div class="summary-cards">
          <div class="summary-card">
            <div class="summary-label">Total Sites</div>
            <div class="summary-value">${sites.length}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Active Sites</div>
            <div class="summary-value">${activeSites}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Total Wages</div>
            <div class="summary-value">${formatCurrencyHtml(totalWagesSum)}</div>
          </div>
        </div>
        
        <div class="table-container">
          <table class="main-table">
            <thead>
              <tr>
                <th class="code-col">Job Number</th>
                <th class="name-col">Name</th>
                <th class="supervisor-col">Supervisor</th>
                <th class="wages-col">Total Wages</th>
                <th class="status-col">Status</th>
                <th class="created-col">Created</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
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
 * Open print preview in new window for sites
 */
export function printSites(sites: SiteForPdf[]): void {
  const html = generateSitesPrintHTML(sites);
  const printWindow = window.open("", "_blank", "width=1100,height=800");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  }
}
