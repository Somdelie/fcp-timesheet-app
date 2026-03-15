/**
 * Overtime entries print HTML generator.
 * Follows the same pattern as generateTimesheetPrintHTML / printTimesheet.
 */

type OvertimeEntryForPrint = {
  workDate: string;
  siteName: string;
  siteCode: string | null;
  foremanName: string;
  overtimePriceLabel: string;
  rateAtCreation: number;
  numberOfEmployees: number;
  hoursWorked: number;
  totalCost: number;
  note: string | null;
};

export interface OvertimePrintMeta {
  filterSiteName?: string;
  filterFrom?: string;
  filterTo?: string;
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

export function generateOvertimePrintHTML(
  entries: OvertimeEntryForPrint[],
  meta?: OvertimePrintMeta,
): string {
  const totalEntries = entries.length;
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

  const tableRows = entries
    .map(
      (e) => `
      <tr>
        <td class="date-col">${escapeHTML(fmtDate(e.workDate))}</td>
        <td class="site-col">${escapeHTML(siteLabel(e.siteName, e.siteCode))}</td>
        <td class="name-col">${escapeHTML(e.foremanName)}</td>
        <td class="type-col">${escapeHTML(e.overtimePriceLabel)}</td>
        <td class="num-col">${fmtCurrency(e.rateAtCreation)}/hr</td>
        <td class="num-col">${e.numberOfEmployees}</td>
        <td class="num-col">${e.hoursWorked}h</td>
        <td class="num-col total-col">${fmtCurrency(e.totalCost)}</td>
      </tr>`,
    )
    .join("");

  const totalRow = `
    <tr class="total-row">
      <td colspan="5" class="name-col">TOTAL</td>
      <td class="num-col">${totalEmployees}</td>
      <td class="num-col">${totalHours}h</td>
      <td class="num-col total-col">${fmtCurrency(totalCost)}</td>
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

    /* Meta info cards */
    .meta-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
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

    /* Summary */
    .totals-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
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
    .totals-value {
      font-size: 18px;
      font-weight: 700;
      color: #18181b;
    }

    @media print {
      body { background: white; }
      .content { padding: 0; max-width: none; }
      .actions { display: none !important; }
      .meta-card, .table-container, .totals-card {
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

    <div class="meta-cards">
      <div class="meta-card">
        <div class="meta-card-label">Total Entries</div>
        <div class="meta-card-value">${totalEntries}</div>
      </div>
      <div class="meta-card">
        <div class="meta-card-label">Total Employees (OT)</div>
        <div class="meta-card-value">${totalEmployees}</div>
      </div>
      <div class="meta-card">
        <div class="meta-card-label">Total Hours</div>
        <div class="meta-card-value">${totalHours}h</div>
      </div>
      <div class="meta-card">
        <div class="meta-card-label">Total Cost</div>
        <div class="meta-card-value">${fmtCurrency(totalCost)}</div>
      </div>
    </div>

    <div class="table-container">
      <table class="main-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Site</th>
            <th>Foreman</th>
            <th>Price Type</th>
            <th>Rate</th>
            <th>Employees</th>
            <th>Hours</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
          ${totalRow}
        </tbody>
      </table>
    </div>

    <div class="totals-grid">
      <div class="totals-card">
        <div class="totals-label">Entries</div>
        <div class="totals-value">${totalEntries}</div>
      </div>
      <div class="totals-card">
        <div class="totals-label">Employees</div>
        <div class="totals-value">${totalEmployees}</div>
      </div>
      <div class="totals-card">
        <div class="totals-label">Hours</div>
        <div class="totals-value">${totalHours}h</div>
      </div>
      <div class="totals-card grand">
        <div class="totals-label">Total Cost</div>
        <div class="totals-value">${fmtCurrency(totalCost)}</div>
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
