import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { addDaysUTC, startOfDayUTC, isoFromDateUTC } from "@/lib/dateUtc";
// Assuming a server-side PDF generation utility
import { generateSupervisorSummaryPdf } from "@/lib/generateSupervisorSummaryPdf"; // NEW UTILITY
import puppeteer from "puppeteer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (m?.[1]) return m[1];

  const url = new URL(req.url);
  const qToken = url.searchParams.get("token") || url.searchParams.get("bearer");
  return qToken ?? null;
}

async function getAuth(req: Request) {
  const token = getBearer(req);
  if (!token) {
    const session = await getServerSession(authOptions);
    const u = session?.user as any;
    if (!u?.id) return null;
    return { userId: u.id as string, role: u.role as string };
  }
  const payload = await verifyApiToken(token);
  if (!payload) return null;
  return { userId: payload.sub, role: payload.role };
}

function decimalToNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const anyV = v as any;
  if (typeof anyV?.toNumber === "function") return anyV.toNumber();
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function escapeHTML(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function weekdayShortUTC(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
}

function periodHeaderLabel(startISO: string, endISO: string) {
  const start = new Date(`${startISO}T00:00:00.000Z`);
  const end = new Date(`${endISO}T00:00:00.000Z`);
  const startMonth = start.toLocaleDateString("en-ZA", {
    month: "long",
    timeZone: "UTC",
  });
  const endMonth = end.toLocaleDateString("en-ZA", {
    month: "long",
    timeZone: "UTC",
  });
  const year = end.toLocaleDateString("en-ZA", {
    year: "numeric",
    timeZone: "UTC",
  });
  return startMonth === endMonth
    ? `${startMonth} ${year}`
    : `${startMonth} & ${endMonth} ${year}`;
}

function foremanInitial(name: string) {
  return name.trim().split(/\s+/)[0]?.slice(0, 1).toUpperCase() || "?";
}

type QuickViewColumn = { iso: string; day: string; date: string };
type QuickViewRow = {
  foremanName: string;
  jobNo: string;
  siteName: string;
  dailyCounts: number[];
  foremanPresence: boolean[];
  foremanDays: number;
  manDays: number;
};

async function generateQuickViewPdf(input: {
  supervisorName: string;
  startISO: string;
  endISO: string;
  columns: QuickViewColumn[];
  rows: QuickViewRow[];
}) {
  const totalForemanDays = input.rows.reduce((s, r) => s + r.foremanDays, 0);
  const totalManDays = input.rows.reduce((s, r) => s + r.manDays, 0);
  const todayISO = new Date().toISOString().slice(0, 10);
  const dateLabel = periodHeaderLabel(input.startISO, input.endISO);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: A4 landscape; margin: 8mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #000;
      background: #fff;
      font-family: Arial, sans-serif;
      font-size: 10px;
    }
    .sheet-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 10px;
      font-size: 12px;
    }
    .title {
      font-size: 15px;
      font-weight: 700;
      text-decoration: underline;
      letter-spacing: 1.5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 10px;
    }
    th {
      border: 1.4px solid #222;
      padding: 6px 5px;
      background: #f2f2f2;
      font-weight: 700;
      text-align: center;
      white-space: nowrap;
    }
    td {
      height: 26px;
      border: 1px solid #bbb;
      padding: 4px;
      text-align: center;
      vertical-align: middle;
    }
    .name { width: 13.5%; text-align: left; white-space: nowrap; font-weight: 500; }
    .job { width: 7.8%; text-align: left; color: #555; font-size: 9px; }
    .site { width: 23.5%; text-align: left; white-space: nowrap; font-size: 9px; }
    .day { width: 3.45%; padding: 2px; }
    .total { width: 5.4%; font-weight: 700; }
    .day-short { display: block; font-size: 8px; line-height: 1.15; font-weight: 400; }
    .day-num { display: block; font-size: 10px; line-height: 1.25; font-weight: 700; }
    .count { font-weight: 700; font-size: 9px; }
    .slash {
      width: 18px;
      height: 12px;
      margin: 0 auto;
      position: relative;
    }
    .slash:before {
      content: "";
      position: absolute;
      left: 1px;
      top: 9px;
      width: 18px;
      border-top: 1.2px solid #000;
      transform: rotate(-34deg);
      transform-origin: left center;
    }
    tfoot td {
      background: #f0f0f0;
      font-weight: 700;
      border-top: 2px solid #333;
    }
    .totals-label {
      text-align: right;
      padding-right: 8px;
      letter-spacing: 0.5px;
    }
    .summary {
      display: flex;
      gap: 24px;
      margin-top: 12px;
      font-size: 13px;
      color: #555;
    }
  </style>
</head>
<body>
  <div class="sheet-header">
    <div><span style="font-size: 11px;">Date:&nbsp;</span><strong>${escapeHTML(dateLabel)}</strong></div>
    <div class="title">TIME SHEET</div>
    <div><span style="font-size: 11px;">Contract Manager:&nbsp;</span><strong>${escapeHTML(input.supervisorName)}</strong></div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="name">Name</th>
        <th class="job">Job No</th>
        <th class="site">Site</th>
        ${input.columns
          .map(
            (col) =>
              `<th class="day"><span class="day-short">${escapeHTML(col.day)}</span><span class="day-num">${escapeHTML(col.date)}</span></th>`,
          )
          .join("")}
        <th class="total">F/man<br/>Days</th>
        <th class="total">Man<br/>Days</th>
      </tr>
    </thead>
    <tbody>
      ${input.rows
        .map((row) => {
          const initial = foremanInitial(row.foremanName);
          return `<tr>
            <td class="name">${escapeHTML(row.foremanName)}</td>
            <td class="job">${escapeHTML(row.jobNo)}</td>
            <td class="site">${escapeHTML(row.siteName)}</td>
            ${row.dailyCounts
              .map((count, dayIdx) => {
                const col = input.columns[dayIdx];
                const isFuture = col ? col.iso > todayISO : false;
                const foremanIn = row.foremanPresence[dayIdx] ?? false;
                const hasActivity = count > 0 || foremanIn;
                const value = foremanIn
                  ? `${initial}+${count}`
                  : count > 0
                    ? String(count)
                    : "";
                return `<td class="${hasActivity ? "count" : ""}">${
                  isFuture
                    ? ""
                    : hasActivity
                      ? escapeHTML(value)
                      : '<div class="slash"></div>'
                }</td>`;
              })
              .join("")}
            <td class="total">${row.foremanDays || ""}</td>
            <td class="total">${row.manDays}</td>
          </tr>`;
        })
        .join("")}
    </tbody>
    <tfoot>
      <tr>
        <td class="totals-label" colspan="${3 + input.columns.length}">TOTALS</td>
        <td class="total">${totalForemanDays}</td>
        <td class="total">${totalManDays}</td>
      </tr>
    </tfoot>
  </table>

  <div class="summary">
    <span>Foremen: <strong>${input.rows.length}</strong></span>
    <span>Foreman Days: <strong>${totalForemanDays}</strong></span>
    <span>Total Man Days: <strong>${totalManDays}</strong></span>
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
      margin: { top: "8mm", right: "8mm", bottom: "8mm", left: "8mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export async function GET(req: Request) {
  try {
    const auth = await getAuth(req);
    if (!auth || auth.role !== "SUPERVISOR") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const userId = auth.userId;
    const url = new URL(req.url);
    const periodId = url.searchParams.get("periodId");
    const layout = url.searchParams.get("layout");

    if (!periodId) {
      return NextResponse.json(
        { error: "Missing periodId parameter" },
        { status: 400 },
      );
    }

    const supervisor = await prisma.supervisor.findUnique({
      where: { userId },
      select: { id: true, user: { select: { name: true } } },
    });

    if (!supervisor) {
      return NextResponse.json(
        { error: "Supervisor not found" },
        { status: 404 },
      );
    }

    let period = await prisma.timesheetPeriod.findUnique({
      where: { id: periodId },
      select: { id: true, startDate: true, endDate: true },
    });

    if (!period) {
      // Mobile app sends: "YYYY-MM-DD__YYYY-MM-DD" (double underscore),
      // but we accept any run of underscores between the two dates.
      const m = periodId.match(/(\d{4}-\d{2}-\d{2})_+(\d{4}-\d{2}-\d{2})/);

      if (!m) {
        return NextResponse.json(
          { error: "Period not found" },
          { status: 404 },
        );
      }

      const startISO = m[1];
      const endISO = m[2];

      const startDate = startOfDayUTC(startISO);
      const endDate = startOfDayUTC(endISO);

      period = await prisma.timesheetPeriod.upsert({
        where: { startDate_endDate: { startDate, endDate } },
        update: {},
        create: { startDate, endDate },
        select: { id: true, startDate: true, endDate: true },
      });
    }

    const { startDate, endDate } = period;
    const startISO = isoFromDateUTC(startDate);
    const endISO = isoFromDateUTC(endDate);
    const endExclusive = addDaysUTC(endDate, 1);

    // Get sites this supervisor is assigned to (active assignments only)
    const now = new Date();
    const supervisorSiteAssignments =
      await prisma.supervisorSiteAssignment.findMany({
        where: {
          supervisorId: supervisor.id,
          startsOn: { lte: now },
          OR: [{ endsOn: null }, { endsOn: { gt: now } }],
        },
        select: { siteId: true },
      });

    const siteIds = supervisorSiteAssignments.map((a) => a.siteId);

    if (siteIds.length === 0) {
      return NextResponse.json(
        { error: "No sites assigned to this supervisor" },
        { status: 400 },
      );
    }

    // Fetch all relevant timesheet data for the supervisor for that period
    const timesheetRecords = await prisma.timesheet.findMany({
      where: {
        periodId: period.id,
        siteId: { in: siteIds },
        foreman: {
          siteDays: {
            some: {
              workDate: { gte: startDate, lt: endExclusive },
              siteId: { in: siteIds },
            },
          },
        },
      },
      select: {
        id: true,
        status: true,
        foremanId: true,
        siteId: true,
        foreman: {
          select: {
            id: true,
            user: { select: { name: true, employee: { select: { id: true } } } },
          },
        },
        site: { select: { id: true, code: true, name: true } },
      },
    });

    // Fetch attendance scans for all foremen on these sites in this period
    const foremanIdsInPeriod = Array.from(
      new Set(timesheetRecords.map((tr) => tr.foremanId)),
    );

    const scans = await prisma.attendanceScan.findMany({
      where: {
        siteDay: {
          workDate: { gte: startDate, lt: endExclusive },
          foremanId: { in: foremanIdsInPeriod },
          siteId: { in: siteIds },
        },
      },
      select: {
        siteDay: { select: { foremanId: true, workDate: true, siteId: true } },
        siteId: true,
        employeeId: true,
        dayRateAtScan: true,
        employee: { select: { defaultDayRate: true } },
      },
    });

    if (layout === "quick-view") {
      const columns: QuickViewColumn[] = Array.from({ length: 14 }).map(
        (_, i) => {
          const d = addDaysUTC(startDate, i);
          const iso = isoFromDateUTC(d);
          return {
            iso,
            day: weekdayShortUTC(iso),
            date: String(d.getUTCDate()).padStart(2, "0"),
          };
        },
      );

      const rows: QuickViewRow[] = timesheetRecords
        .map((record) => {
          const foremanEmployeeId = record.foreman.user?.employee?.id ?? null;
          const dayEmployeeSets = columns.map(() => new Set<string>());
          const foremanPresence = Array(columns.length).fill(false);

          for (const scan of scans) {
            if (scan.siteDay.foremanId !== record.foremanId) continue;
            if (scan.siteId !== record.siteId) continue;
            const iso = isoFromDateUTC(scan.siteDay.workDate);
            const dayIdx = columns.findIndex((c) => c.iso === iso);
            if (dayIdx < 0) continue;

            if (foremanEmployeeId && scan.employeeId === foremanEmployeeId) {
              foremanPresence[dayIdx] = true;
            } else {
              dayEmployeeSets[dayIdx].add(scan.employeeId);
            }
          }

          const dailyCounts = dayEmployeeSets.map((set) => set.size);
          const foremanDays = foremanPresence.reduce(
            (sum, present) => sum + (present ? 1 : 0),
            0,
          );
          const manDays = dailyCounts.reduce((sum, count) => sum + count, 0);

          return {
            foremanName: record.foreman.user?.name ?? "Unknown Foreman",
            jobNo: record.site?.code ?? "",
            siteName: record.site?.name ?? "Unknown Site",
            dailyCounts,
            foremanPresence,
            foremanDays,
            manDays,
          };
        })
        .sort((a, b) => {
          const n = a.foremanName.localeCompare(b.foremanName);
          return n !== 0 ? n : a.siteName.localeCompare(b.siteName);
        });

      const pdfBytes = await generateQuickViewPdf({
        supervisorName: supervisor.user?.name ?? "Supervisor",
        startISO,
        endISO,
        columns,
        rows,
      });

      return new NextResponse(new Uint8Array(pdfBytes), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="timesheet-${startISO}-${endISO}.pdf"`,
        },
      });
    }

    // Aggregate scan data to calculate totalWorkerDays and totalWorkerWages per (foreman, site)
    const scansByForemanSite = new Map<
      string,
      Array<{ date: string; wage: number; employeeId: string }>
    >();

    for (const scan of scans) {
      const foremanId = scan.siteDay.foremanId;
      const siteId = scan.siteId;
      const dateISO = isoFromDateUTC(scan.siteDay.workDate);
      const rate =
        decimalToNumber(scan.dayRateAtScan) ||
        decimalToNumber(scan.employee?.defaultDayRate);

      const key = `${foremanId}__${siteId}`;
      const list = scansByForemanSite.get(key) ?? [];
      list.push({ date: dateISO, wage: rate, employeeId: scan.employeeId });
      scansByForemanSite.set(key, list);
    }

    const totalsByForemanSite = new Map<
      string,
      { days: number; wages: number }
    >();

    for (const [key, list] of scansByForemanSite.entries()) {
      const uniquePairs = new Set<string>();
      let totalWages = 0;

      for (const s of list) {
        const pairKey = `${s.employeeId}-${s.date}`;
        if (!uniquePairs.has(pairKey)) {
          uniquePairs.add(pairKey);
          totalWages += s.wage;
        }
      }

      totalsByForemanSite.set(key, {
        days: uniquePairs.size,
        wages: totalWages,
      });
    }

    // Structure data for PDF generation (similar to SupervisorSummaryGroup)
    const supervisorSummary: any = {
      // Use 'any' for now, define proper type in generateSupervisorSummaryPdf
      supervisorId: supervisor.id,
      supervisorName: supervisor.user?.name ?? "Supervisor",
      foremen: [],
      totalForemanDays: 0,
      totalForemanWages: 0,
      totalTeamDays: 0,
      totalTeamWages: 0,
      grandTotal: 0,
    };

    const foremenMap = new Map<string, any>(); // Use 'any' for now

    for (const record of timesheetRecords) {
      const foremanKey = record.foremanId;
      if (!foremenMap.has(foremanKey)) {
        foremenMap.set(foremanKey, {
          foremanId: record.foremanId,
          foremanName: record.foreman?.user?.name ?? "Unknown Foreman",
          sites: [],
          totalForemanDays: 0,
          totalForemanWages: 0,
          totalTeamDays: 0,
          totalTeamWages: 0,
          grandTotal: 0,
        });
      }
      const foremanEntry = foremenMap.get(foremanKey)!;

      const siteKey = `${record.foremanId}__${record.siteId}`;
      const siteTotals = totalsByForemanSite.get(siteKey) || {
        days: 0,
        wages: 0,
      };

      foremanEntry.sites.push({
        siteName: record.site?.name ?? "Unknown Site",
        siteCode: record.site?.code ?? null,
        foremanDays: 0, // Not directly calculated here, could be derived from timesheet detail if needed
        foremanWages: 0, // Not directly calculated here
        teamDays: siteTotals.days,
        teamWages: siteTotals.wages,
        totalWages: siteTotals.wages,
      });

      foremanEntry.totalTeamDays += siteTotals.days;
      foremanEntry.totalTeamWages += siteTotals.wages;
      foremanEntry.grandTotal += siteTotals.wages;
    }

    supervisorSummary.foremen = Array.from(foremenMap.values()).sort(
      (a: any, b: any) => a.foremanName.localeCompare(b.foremanName),
    );

    for (const foreman of supervisorSummary.foremen) {
      supervisorSummary.totalTeamDays += foreman.totalTeamDays;
      supervisorSummary.totalTeamWages += foreman.totalTeamWages;
      supervisorSummary.grandTotal += foreman.grandTotal;
    }

    // Generate PDF
    const pdfBytes = await generateSupervisorSummaryPdf(
      supervisorSummary,
      startISO,
      endISO,
    );
    const pdfBody = new Uint8Array(pdfBytes);

    return new NextResponse(pdfBody, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="supervisor-timesheet-summary-${startISO}-${endISO}.pdf"`,
      },
    });
  } catch (e: any) {
    console.error("Error generating supervisor timesheet summary PDF:", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 },
    );
  }
}
