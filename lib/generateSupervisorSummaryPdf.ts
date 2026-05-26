// lib/generateSupervisorSummaryPdf.ts
import puppeteer from "puppeteer";

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

function currency(v: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(v);
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export async function generateSupervisorSummaryPdf(
  summaryData: SupervisorSummaryGroup,
  startISO: string,
  endISO: string,
): Promise<Buffer> {
  if (!summaryData) {
    throw new Error("Missing summaryData");
  }

  const summary = {
    ...summaryData,
    foremen: Array.isArray(summaryData.foremen) ? summaryData.foremen : [],
    totalTeamDays: Number(summaryData.totalTeamDays) || 0,
    totalTeamWages: Number(summaryData.totalTeamWages) || 0,
    grandTotal: Number(summaryData.grandTotal) || 0,
  };

  const html = `<!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8" />

    <style>
      * { box-sizing: border-box; }

      body {
        font-family: Arial, sans-serif;
        padding: 20px;
        color: #111827;
      }

      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
      }

      .title {
        font-size: 28px;
        font-weight: bold;
      }

      .subtitle {
        color: #6b7280;
        margin-top: 5px;
      }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        margin-bottom: 20px;
      }

      .card {
        border: 1px solid #d1d5db;
        border-radius: 10px;
        padding: 12px;
      }

      .card-label {
        font-size: 12px;
        color: #6b7280;
        margin-bottom: 6px;
      }

      .card-value {
        font-size: 20px;
        font-weight: bold;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 20px;
      }

      th {
        background: #1e293b;
        color: white;
        font-size: 12px;
        padding: 10px;
        border: 1px solid #cbd5e1;
      }

      td {
        padding: 9px;
        border: 1px solid #cbd5e1;
        font-size: 11px;
      }

      .section {
        background: #f1f5f9;
        font-weight: bold;
      }

      .right { text-align: right; }
      .center { text-align: center; }

      .totals {
        background: #e2e8f0;
        font-weight: bold;
      }

      .footer {
        margin-top: 30px;
        font-size: 11px;
        color: #6b7280;
        text-align: center;
      }
    </style>
  </head>

  <body>
    <div class="header">
      <div>
        <div class="title">TIME SHEET SUMMARY</div>

        <div class="subtitle">
          ${formatDate(startISO)} - ${formatDate(endISO)}
        </div>
      </div>

      <div>
        <strong>Supervisor:</strong>
        ${summary.supervisorName}
      </div>
    </div>

    <div class="summary-grid">
      <div class="card">
        <div class="card-label">Foremen</div>
        <div class="card-value">${summary.foremen.length}</div>
      </div>

      <div class="card">
        <div class="card-label">Team Days</div>
        <div class="card-value">${summary.totalTeamDays}</div>
      </div>

      <div class="card">
        <div class="card-label">Team Wages</div>
        <div class="card-value">
          ${currency(summary.totalTeamWages)}
        </div>
      </div>

      <div class="card">
        <div class="card-label">Grand Total</div>
        <div class="card-value">
          ${currency(summary.grandTotal)}
        </div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Foreman</th>
          <th>Site</th>
          <th>Code</th>
          <th>Team Days</th>
          <th>Team Wages</th>
          <th>Total</th>
        </tr>
      </thead>

      <tbody>
        ${summary.foremen
          .map(
            (foreman) => `
            <tr class="section">
              <td colspan="6">${foreman.foremanName}</td>
            </tr>

            ${foreman.sites
              .map(
                (site) => `
                <tr>
                  <td></td>

                  <td>${site.siteName}</td>

                  <td class="center">${site.siteCode || "-"}</td>

                  <td class="center">${site.teamDays}</td>

                  <td class="right">${currency(site.teamWages)}</td>

                  <td class="right">${currency(site.totalWages)}</td>
                </tr>
              `,
              )
              .join("")}

            <tr class="totals">
              <td colspan="3">${foreman.foremanName} Totals</td>

              <td class="center">${foreman.totalTeamDays}</td>

              <td class="right">${currency(foreman.totalTeamWages)}</td>

              <td class="right">${currency(foreman.grandTotal)}</td>
            </tr>
          `,
          )
          .join("")}

        <tr class="totals">
          <td colspan="3">GRAND TOTAL</td>

          <td class="center">${summary.totalTeamDays}</td>

          <td class="right">${currency(summary.totalTeamWages)}</td>

          <td class="right">${currency(summary.grandTotal)}</td>
        </tr>
      </tbody>
    </table>

    <div class="footer">
      Generated on ${new Date().toLocaleString("en-ZA")}
    </div>
  </body>
  </html>`;

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });

    const pdf = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: { top: "20px", right: "20px", bottom: "20px", left: "20px" },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
