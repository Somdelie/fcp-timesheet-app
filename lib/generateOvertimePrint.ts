/**
 * Overtime entries print HTML generator.
 * Follows the same pattern as generateTimesheetPrintHTML / printTimesheet.
 */

type OvertimeEntryForPrint = {
  workDate: string;
  siteName: string;
  siteCode: string | null;
  foremanName: string;
  supervisorName?: string | null;
  overtimePriceLabel: string;
  rateAtCreation: number;
  numberOfEmployees: number;
  hoursWorked: number;
  totalCost: number;
  note: string | null;
};

export type OvertimePrintColumnId =
  | "date"
  | "site"
  | "foreman"
  | "supervisor"
  | "priceType"
  | "rate"
  | "employees"
  | "hours"
  | "total";

export interface OvertimePrintMeta {
  filterSiteName?: string;
  filterFrom?: string;
  filterTo?: string;
  columns?: OvertimePrintColumnId[];
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtCurrency(n: number): string {
  return `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function siteLabel(name: string, code: string | null | undefined): string {
  return code ? `${code} — ${name}` : name;
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, "en-ZA", { sensitivity: "base" });
}

const PRINT_COLUMNS: Array<{
  id: OvertimePrintColumnId;
  label: string;
  className: string;
  render: (entry: OvertimeEntryForPrint) => string;
}> = [
  {
    id: "date",
    label: "Date",
    className: "date-col",
    render: (entry) => escapeHTML(fmtDate(entry.workDate)),
  },
  {
    id: "site",
    label: "Site",
    className: "site-col",
    render: (entry) => escapeHTML(siteLabel(entry.siteName, entry.siteCode)),
  },
  {
    id: "foreman",
    label: "Foreman",
    className: "name-col",
    render: (entry) => escapeHTML(entry.foremanName),
  },
  {
    id: "supervisor",
    label: "Supervisor",
    className: "name-col",
    render: (entry) => escapeHTML(entry.supervisorName ?? "-"),
  },
  {
    id: "priceType",
    label: "Price Type",
    className: "type-col",
    render: (entry) => escapeHTML(entry.overtimePriceLabel),
  },
  {
    id: "rate",
    label: "Rate",
    className: "num-col",
    render: (entry) => `${fmtCurrency(entry.rateAtCreation)}/hr`,
  },
  {
    id: "employees",
    label: "Guys",
    className: "num-col",
    render: (entry) => String(entry.numberOfEmployees),
  },
  {
    id: "hours",
    label: "Hours",
    className: "num-col",
    render: (entry) => `${entry.hoursWorked}h`,
  },
  {
    id: "total",
    label: "Total",
    className: "num-col total-col",
    render: (entry) => fmtCurrency(entry.totalCost),
  },
];

export function generateOvertimePrintHTML(
  entries: OvertimeEntryForPrint[],
  meta?: OvertimePrintMeta,
): string {
  const selectedColumnIds =
    meta?.columns && meta.columns.length > 0
      ? new Set(meta.columns)
      : new Set(PRINT_COLUMNS.map((column) => column.id));
  const activeColumns = PRINT_COLUMNS.filter((column) =>
    selectedColumnIds.has(column.id),
  );
  const showForemanGroupLabels = selectedColumnIds.has("foreman");
  const totalEmployees = entries.reduce((s, e) => s + e.numberOfEmployees, 0);
  const totalHours = entries.reduce((s, e) => s + e.hoursWorked, 0);
  const totalCost = entries.reduce((s, e) => s + e.totalCost, 0);

  const dateRangeLabel =
    meta?.filterFrom && meta?.filterTo
      ? `${meta.filterFrom} to ${meta.filterTo}`
      : meta?.filterFrom
        ? `From ${meta.filterFrom}`
        : meta?.filterTo
          ? `Up to ${meta.filterTo}`
          : "All dates";

  const groupedEntries = [...entries]
    .sort((a, b) => {
      const foremanCompare = compareText(a.foremanName, b.foremanName);
      if (foremanCompare !== 0) return foremanCompare;
      const dateCompare =
        new Date(a.workDate).getTime() - new Date(b.workDate).getTime();
      if (dateCompare !== 0) return dateCompare;
      return compareText(
        siteLabel(a.siteName, a.siteCode),
        siteLabel(b.siteName, b.siteCode),
      );
    })
    .reduce<Array<{ foremanName: string; rows: OvertimeEntryForPrint[] }>>(
      (groups, entry) => {
        const last = groups[groups.length - 1];
        if (
          last &&
          last.foremanName.toLowerCase() === entry.foremanName.toLowerCase()
        ) {
          last.rows.push(entry);
        } else {
          groups.push({ foremanName: entry.foremanName, rows: [entry] });
        }
        return groups;
      },
      [],
    );

  const tableRows = groupedEntries
    .map((group) => {
      const foremanEmployees = group.rows.reduce(
        (sum, e) => sum + e.numberOfEmployees,
        0,
      );
      const foremanHours = group.rows.reduce((sum, e) => sum + e.hoursWorked, 0);
      const foremanTotal = group.rows.reduce((sum, e) => sum + e.totalCost, 0);
      const rows = group.rows
        .map(
          (e) => `
      <tr>
        ${activeColumns
          .map(
            (column) =>
              `<td class="${column.className}">${column.render(e)}</td>`,
          )
          .join("")}
      </tr>`,
        )
        .join("");
      const summaryCells = activeColumns
        .map((column, index) => {
          if (index === 0)
            return `<td class="name-col">${escapeHTML(group.foremanName)} total</td>`;
          if (column.id === "employees")
            return `<td class="num-col">${foremanEmployees}</td>`;
          if (column.id === "hours")
            return `<td class="num-col">${foremanHours}h</td>`;
          if (column.id === "total")
            return `<td class="num-col total-col">${fmtCurrency(foremanTotal)}</td>`;
          return `<td></td>`;
        })
        .join("");

      if (!showForemanGroupLabels) return rows;

      return `
      <tr class="foreman-row">
        <td colspan="${activeColumns.length}">${escapeHTML(group.foremanName)}</td>
      </tr>
      ${rows}
      <tr class="foreman-total-row">
        ${summaryCells}
      </tr>`;
    })
    .join("");

  const totalCells = activeColumns
    .map((column, index) => {
      if (index === 0) return `<td class="name-col">TOTAL</td>`;
      if (column.id === "employees")
        return `<td class="num-col">${totalEmployees}</td>`;
      if (column.id === "hours") return `<td class="num-col">${totalHours}h</td>`;
      if (column.id === "total")
        return `<td class="num-col total-col">${fmtCurrency(totalCost)}</td>`;
      return `<td></td>`;
    })
    .join("");

  const totalRow = `
    <tr class="total-row">
      ${totalCells}
    </tr>
  `;

  return `<!DOCTYPE html>
<html>
<head>
  <title>Overtime Report - ${escapeHTML(dateRangeLabel)}</title>
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
      border: 1px solid #52525b;
      padding: 8px 10px;
      text-align: center;
      font-size: 11px;
    }
    .main-table th {
      background: #52525b;
      font-weight: 600;
      color: white;
      text-transform: uppercase;
      font-size: 10px;
    }
    .main-table .foreman-row td {
      background: #18181b;
      color: white;
      font-size: 12px;
      font-weight: 800;
      text-align: left;
      text-transform: capitalize;
      letter-spacing: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .main-table .date-col {
      white-space: nowrap;
      text-align: left;
    }
    .main-table .site-col {
      text-align: left;
      font-weight: 600;
      text-transform: uppercase;
    }
    .main-table .name-col {
      text-align: left;
      text-transform: capitalize;
    }
    .main-table .type-col {
      text-align: left;
    }
    .main-table .num-col {
      text-align: center;
      font-weight: 500;
    }
    .main-table .total-col {
      font-weight: 700;
      background: #d4d4d8;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .main-table .total-row {
      background: #a1a1aa;
      font-weight: 700;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .main-table .total-row td {
      font-weight: 800;
      font-size: 12px;
    }
    .main-table .total-row .total-col {
      background: #a1a1aa;
    }
    .main-table .foreman-total-row {
      background: #e4e4e7;
      font-weight: 700;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .main-table .foreman-total-row td {
      font-weight: 800;
    }
    .main-table .foreman-total-row .total-col {
      background: #c4c4cc;
    }

    @media print {
      body { background: white; }
      .content { padding: 0; max-width: none; }
      .actions { display: none !important; }
      .table-container {
        border: 1px solid #666;
        box-shadow: none;
      }
      .main-table th, .main-table td {
        padding: 5px 7px;
        border: 1px solid #666;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      .main-table .total-col,
      .main-table .foreman-row,
      .main-table .foreman-total-row,
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
        <h1>Overtime Report</h1>
        <p class="subtitle">${escapeHTML(dateRangeLabel)}${meta?.filterSiteName ? ` — ${escapeHTML(meta.filterSiteName)}` : ""}</p>
      </div>
      <div class="actions">
        <button class="btn btn-primary" id="print-btn">🖨️ Print</button>
        <button class="btn" id="close-btn">Close</button>
      </div>
    </div>

    <div class="table-container">
      <table class="main-table">
        <thead>
          <tr>
            ${activeColumns.map((column) => `<th>${column.label}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${tableRows}
          ${totalRow}
        </tbody>
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
</html>`;
}

/**
 * Open print preview in new window for overtime entries.
 */
export function printOvertimeEntries(
  entries: OvertimeEntryForPrint[],
  meta?: OvertimePrintMeta,
): void {
  const html = generateOvertimePrintHTML(entries, meta);
  const printWindow = window.open("", "_blank", "width=1100,height=800");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  }
}
