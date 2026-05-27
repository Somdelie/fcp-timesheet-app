import { NextResponse } from "next/server";
import { generateTimesheetPdf } from "@/lib/generateTimesheetPdf";
import type { TimesheetGridModel } from "@/lib/timesheets/gridModel";
import { GET as getTimesheetDetail } from "../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MobileTimesheet = {
  startISO: string;
  endISO: string;
  sitesLabel: string;
  foremanName?: string;
  foreman?: { name?: string };
  status?: string;
  columns: { iso: string; day: string }[];
  rows: {
    employeeId: string;
    fullName: string;
    dayRate: number;
    present: boolean[];
    daysWorked: number;
    pay: number;
  }[];
};

function dateLabel(iso: string) {
  return iso.slice(8, 10);
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const detailResponse = await getTimesheetDetail(req, ctx);
  if (!detailResponse.ok) return detailResponse;

  const payload = (await detailResponse.json()) as { timesheet?: MobileTimesheet };
  const timesheet = payload.timesheet;
  if (!timesheet) {
    return NextResponse.json({ error: "Timesheet not found" }, { status: 404 });
  }

  const foremanName = timesheet.foremanName ?? timesheet.foreman?.name ?? "Foreman";
  const foremanKey = foremanName.trim().toLowerCase();
  let foremanDays = 0;
  let foremanPay = 0;
  let teamDays = 0;
  let teamPay = 0;

  const rows = timesheet.rows.map((row) => {
    const isForeman = row.fullName.trim().toLowerCase() === foremanKey;
    if (isForeman) {
      foremanDays += row.daysWorked;
      foremanPay += row.pay;
    } else {
      teamDays += row.daysWorked;
      teamPay += row.pay;
    }
    return {
      id: row.employeeId,
      label: row.fullName,
      dayRate: row.dayRate,
      present: row.present,
      daysWorked: row.daysWorked,
      pay: row.pay,
      isForeman,
    };
  });

  const model: TimesheetGridModel = {
    foremanName,
    columns: timesheet.columns.map((column) => ({
      iso: column.iso,
      dayLabel: column.day,
      dateLabel: dateLabel(column.iso),
    })),
    rows,
    totals: {
      totalDays: foremanDays + teamDays,
      totalPay: foremanPay + teamPay,
      foremanDays,
      foremanPay,
      teamDays,
      teamPay,
    },
  };

  const bytes = await generateTimesheetPdf(model, {
    foremanName,
    siteName: timesheet.sitesLabel,
    startISO: timesheet.startISO,
    endISO: timesheet.endISO,
    status: timesheet.status,
    hideAmounts: true,
  });
  const filename = `timesheet-${timesheet.startISO}-${timesheet.endISO}.pdf`;

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
