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
  siteClaimDate?: string | null;
  supervisorName?: string | null;
  daysWorked?: number;
  totalWages?: number;
  totalMaterialCost?: number;
  amountClaimed?: number;
  claimAmountReceived?: number;
  claimOutstanding?: number;
  jobStatus?: string | null;
};

export type SitesPrintColumns = {
  code?: boolean;
  name?: boolean;
  client?: boolean;
  claimDate?: boolean;
  supervisor?: boolean;
  daysWorked?: boolean;
  wages?: boolean;
  material?: boolean;
  total?: boolean;
  amountClaimed?: boolean;
  paidToDate?: boolean;
  outstanding?: boolean;
  profitLoss?: boolean;
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
  | "claimDate"
  | "supervisor"
  | "daysWorked"
  | "wages"
  | "material"
  | "total"
  | "amountClaimed"
  | "paidToDate"
  | "outstanding"
  | "profitLoss"
  | "created";

type ColumnDef = {
  key: ColumnKey;
  label: string;
  className: string;
  width: number;
  align?: "left" | "right";
  total?: (sites: SiteForPdf[]) => number | null;
  value: (site: SiteForPdf) => string;
};

function getProfitLoss(site: SiteForPdf) {
  const claimed = site.amountClaimed ?? 0;
  if (claimed === 0) return null;
  return claimed - ((site.totalWages ?? 0) + (site.totalMaterialCost ?? 0));
}

function getProfitLossText(site: SiteForPdf) {
  const value = getProfitLoss(site);
  if (value === null) return "-";
  const prefix = value >= 0 ? "+" : "";
  return `${prefix}${formatCurrencyPdf(value)}`;
}

function getSiteColumnDefs(): Record<ColumnKey, ColumnDef> {
  return {
    code: {
      key: "code",
      label: "Job #",
      className: "code-col",
      width: 55,
      value: (site) => site.code || "-",
    },
    name: {
      key: "name",
      label: "Name",
      className: "name-col",
      width: 118,
      value: (site) => site.name,
    },
    client: {
      key: "client",
      label: "Client",
      className: "client-col",
      width: 82,
      value: (site) => site.client || "-",
    },
    claimDate: {
      key: "claimDate",
      label: "Claim Date",
      className: "claim-date-col",
      width: 62,
      value: (site) => (site.siteClaimDate ? formatDate(site.siteClaimDate) : "-"),
    },
    supervisor: {
      key: "supervisor",
      label: "Supervisor",
      className: "supervisor-col",
      width: 90,
      value: (site) => site.supervisorName || "-",
    },
    daysWorked: {
      key: "daysWorked",
      label: "Days",
      className: "days-col",
      width: 42,
      align: "right",
      total: (sites) => sites.reduce((sum, site) => sum + (site.daysWorked ?? 0), 0),
      value: (site) => String(site.daysWorked ?? 0),
    },
    wages: {
      key: "wages",
      label: "Wages",
      className: "wages-col",
      width: 74,
      align: "right",
      total: (sites) => sites.reduce((sum, site) => sum + (site.totalWages ?? 0), 0),
      value: (site) => formatCurrencyPdf(site.totalWages ?? 0),
    },
    material: {
      key: "material",
      label: "Material",
      className: "material-col",
      width: 78,
      align: "right",
      total: (sites) => sites.reduce((sum, site) => sum + (site.totalMaterialCost ?? 0), 0),
      value: (site) => formatCurrencyPdf(site.totalMaterialCost ?? 0),
    },
    total: {
      key: "total",
      label: "Total Cost",
      className: "total-col",
      width: 78,
      align: "right",
      total: (sites) =>
        sites.reduce(
          (sum, site) => sum + (site.totalWages ?? 0) + (site.totalMaterialCost ?? 0),
          0,
        ),
      value: (site) =>
        formatCurrencyPdf((site.totalWages ?? 0) + (site.totalMaterialCost ?? 0)),
    },
    amountClaimed: {
      key: "amountClaimed",
      label: "Claimed",
      className: "claimed-col",
      width: 78,
      align: "right",
      total: (sites) => sites.reduce((sum, site) => sum + (site.amountClaimed ?? 0), 0),
      value: (site) => formatCurrencyPdf(site.amountClaimed ?? 0),
    },
    paidToDate: {
      key: "paidToDate",
      label: "Paid",
      className: "paid-col",
      width: 74,
      align: "right",
      total: (sites) => sites.reduce((sum, site) => sum + (site.claimAmountReceived ?? 0), 0),
      value: (site) =>
        (site.claimAmountReceived ?? 0) > 0
          ? formatCurrencyPdf(site.claimAmountReceived ?? 0)
          : "-",
    },
    outstanding: {
      key: "outstanding",
      label: "Outstanding",
      className: "outstanding-col",
      width: 78,
      align: "right",
      total: (sites) => sites.reduce((sum, site) => sum + (site.claimOutstanding ?? 0), 0),
      value: (site) =>
        (site.claimOutstanding ?? 0) > 0 || (site.amountClaimed ?? 0) > 0
          ? formatCurrencyPdf(site.claimOutstanding ?? 0)
          : "-",
    },
    profitLoss: {
      key: "profitLoss",
      label: "Profit / Loss",
      className: "profit-col",
      width: 78,
      align: "right",
      total: (sites) => sites.reduce((sum, site) => sum + (getProfitLoss(site) ?? 0), 0),
      value: getProfitLossText,
    },
    created: {
      key: "created",
      label: "Created",
      className: "created-col",
      width: 62,
      value: (site) => formatDate(site.createdAt),
    },
  };
}

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

  const colDefs = getSiteColumnDefs();
  const colWidths: Record<ColumnKey, number> = {
    code: colDefs.code.width,
    name: colDefs.name.width,
    client: colDefs.client.width,
    claimDate: colDefs.claimDate.width,
    supervisor: colDefs.supervisor.width,
    daysWorked: colDefs.daysWorked.width,
    wages: colDefs.wages.width,
    material: colDefs.material.width,
    total: colDefs.total.width,
    amountClaimed: colDefs.amountClaimed.width,
    paidToDate: colDefs.paidToDate.width,
    outstanding: colDefs.outstanding.width,
    profitLoss: colDefs.profitLoss.width,
    created: colDefs.created.width,
  };

  const enabledCols: Record<ColumnKey, boolean> = {
    code: columns?.code ?? true,
    name: columns?.name ?? true,
    client: columns?.client ?? true,
    claimDate: columns?.claimDate ?? true,
    supervisor: columns?.supervisor ?? true,
    daysWorked: columns?.daysWorked ?? true,
    wages: columns?.wages ?? true,
    material: columns?.material ?? true,
    total: columns?.total ?? true,
    amountClaimed: columns?.amountClaimed ?? true,
    paidToDate: columns?.paidToDate ?? true,
    outstanding: columns?.outstanding ?? true,
    profitLoss: columns?.profitLoss ?? true,
    created: columns?.created ?? false,
  };

  const columnOrder: ColumnKey[] = [
    "code",
    "name",
    "client",
    "claimDate",
    "supervisor",
    "daysWorked",
    "wages",
    "material",
    "total",
    "amountClaimed",
    "paidToDate",
    "outstanding",
    "profitLoss",
    "created",
  ];

  const activeColumns = columnOrder.filter((key) => enabledCols[key]);
  const printableColumns =
    activeColumns.length > 0 ? activeColumns : (["code", "name"] as ColumnKey[]);
  const availableTableWidth = pageWidth - margin * 2;
  const naturalTableWidth = printableColumns.reduce(
    (sum, key) => sum + colDefs[key].width,
    0,
  );
  const widthScale = Math.min(1, availableTableWidth / naturalTableWidth);
  const colWidth = (key: ColumnKey) => colDefs[key].width * widthScale;

  const tableWidth = Math.min(availableTableWidth, naturalTableWidth);

  const cellPadding = 4;
  const headerHeight = 24;
  const rowHeight = 22;
  const fontSize = 7.5;
  const headerFontSize = 7.2;
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

    let xPos = margin;
    const textY = startY - headerHeight / 2 - 2.5;

    for (const key of printableColumns) {
      const width = colWidth(key);
      const headerText = truncateText(
        colDefs[key].label,
        width - cellPadding * 2,
        fontBold,
        headerFontSize,
      );
      pg.drawText(headerText, {
        x: xPos + cellPadding,
        y: textY,
        size: headerFontSize,
        font: fontBold,
        color: colors.textPrimary,
      });
      xPos += width;
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

    let xPos = margin;
    const textY = rowY + rowHeight / 2 - 2.5;

    for (const key of printableColumns) {
      const width = colWidth(key);
      const def = colDefs[key];
      const textFont =
        key === "code" ? fontMono : key === "name" || key === "total" ? fontBold : font;
      const text = truncateText(
        def.value(site),
        width - cellPadding * 2,
        textFont,
        fontSize,
      );
      const textWidth = textFont.widthOfTextAtSize(text, fontSize);
      pg.drawText(text, {
        x:
          def.align === "right"
            ? xPos + width - textWidth - cellPadding
            : xPos + cellPadding,
        y: textY,
        size: fontSize,
        font: textFont,
        color: colors.textPrimary,
      });
      xPos += width;
    }

    return rowY;

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
        case "daysWorked": {
          pg.drawText(String(site.daysWorked ?? 0), {
            x: xPos + colWidths.daysWorked - 24,
            y: textY,
            size: fontSize - 1,
            font: fontBold,
            color: colors.textPrimary,
          });
          xPos += colWidths.daysWorked;
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
    for (let i = 0; i < printableColumns.length - 1; i++) {
      const key = printableColumns[i];
      colX += colWidth(key);
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

  const colDefs = getSiteColumnDefs();
  const enabledCols: Record<ColumnKey, boolean> = {
    code: columns?.code ?? true,
    name: columns?.name ?? true,
    client: columns?.client ?? true,
    claimDate: columns?.claimDate ?? true,
    supervisor: columns?.supervisor ?? false,
    daysWorked: columns?.daysWorked ?? true,
    wages: columns?.wages ?? true,
    material: columns?.material ?? true,
    total: columns?.total ?? true,
    amountClaimed: columns?.amountClaimed ?? true,
    paidToDate: columns?.paidToDate ?? true,
    outstanding: columns?.outstanding ?? true,
    profitLoss: columns?.profitLoss ?? true,
    created: columns?.created ?? false,
  };
  const columnOrder: ColumnKey[] = [
    "code",
    "name",
    "client",
    "claimDate",
    "supervisor",
    "daysWorked",
    "wages",
    "material",
    "total",
    "amountClaimed",
    "paidToDate",
    "outstanding",
    "profitLoss",
    "created",
  ];
  const selectedColumns = columnOrder.filter((key) => enabledCols[key]);
  const activeColumns =
    selectedColumns.length > 0 ? selectedColumns : (["code", "name"] as ColumnKey[]);
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
          const daysWorked = site.daysWorked ?? 0;
          return `
            <tr>
              <td class="code-col">${escapeHTML(site.code ?? "—")}</td>
              <td class="name-col">${escapeHTML(site.name)}</td>
              ${showClient ? `<td class="client-col">${escapeHTML(site.client ?? "—")}</td>` : ""}
              <td class="days-col">${daysWorked}</td>
              <td class="wages-col">${formatCurrencyHtml(wages)}</td>
              <td class="material-col">${formatCurrencyHtml(material)}</td>
              <td class="total-col">${formatCurrencyHtml(total)}</td>
            </tr>`;
        })
        .join("");

      const totalWages = supervisorSites.reduce((s, x) => s + (x.totalWages ?? 0), 0);
      const totalMaterial = supervisorSites.reduce((s, x) => s + (x.totalMaterialCost ?? 0), 0);
      const totalCost = totalWages + totalMaterial;
      const totalDaysWorked = supervisorSites.reduce((s, x) => s + (x.daysWorked ?? 0), 0);
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
                  <th class="days-col">Days</th>
                  <th class="wages-col">Wages</th>
                  <th class="material-col">Material</th>
                  <th class="total-col">Total Cost</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
                <tr class="totals-row">
                  <td colspan="${colSpanBefore}" class="totals-label">Total (${supervisorSites.length} job${supervisorSites.length === 1 ? "" : "s"})</td>
                  <td class="days-col">${totalDaysWorked}</td>
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

  const renderedSections = Array.from(grouped.entries())
    .map(([supervisorName, supervisorSites], idx) => {
      const headerCells = activeColumns
        .map((key) => {
          const def = colDefs[key];
          return `<th class="${def.className}">${escapeHTML(def.label)}</th>`;
        })
        .join("");
      const rows = supervisorSites
        .map((site) => {
          const cells = activeColumns
            .map((key) => {
              const def = colDefs[key];
              const value = def.value(site).replace(/^R/, "R ");
              return `<td class="${def.className}">${escapeHTML(value)}</td>`;
            })
            .join("");
          return `<tr>${cells}</tr>`;
        })
        .join("");
      const firstTotalIndex = activeColumns.findIndex(
        (key) => typeof colDefs[key].total === "function",
      );
      const totalsRow =
        firstTotalIndex === -1
          ? ""
          : (() => {
              const beforeSpan = Math.max(1, firstTotalIndex);
              const totalCells = activeColumns
                .slice(firstTotalIndex)
                .map((key) => {
                  const def = colDefs[key];
                  const total = def.total?.(supervisorSites);
                  const value =
                    total === null || total === undefined
                      ? ""
                      : key === "daysWorked"
                        ? String(total)
                        : formatCurrencyHtml(total);
                  return `<td class="${def.className}">${escapeHTML(value)}</td>`;
                })
                .join("");
              return `<tr class="totals-row"><td colspan="${beforeSpan}" class="totals-label">Total (${supervisorSites.length} job${supervisorSites.length === 1 ? "" : "s"})</td>${totalCells}</tr>`;
            })();

      return `
        <div class="supervisor-section${idx > 0 ? " page-break" : ""}">
          <h2 class="supervisor-name">${escapeHTML(supervisorName)}</h2>
          <div class="table-container">
            <table class="main-table">
              <thead><tr>${headerCells}</tr></thead>
              <tbody>${rows}${totalsRow}</tbody>
            </table>
          </div>
        </div>`;
    })
    .join("");
  void sections;

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
          table-layout: fixed;
        }
        .main-table th, .main-table td {
          border: 1px solid #e4e4e7;
          padding: 5px 6px;
          text-align: left;
          font-size: 10px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .main-table th {
          background: #52525b;
          font-weight: 600;
          color: white;
          text-transform: uppercase;
          font-size: 9px;
        }
        .main-table .code-col { font-family: monospace; width: 58px; }
        .main-table .name-col { font-weight: 500; }
        .main-table .client-col,
        .main-table .supervisor-col,
        .main-table .claim-date-col,
        .main-table .created-col { width: 80px; }
        .main-table .days-col,
        .main-table .wages-col,
        .main-table .material-col,
        .main-table .total-col,
        .main-table .claimed-col,
        .main-table .paid-col,
        .main-table .outstanding-col,
        .main-table .profit-col {
          text-align: right;
          font-weight: 600;
          white-space: nowrap;
        }
        .main-table .days-col,
        .main-table .total-col,
        .main-table .profit-col { font-weight: 700; }
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
            padding: 4px 5px;
            font-size: 9px;
            border: 1px solid #aaa;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .main-table th {
            font-size: 8px;
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
          <button class="btn btn-primary" id="print-btn">Print</button>
          <button class="btn" id="close-btn">Close</button>
        </div>
        ${renderedSections}
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
