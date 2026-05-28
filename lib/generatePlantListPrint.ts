export type PlantListPrintItem = {
  productName: string;
  quantity: number;
};

export type SupervisorPlantListPrint = {
  supervisorName: string;
  items: PlantListPrintItem[];
};

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function generatePlantListPrintHTML(
  supervisorName: string,
  items: PlantListPrintItem[],
): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const totalUnits = items.reduce((sum, i) => sum + i.quantity, 0);

  const tableRows = items
    .map(
      (item) => `
      <tr>
        <td class="name-col">${escapeHTML(item.productName)}</td>
        <td class="qty-col">${item.quantity}</td>
      </tr>`,
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Plant List - ${escapeHTML(supervisorName)}</title>
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
          max-width: 900px;
          margin: 0 auto;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
        }
        h1 {
          font-size: 22px;
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
        .summary-cards {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
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
        .main-table tr:nth-child(even) td {
          background: #fafafa;
        }
        .name-col { font-weight: 500; }
        .qty-col { text-align: center; font-weight: 600; width: 100px; }

        @media print {
          body { background: white; }
          .actions { display: none; }
          .content { padding: 12px; }
        }
      </style>
    </head>
    <body>
      <div class="content">
        <div class="header">
          <div>
            <h1>Plant List - ${escapeHTML(supervisorName)}</h1>
            <div class="subtitle">Printed on ${dateStr}</div>
          </div>
          <div class="actions">
            <button class="btn" id="close-btn">Close</button>
            <button class="btn btn-primary" id="print-btn">Print</button>
          </div>
        </div>

        <div class="summary-cards">
          <div class="summary-card">
            <div class="summary-label">Total Items</div>
            <div class="summary-value">${items.length}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Total Units</div>
            <div class="summary-value">${totalUnits}</div>
          </div>
        </div>

        <div class="table-container">
          <table class="main-table">
            <thead>
              <tr>
                <th class="name-col">Item Name</th>
                <th class="qty-col">Quantity</th>
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

function generatePlantListPrintSection(
  supervisorName: string,
  items: PlantListPrintItem[],
  copyLabel?: string,
): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const totalUnits = items.reduce((sum, i) => sum + i.quantity, 0);
  const tableRows = items
    .map(
      (item) => `
      <tr>
        <td class="name-col">${escapeHTML(item.productName)}</td>
        <td class="qty-col">${item.quantity}</td>
      </tr>`,
    )
    .join("");

  return `
    <section class="print-page">
      <div class="header">
        <div>
          <h1>Plant List - ${escapeHTML(supervisorName)}</h1>
          <div class="subtitle">Printed on ${dateStr}${copyLabel ? ` &middot; ${escapeHTML(copyLabel)}` : ""}</div>
        </div>
      </div>

      <div class="summary-cards">
        <div class="summary-card">
          <div class="summary-label">Total Items</div>
          <div class="summary-value">${items.length}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Total Units</div>
          <div class="summary-value">${totalUnits}</div>
        </div>
      </div>

      <div class="table-container">
        <table class="main-table">
          <thead>
            <tr>
              <th class="name-col">Item Name</th>
              <th class="qty-col">Quantity</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    </section>
  `;
}

export function generatePlantListsPrintHTML(
  lists: SupervisorPlantListPrint[],
  copiesPerSupervisor: number,
): string {
  const copies = Math.max(1, Math.floor(copiesPerSupervisor));
  const sections = lists
    .flatMap((list) =>
      Array.from({ length: copies }, (_, index) =>
        generatePlantListPrintSection(
          list.supervisorName,
          list.items,
          copies > 1 ? `Copy ${index + 1} of ${copies}` : undefined,
        ),
      ),
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Plant Lists</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 12px;
          color: #27272a;
          background: #fafafa;
        }
        .actions {
          position: sticky;
          top: 0;
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding: 12px 24px;
          background: white;
          border-bottom: 1px solid #e4e4e7;
          z-index: 1;
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
        .print-page {
          padding: 24px;
          max-width: 900px;
          min-height: 100vh;
          margin: 0 auto;
          page-break-after: always;
        }
        .print-page:last-child { page-break-after: auto; }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
        }
        h1 {
          font-size: 22px;
          font-weight: 700;
          color: #18181b;
          margin-bottom: 4px;
        }
        .subtitle {
          font-size: 13px;
          color: #71717a;
        }
        .summary-cards {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
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
        .main-table tr:nth-child(even) td { background: #fafafa; }
        .name-col { font-weight: 500; }
        .qty-col { text-align: center; font-weight: 600; width: 100px; }

        @media print {
          body { background: white; }
          .actions { display: none; }
          .print-page { padding: 12px; min-height: auto; }
        }
      </style>
    </head>
    <body>
      <div class="actions">
        <button class="btn" id="close-btn">Close</button>
        <button class="btn btn-primary" id="print-btn">Print</button>
      </div>
      ${sections}
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

export function printSupervisorPlantList(
  supervisorName: string,
  items: PlantListPrintItem[],
): void {
  const html = generatePlantListPrintHTML(supervisorName, items);
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  }
}

export function printSupervisorPlantLists(
  lists: SupervisorPlantListPrint[],
  copiesPerSupervisor = 1,
): void {
  const html = generatePlantListsPrintHTML(lists, copiesPerSupervisor);
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  }
}
