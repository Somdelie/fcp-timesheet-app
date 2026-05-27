import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { addDaysUTC, startOfDayUTC, isoFromDateUTC } from "@/lib/dateUtc";
import { generateSupervisorSummaryPdf } from "@/lib/generateSupervisorSummaryPdf";
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";

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
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 841.89;
  const pageHeight = 595.28;
  const margin = 24;
  const headerHeight = 32;
  const rowHeight = 24;
  const nameWidth = 115;
  const jobWidth = 56;
  const siteWidth = 155;
  const totalWidth = 52;
  const dayWidth =
    (pageWidth - margin * 2 - nameWidth - jobWidth - siteWidth - totalWidth * 2) /
    Math.max(input.columns.length, 1);
  const totalForemanDays = input.rows.reduce((s, r) => s + r.foremanDays, 0);
  const totalManDays = input.rows.reduce((s, r) => s + r.manDays, 0);
  const todayISO = new Date().toISOString().slice(0, 10);
  const dateLabel = periodHeaderLabel(input.startISO, input.endISO);
  const truncate = (value: string, width: number, textFont: PDFFont, size: number) => {
    let result = value;
    while (result && textFont.widthOfTextAtSize(result, size) > width) {
      result = result.slice(0, -1);
    }
    return result === value ? result : `${result.slice(0, -3)}...`;
  };
  const cell = (
    page: PDFPage,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    options: { bold?: boolean; align?: "left" | "center" | "right"; fill?: ReturnType<typeof rgb> } = {},
  ) => {
    const textFont = options.bold ? bold : font;
    const size = 8;
    const value = truncate(text, width - 8, textFont, size);
    if (options.fill) page.drawRectangle({ x, y, width, height, color: options.fill });
    page.drawRectangle({ x, y, width, height, borderColor: rgb(0.7, 0.72, 0.76), borderWidth: 0.6 });
    const textWidth = textFont.widthOfTextAtSize(value, size);
    const textX =
      options.align === "right"
        ? x + width - textWidth - 4
        : options.align === "center"
          ? x + (width - textWidth) / 2
          : x + 4;
    page.drawText(value, { x: textX, y: y + height / 2 - 3, size, font: textFont, color: rgb(0.08, 0.1, 0.14) });
  };
  let page: PDFPage = undefined as unknown as PDFPage;
  let y = 0;
  const beginPage = () => {
    page = pdf.addPage([pageWidth, pageHeight]);
    page.drawText("TIME SHEET", { x: pageWidth / 2 - 48, y: pageHeight - margin - 4, size: 16, font: bold, color: rgb(0.08, 0.1, 0.14) });
    page.drawText(`Date: ${dateLabel}`, { x: margin, y: pageHeight - margin - 3, size: 10, font, color: rgb(0.3, 0.33, 0.38) });
    const manager = truncate(`Contract Manager: ${input.supervisorName}`, 230, font, 10);
    page.drawText(manager, { x: pageWidth - margin - font.widthOfTextAtSize(manager, 10), y: pageHeight - margin - 3, size: 10, font, color: rgb(0.3, 0.33, 0.38) });
    y = pageHeight - margin - 34;
    let x = margin;
    const header = rgb(0.93, 0.94, 0.96);
    cell(page, "Name", x, y - headerHeight, nameWidth, headerHeight, { bold: true, fill: header }); x += nameWidth;
    cell(page, "Job No", x, y - headerHeight, jobWidth, headerHeight, { bold: true, fill: header }); x += jobWidth;
    cell(page, "Site", x, y - headerHeight, siteWidth, headerHeight, { bold: true, fill: header }); x += siteWidth;
    input.columns.forEach((col) => {
      cell(page, `${col.day} ${col.date}`, x, y - headerHeight, dayWidth, headerHeight, { bold: true, align: "center", fill: header });
      x += dayWidth;
    });
    cell(page, "F/man Days", x, y - headerHeight, totalWidth, headerHeight, { bold: true, align: "center", fill: header }); x += totalWidth;
    cell(page, "Man Days", x, y - headerHeight, totalWidth, headerHeight, { bold: true, align: "center", fill: header });
    y -= headerHeight;
  };
  beginPage();
  for (const row of input.rows) {
    if (y - rowHeight < margin + rowHeight * 2) beginPage();
    let x = margin;
    cell(page!, row.foremanName, x, y - rowHeight, nameWidth, rowHeight, { bold: true }); x += nameWidth;
    cell(page!, row.jobNo, x, y - rowHeight, jobWidth, rowHeight); x += jobWidth;
    cell(page!, row.siteName, x, y - rowHeight, siteWidth, rowHeight); x += siteWidth;
    const initial = foremanInitial(row.foremanName);
    row.dailyCounts.forEach((count, dayIdx) => {
      const future = input.columns[dayIdx]?.iso > todayISO;
      const present = row.foremanPresence[dayIdx] ?? false;
      const value = future ? "" : present ? `${initial}+${count}` : count > 0 ? String(count) : "/";
      cell(page!, value, x, y - rowHeight, dayWidth, rowHeight, { bold: present || count > 0, align: "center" });
      x += dayWidth;
    });
    cell(page!, row.foremanDays ? String(row.foremanDays) : "", x, y - rowHeight, totalWidth, rowHeight, { bold: true, align: "center" }); x += totalWidth;
    cell(page!, String(row.manDays), x, y - rowHeight, totalWidth, rowHeight, { bold: true, align: "center" });
    y -= rowHeight;
  }
  let x = margin;
  const totalsLabelWidth = nameWidth + jobWidth + siteWidth + dayWidth * input.columns.length;
  const totalsFill = rgb(0.9, 0.92, 0.94);
  cell(page!, "TOTALS", x, y - rowHeight, totalsLabelWidth, rowHeight, { bold: true, align: "right", fill: totalsFill }); x += totalsLabelWidth;
  cell(page!, String(totalForemanDays), x, y - rowHeight, totalWidth, rowHeight, { bold: true, align: "center", fill: totalsFill }); x += totalWidth;
  cell(page!, String(totalManDays), x, y - rowHeight, totalWidth, rowHeight, { bold: true, align: "center", fill: totalsFill });
  page!.drawText(`Foremen: ${input.rows.length}    Foreman Days: ${totalForemanDays}    Total Man Days: ${totalManDays}`, {
    x: margin,
    y: y - rowHeight - 22,
    size: 10,
    font: bold,
    color: rgb(0.3, 0.33, 0.38),
  });
  return Buffer.from(await pdf.save());
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
