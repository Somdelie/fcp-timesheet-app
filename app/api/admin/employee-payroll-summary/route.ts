import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { addDaysUTC, decimalToNumber, isoFromDateUTC, startOfDayUTC } from "@/lib/dateUtc";
import { currentFortnightSatFri } from "@/lib/fortnight";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

type OvertimeType = "NONE" | "HALF_DAY" | "FULL_DAY";

function overtimeDays(type: OvertimeType) {
  if (type === "HALF_DAY") return 0.5;
  if (type === "FULL_DAY") return 1;
  return 0;
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  if (user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: CORS_HEADERS },
    );
  }

  const url = new URL(req.url);
  const employeeId = url.searchParams.get("employeeId") || null;
  const q = (url.searchParams.get("q") || "").trim();
  const requestedStartISO = url.searchParams.get("start");
  const requestedEndISO = url.searchParams.get("end");
  const current = currentFortnightSatFri();
  const startISO = requestedStartISO || current.startISO;
  let start: Date;
  let end: Date;

  try {
    start = startOfDayUTC(startISO);
  } catch {
    return NextResponse.json(
      { error: "Invalid start date" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  try {
    end = requestedEndISO
      ? startOfDayUTC(requestedEndISO)
      : addDaysUTC(start, 13);
  } catch {
    return NextResponse.json(
      { error: "Invalid end date" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  if (end < start) {
    return NextResponse.json(
      { error: "End date must be after start date" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const dayCount = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  if (dayCount > 370) {
    return NextResponse.json(
      { error: "Payroll summary range cannot exceed 370 days" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const endISO = isoFromDateUTC(end);
  const endExclusive = addDaysUTC(end, 1);
  const terms = q.split(/\s+/).filter(Boolean);
  const employeeFilter =
    terms.length > 0
      ? {
          AND: terms.map((term) => ({
            OR: [
              { firstName: { contains: term, mode: "insensitive" as const } },
              { lastName: { contains: term, mode: "insensitive" as const } },
              { qrCodeValue: { contains: term, mode: "insensitive" as const } },
            ],
          })),
        }
      : undefined;

  const employeeRows = await prisma.attendanceScan.findMany({
    where: {
      workDate: { gte: start, lt: endExclusive },
      ...(employeeFilter ? { employee: employeeFilter } : {}),
    },
    distinct: ["employeeId"],
    select: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          qrCodeValue: true,
        },
      },
    },
    orderBy: { employeeId: "asc" },
    take: 50,
  });

  const employees = employeeRows
    .map(({ employee }) => ({
      id: employee.id,
      name: `${employee.firstName} ${employee.lastName}`.trim(),
      code: employee.qrCodeValue,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  if (!employeeId) {
    return NextResponse.json(
      {
        period: { startISO, endISO, label: `${startISO} - ${endISO}` },
        employees,
        selectedEmployee: null,
        rows: [],
        summary: null,
      },
      { headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } },
    );
  }

  const [employee, scans] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        qrCodeValue: true,
        defaultDayRate: true,
      },
    }),
    prisma.attendanceScan.findMany({
      where: {
        employeeId,
        workDate: { gte: start, lt: endExclusive },
      },
      select: {
        id: true,
        workDate: true,
        dayRateAtScan: true,
        overtimeType: true,
        site: { select: { id: true, name: true, code: true } },
        siteDay: {
          select: {
            foreman: {
              select: {
                user: { select: { name: true, email: true } },
              },
            },
          },
        },
      },
      orderBy: { workDate: "asc" },
    }),
  ]);

  if (!employee) {
    return NextResponse.json(
      { error: "Employee not found" },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const scanByDate = new Map(scans.map((scan) => [isoFromDateUTC(scan.workDate), scan]));
  const dates = Array.from({ length: dayCount }, (_, index) =>
    isoFromDateUTC(addDaysUTC(start, index)),
  );

  const rows = dates.map((date) => {
    const scan = scanByDate.get(date);
    const regularDays = scan ? 1 : 0;
    const regularRate = scan ? decimalToNumber(scan.dayRateAtScan) : 0;
    const regularWage = regularDays * regularRate;
    const otDays = scan ? overtimeDays(scan.overtimeType as OvertimeType) : 0;
    const overtimeRate = regularRate;
    const overtimeWage = otDays * overtimeRate;

    return {
      date,
      siteName: scan?.site.code ? `${scan.site.code} - ${scan.site.name}` : scan?.site.name ?? "",
      foremanName:
        scan?.siteDay.foreman.user.name ??
        scan?.siteDay.foreman.user.email ??
        "",
      regularDays,
      regularRate,
      regularWage,
      overtimeType: scan?.overtimeType ?? "NONE",
      overtimeDays: otDays,
      overtimeRate,
      overtimeWage,
      totalWage: regularWage + overtimeWage,
    };
  });

  const summary = rows.reduce(
    (acc, row) => {
      acc.regularDays += row.regularDays;
      acc.regularWage += row.regularWage;
      acc.overtimeDays += row.overtimeDays;
      acc.overtimeWage += row.overtimeWage;
      acc.totalWage += row.totalWage;
      return acc;
    },
    {
      regularDays: 0,
      regularWage: 0,
      overtimeDays: 0,
      overtimeWage: 0,
      totalWage: 0,
    },
  );

  const regularRate =
    summary.regularDays > 0 ? summary.regularWage / summary.regularDays : 0;
  const overtimeRate =
    summary.overtimeDays > 0 ? summary.overtimeWage / summary.overtimeDays : regularRate;

  return NextResponse.json(
    {
      period: { startISO, endISO, label: `${startISO} - ${endISO}` },
      employees,
      selectedEmployee: {
        id: employee.id,
        name: `${employee.firstName} ${employee.lastName}`.trim(),
        code: employee.qrCodeValue,
        defaultDayRate: decimalToNumber(employee.defaultDayRate),
      },
      rows,
      summary: {
        ...summary,
        regularRate,
        overtimeRate,
      },
    },
    { headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } },
  );
}
