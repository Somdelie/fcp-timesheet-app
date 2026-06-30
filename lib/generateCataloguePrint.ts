export type CataloguePrintRow = {
  name: string;
  sku?: string | null;
  variantText?: string | null;
  stockQty: number;
  unit?: string | null;
  price?: string | number | null;
  status?: string | null;
  notes?: string | null;
  onOrder?: number | null;
};

function escapeHTML(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  return escapeHTML(String(value));
}

export function generateCataloguePrintHTML({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle?: string;
  rows: CataloguePrintRow[];
}): string {
  const printedOn = new Date().toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const totalUnits = rows.reduce((sum, row) => sum + row.stockQty, 0);
  const hasPrice = rows.some((row) => row.price !== undefined && row.price !== null);
  const hasStatus = rows.some((row) => row.status);
  const hasOnOrder = rows.some((row) => row.onOrder !== undefined && row.onOrder !== null);

  const headers = [
    "Item",
    "SKU",
    "Variants",
    "In Stock",
    ...(hasOnOrder ? ["On Order"] : []),
    ...(hasPrice ? ["Price"] : []),
    ...(hasStatus ? ["Status"] : []),
    "Notes",
  ];

  const tableRows = rows
    .map((row) => {
      const values = [
        cell(row.name),
        cell(row.sku),
        cell(row.variantText),
        cell(`${row.stockQty}${row.unit ? ` ${row.unit}` : ""}`),
        ...(hasOnOrder ? [cell(row.onOrder ?? 0)] : []),
        ...(hasPrice ? [cell(row.price)] : []),
        ...(hasStatus ? [cell(row.status)] : []),
        cell(row.notes),
      ];

      return `<tr>${values.map((value) => `<td>${value}</td>`).join("")}</tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <title>${escapeHTML(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #f8fafc;
      color: #111827;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 12px;
    }
    .content { max-width: 1100px; margin: 0 auto; padding: 24px; }
    .toolbar {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-bottom: 16px;
    }
    button {
      border: 1px solid #d1d5db;
      border-radius: 4px;
      background: #fff;
      color: #111827;
      cursor: pointer;
      font-weight: 600;
      padding: 8px 14px;
    }
    button.primary {
      background: #0f766e;
      border-color: #0f766e;
      color: #fff;
    }
    .header {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      align-items: flex-start;
      margin-bottom: 16px;
    }
    h1 { margin: 0 0 4px; font-size: 22px; }
    .muted { color: #64748b; }
    .stats { display: flex; gap: 10px; }
    .stat {
      min-width: 120px;
      border: 1px solid #e5e7eb;
      background: #fff;
      border-radius: 4px;
      padding: 10px 12px;
    }
    .stat-label {
      color: #64748b;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: .04em;
      text-transform: uppercase;
    }
    .stat-value { margin-top: 3px; font-size: 18px; font-weight: 800; }
    table {
      width: 100%;
      border-collapse: collapse;
      background: #fff;
      border: 2px solid #374151;
    }
    th, td {
      border: 1px solid #d1d5db;
      padding: 8px 10px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #374151;
      color: #fff;
      font-size: 10px;
      letter-spacing: .04em;
      text-transform: uppercase;
    }
    tr:nth-child(even) td { background: #f9fafb; }
    @media print {
      body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .content { max-width: none; padding: 10mm; }
      .toolbar { display: none; }
      tr { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="content">
    <div class="toolbar">
      <button id="close-btn">Close</button>
      <button class="primary" id="print-btn">Print</button>
    </div>
    <div class="header">
      <div>
        <h1>${escapeHTML(title)}</h1>
        <div class="muted">${escapeHTML(subtitle ?? "")}</div>
        <div class="muted">Printed on ${printedOn}</div>
      </div>
      <div class="stats">
        <div class="stat">
          <div class="stat-label">Items</div>
          <div class="stat-value">${rows.length}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Units</div>
          <div class="stat-value">${totalUnits}</div>
        </div>
      </div>
    </div>
    <table>
      <thead><tr>${headers.map((header) => `<th>${escapeHTML(header)}</th>`).join("")}</tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>
  <script>
    document.getElementById("close-btn").addEventListener("click", function () { window.close(); });
    document.getElementById("print-btn").addEventListener("click", function () { window.print(); });
  </script>
</body>
</html>`;
}

export function printCatalogue({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle?: string;
  rows: CataloguePrintRow[];
}): boolean {
  const printWindow = window.open("", "_blank", "width=1100,height=800");
  if (!printWindow) return false;

  printWindow.document.write(generateCataloguePrintHTML({ title, subtitle, rows }));
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 300);
  return true;
}
